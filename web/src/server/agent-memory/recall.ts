import { createServerFn } from "@tanstack/react-start";

// Recall reads ONLY the demo-safe materialized views (db/agent-memory/demo-safe.sql):
// hackathon_agent_data.demo_events / demo_urls. Hidden rows (NULL query_text / display_url /
// reg_domain) are never returned; in the chart they are folded into "Other".

const TZ = "America/Los_Angeles";
const WINDOW = 7; // days shown
const LOOKBACK = WINDOW * 2 - 1; // 6 prior days feed the first moving-average point
const TOP = 5;

export const OTHER = "Other";

export type RecallChart = {
	days: string[]; // last 7 PT days, YYYY-MM-DD, oldest first
	series: { key: string; total: number }[]; // top domains by 7-day total, then Other
	values: Record<string, number>[]; // per day: series key → URL occurrences
	totals: number[]; // per day total
	movingAvg: number[]; // per day 7-day moving average of the total
	suggestions: string[]; // demo search chips that have real, visible matches
};

export type RecallSession = {
	sessionKey: string;
	when: string; // PT, preformatted
	machine: string | null;
	agent: string | null;
	queries: string[];
	matchedQueries: boolean; // false → queries are context from a URL-only match
	pages: { url: string; domain: string | null }[];
};

export type RecallSearch = { q: string; sessions: RecallSession[]; ms: number };

// Demo topics; only those with visible matching searches become chips.
const SUGGESTION_CANDIDATES = [
	"Telem",
	"Tavily",
	"SearchHack",
	"Sora",
	"Cloudflare",
	"Expo",
	"Xcode caching",
	"GitHub Actions",
];

let chartCache: Promise<RecallChart> | undefined;

function shiftDay(day: string, delta: number) {
	const d = new Date(`${day}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + delta);
	return d.toISOString().slice(0, 10);
}

// The snapshot is static, so compute once per server process (like overview.ts).
export const getRecallChart = createServerFn({ method: "GET" }).handler(
	async (): Promise<RecallChart> => {
		chartCache ??= (async () => {
			const { db } = await import("../db");
			const sql = db();
			const [anchor] = await sql`
				select to_char(max(ts) at time zone ${TZ}, 'YYYY-MM-DD') as day
				from hackathon_agent_data.demo_events`;
			const last: string | null = anchor?.day ?? null;
			if (!last)
				return {
					days: [],
					series: [],
					values: [],
					totals: [],
					movingAvg: [],
					suggestions: [],
				};
			const first = shiftDay(last, -(LOOKBACK - 1));
			const rows = await sql<
				{ day: string; domain: string | null; n: number }[]
			>`
				select to_char(e.ts at time zone ${TZ}, 'YYYY-MM-DD') as day,
					u.reg_domain as domain, count(*)::int as n
				from hackathon_agent_data.demo_events e
				join hackathon_agent_data.demo_urls u on u.event_id = e.id
				where e.ts >= (${first}::date::timestamp at time zone ${TZ})
					and e.ts < ((${last}::date + 1)::timestamp at time zone ${TZ})
				group by 1, 2`;

			const allDays = Array.from({ length: LOOKBACK }, (_, i) =>
				shiftDay(first, i),
			);
			const days = allDays.slice(-WINDOW);
			const inWindow = new Set(days);
			const dayTotal = new Map<string, number>();
			const domainTotal = new Map<string, number>();
			for (const r of rows) {
				dayTotal.set(r.day, (dayTotal.get(r.day) ?? 0) + r.n);
				if (r.domain && inWindow.has(r.day))
					domainTotal.set(r.domain, (domainTotal.get(r.domain) ?? 0) + r.n);
			}
			const top = [...domainTotal.entries()]
				.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
				.slice(0, TOP)
				.map(([key]) => key);
			const topSet = new Set(top);
			const values = days.map(() => ({}) as Record<string, number>);
			for (const r of rows) {
				const i = days.indexOf(r.day);
				if (i < 0) continue;
				const key = r.domain && topSet.has(r.domain) ? r.domain : OTHER;
				values[i][key] = (values[i][key] ?? 0) + r.n;
			}
			const totals = days.map((d) => dayTotal.get(d) ?? 0);
			const movingAvg = days.map((d) => {
				const end = allDays.indexOf(d);
				const win = allDays.slice(end - (WINDOW - 1), end + 1);
				return win.reduce((s, x) => s + (dayTotal.get(x) ?? 0), 0) / WINDOW;
			});
			const keys = [...top, OTHER];
			const series = keys.map((key) => ({
				key,
				total: values.reduce((s, v) => s + (v[key] ?? 0), 0),
			}));

			const counts = await Promise.all(
				SUGGESTION_CANDIDATES.map(
					(t) => sql<{ n: number }[]>`
						select count(*)::int as n from (
							select 1 from hackathon_agent_data.demo_events
							where event_type = 'search_operation' and query_text is not null
								and to_tsvector('simple', coalesce(query_text, '')) @@ websearch_to_tsquery('simple', ${t})
							limit 1
						) x`,
				),
			);
			const suggestions = SUGGESTION_CANDIDATES.filter(
				(_, i) => counts[i][0].n > 0,
			).slice(0, 4);

			return { days, series, values, totals, movingAvg, suggestions };
		})().catch((err) => {
			chartCache = undefined;
			throw err;
		});
		return chartCache;
	},
);

const MAX_SESSIONS = 20;
const MAX_PAGES = 8;
const MAX_HITS = 400;

export const searchAgentMemory = createServerFn({ method: "GET" })
	.validator((d: { q: string }) => ({
		q: String(d?.q ?? "")
			.trim()
			.slice(0, 200),
	}))
	.handler(async ({ data }): Promise<RecallSearch> => {
		const q = data.q;
		const started = performance.now();
		if (!q) return { q, sessions: [], ms: 0 };
		const { db } = await import("../db");
		const sql = db();
		const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

		// 1. Sessions with a full-text query hit or a visible URL match, most recent first.
		const sessions = await sql<
			{
				session_key: string;
				first_ts: Date;
				when: string;
				machine: string | null;
				agent: string | null;
				queries: string[] | null;
			}[]
		>`
			with hits as (
				(select e.session_key, e.ts, e.machine, e.agent, e.query_text
				from hackathon_agent_data.demo_events e
				where e.event_type = 'search_operation' and e.query_text is not null and e.ts is not null
					and to_tsvector('simple', coalesce(e.query_text, '')) @@ websearch_to_tsquery('simple', ${q})
				order by e.ts desc limit ${MAX_HITS})
				union all
				(select e.session_key, e.ts, e.machine, e.agent, null
				from hackathon_agent_data.demo_urls u
				join hackathon_agent_data.demo_events e on e.id = u.event_id
				where u.display_url is not null and u.display_url ilike ${like} and e.ts is not null
				order by e.ts desc limit ${MAX_HITS})
			)
			select session_key,
				min(ts) as first_ts,
				to_char(max(ts) at time zone ${TZ}, 'Mon FMDD, YYYY · FMHH12:MI AM') || ' PT' as when,
				(array_agg(machine order by ts desc))[1] as machine,
				(array_agg(agent order by ts desc))[1] as agent,
				array_remove(array_agg(distinct query_text), null) as queries
			from hits
			where session_key is not null
			group by session_key
			order by max(ts) desc
			limit ${MAX_SESSIONS}`;
		if (!sessions.length) return { q, sessions: [], ms: elapsed(started) };

		const keys = sessions.map((s) => s.session_key);
		const firsts = sessions.map((s) => s.first_ts.toISOString());

		// 2. Pages seen in each session from the first match on: opened pages before result lists.
		// 3. For URL-only matches, the searches that led there (context chips).
		const [pages, context] = await Promise.all([
			sql<{ session_key: string; url: string; domain: string | null }[]>`
				select session_key, url, domain from (
					select e.session_key, u.display_url as url, u.reg_domain as domain,
						row_number() over (
							partition by e.session_key
							order by min(case when u.occurrence_kind = 'search_result' then 1 else 0 end), min(e.ts)
						) as rn
					from unnest(${keys}::text[], ${firsts}::timestamptz[]) as k(key, first_ts)
					join hackathon_agent_data.demo_events e on e.session_key = k.key and e.ts >= k.first_ts
					join hackathon_agent_data.demo_urls u on u.event_id = e.id
					where u.display_url is not null
					group by e.session_key, u.display_url, u.reg_domain
				) x
				where rn <= ${MAX_PAGES}
				order by session_key, rn`,
			sql<{ session_key: string; query_text: string }[]>`
				select session_key, query_text from (
					select e.session_key, e.query_text,
						row_number() over (partition by e.session_key order by max(e.ts) desc) as rn
					from unnest(${keys}::text[], ${firsts}::timestamptz[]) as k(key, first_ts)
					join hackathon_agent_data.demo_events e on e.session_key = k.key and e.ts <= k.first_ts
					where e.event_type = 'search_operation' and e.query_text is not null and e.ts is not null
					group by e.session_key, e.query_text
				) x
				where rn <= 3`,
		]);

		const pagesBy = new Map<string, RecallSession["pages"]>();
		for (const p of pages) {
			const list = pagesBy.get(p.session_key) ?? [];
			list.push({ url: p.url, domain: p.domain });
			pagesBy.set(p.session_key, list);
		}
		const contextBy = new Map<string, string[]>();
		for (const c of context) {
			const list = contextBy.get(c.session_key) ?? [];
			list.push(c.query_text);
			contextBy.set(c.session_key, list);
		}

		return {
			q,
			ms: elapsed(started),
			sessions: sessions.map((s) => {
				const matched = s.queries ?? [];
				return {
					sessionKey: s.session_key,
					when: s.when,
					machine: s.machine,
					agent: s.agent,
					queries: matched.length
						? matched
						: (contextBy.get(s.session_key) ?? []),
					matchedQueries: matched.length > 0,
					pages: pagesBy.get(s.session_key) ?? [],
				};
			}),
		};
	});

function elapsed(t0: number) {
	return Math.round(performance.now() - t0);
}

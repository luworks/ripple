import { createServerFn } from "@tanstack/react-start";

// Agent Memory reads only demo-safe data: the materialized views from
// db/agent-memory/demo-safe.sql (demo_events / demo_urls) and the research agent's
// own runs (public.research_runs), filtered through demo_text_unsafe().

const TZ = "America/Los_Angeles";
// URLs an agent actually opened, not every link listed in search results.
const PAGE_KINDS = ["open_target", "page_reference"];
// Our own smoke tests of the research agent ("cap test a1 9983", "please fail 9298").
const TEST_RUN = "\\m(test|fail)\\M.*\\d{4,}\\s*$";

export type Strata = {
	searches: number;
	pages: number;
	machines: number;
	days: { day: string; n: number }[]; // every PT day from first to today, zeros included
};

export type Page = { url: string; title?: string; note?: string };
export type Hit = { at: string; text: string; engine: string };
export type Cluster = {
	id: string;
	kind: "agent" | "research";
	title: string;
	who: string;
	start: string;
	end: string;
	searches: Hit[];
	pages: Page[];
};
export type Today = { now: string; clusters: Cluster[] };

let strata: Promise<Strata> | undefined;

// The imported snapshot is static; research runs add a handful per day, so the strip is
// computed once per process and today's research calls are added by getToday().
export const getStrata = createServerFn({ method: "GET" }).handler(
	async (): Promise<Strata> => {
		strata ??= (async () => {
			const { db } = await import("../db");
			const sql = db();
			const [totals, daily, runs] = await Promise.all([
				sql`select
					(select count(*) from hackathon_agent_data.demo_events where event_type = 'search_operation')::int as searches,
					(select count(*) from hackathon_agent_data.demo_urls where occurrence_kind = any(${PAGE_KINDS}))::int as pages,
					(select count(distinct machine) from hackathon_agent_data.demo_events)::int as machines`,
				sql`select to_char((ts at time zone ${TZ})::date, 'YYYY-MM-DD') as day, count(*)::int as n
					from hackathon_agent_data.demo_events
					where event_type = 'search_operation' and ts is not null
					group by 1`,
				sql`select to_char(((e->>'at')::timestamptz at time zone ${TZ})::date, 'YYYY-MM-DD') as day, count(*)::int as n
					from public.research_runs r, jsonb_array_elements(r.events) e
					where e->>'kind' = 'tool' and e->>'text' ~ '^(tavily|telem|telem_hack)\\.'
						and r.query !~* ${TEST_RUN}
					group by 1`,
			]);
			const byDay = new Map<string, number>();
			for (const r of [...daily, ...runs])
				byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.n);
			const first = [...byDay.keys()].sort()[0];
			const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(
				new Date(),
			);
			const days: Strata["days"] = [];
			for (
				let d = new Date(`${first}T12:00:00Z`);
				d.toISOString().slice(0, 10) <= today;
				d.setUTCDate(d.getUTCDate() + 1)
			) {
				const day = d.toISOString().slice(0, 10);
				days.push({ day, n: byDay.get(day) ?? 0 });
			}
			const runTotal = runs.reduce((s, r) => s + r.n, 0);
			return {
				searches: totals[0].searches + runTotal,
				pages: totals[0].pages,
				machines: totals[0].machines,
				days,
			};
		})().catch((err) => {
			strata = undefined;
			throw err;
		});
		return strata;
	},
);

const ENGINE: Record<string, string> = {
	tavily: "Tavily",
	telem: "Telem",
	telem_hack: "Telem",
};
const AGENT: Record<string, string> = {
	claude: "Claude Code",
	codex: "Codex",
	t3: "T3",
	opencode: "OpenCode",
};

type ResultItem = { url?: string; headline?: string; detail?: string };

// Today's searches, grouped into one cluster per agent session or research run.
// Not cached: the page polls it so new research-agent searches show up live.
export const getToday = createServerFn({ method: "GET" }).handler(
	async (): Promise<Today> => {
		const { db } = await import("../db");
		const sql = db();
		const start = sql`date_trunc('day', now() at time zone ${TZ}) at time zone ${TZ}`;
		const [agentHits, agentPages, runs, runHits] = await Promise.all([
			sql`select session_key, ts, agent, machine, query_text
				from hackathon_agent_data.demo_events
				where event_type = 'search_operation' and query_text is not null and ts >= ${start}
				order by ts`,
			sql`select e.session_key, u.display_url, min(e.ts) as ts
				from hackathon_agent_data.demo_events e
				join hackathon_agent_data.demo_urls u on u.event_id = e.id
				where e.ts >= ${start} and u.display_url is not null
					and u.occurrence_kind = any(${PAGE_KINDS})
				group by 1, 2 order by 3`,
			sql`select id, query, created_at, finished_at, result,
					hackathon_agent_data.demo_text_unsafe(query) as hidden
				from public.research_runs where created_at >= ${start} and query !~* ${TEST_RUN}`,
			sql`select r.id, (e->>'at')::timestamptz as at, e->>'text' as text
				from public.research_runs r, jsonb_array_elements(r.events) e
				where r.created_at >= ${start} and e->>'kind' = 'tool'
					and e->>'text' ~ '^(tavily|telem|telem_hack)\\.'
					and not hackathon_agent_data.demo_text_unsafe(e->>'text')
				order by 2`,
		]);

		const clusters = new Map<string, Cluster>();
		for (const h of agentHits) {
			const at = new Date(h.ts).toISOString();
			let c = clusters.get(h.session_key);
			if (!c) {
				c = {
					id: h.session_key,
					kind: "agent",
					title: h.query_text,
					who: `${AGENT[h.agent] ?? h.agent} · ${h.machine}`,
					start: at,
					end: at,
					searches: [],
					pages: [],
				};
				clusters.set(h.session_key, c);
			}
			c.end = at;
			if (!c.searches.some((s) => s.text === h.query_text))
				c.searches.push({ at, text: h.query_text, engine: "web" });
		}
		for (const p of agentPages) {
			const c = clusters.get(p.session_key);
			if (c && c.pages.length < 12) c.pages.push({ url: p.display_url });
		}

		for (const r of runs) {
			const items = (r.result?.timeline as ResultItem[] | undefined) ?? [];
			const seen = new Set<string>();
			const pages: Page[] = [];
			for (const it of items) {
				if (!it.url || seen.has(it.url) || pages.length >= 12) continue;
				seen.add(it.url);
				pages.push({
					url: it.url.replace(/^[a-z]+:\/\//i, "").replace(/[?#].*$/, ""),
					title: it.headline,
					note: it.detail,
				});
			}
			const at = new Date(r.created_at).toISOString();
			clusters.set(`run:${r.id}`, {
				id: `run:${r.id}`,
				kind: "research",
				title: r.hidden ? "Hidden query" : r.query,
				who: "Research agent",
				start: at,
				end: r.finished_at ? new Date(r.finished_at).toISOString() : at,
				searches: [],
				pages: r.hidden ? [] : pages,
			});
		}
		for (const h of runHits) {
			const c = clusters.get(`run:${h.id}`);
			if (!c) continue;
			const m = /^([a-z_]+)\.[a-z_]+: (.*)$/.exec(h.text);
			const at = new Date(h.at).toISOString();
			c.searches.push({
				at,
				text: m?.[2] ?? h.text,
				engine: ENGINE[m?.[1] ?? ""] ?? "web",
			});
			if (at > c.end) c.end = at;
		}

		return {
			now: new Date().toISOString(),
			clusters: [...clusters.values()]
				.filter((c) => c.searches.length > 0)
				.sort((a, b) => b.start.localeCompare(a.start)),
		};
	},
);

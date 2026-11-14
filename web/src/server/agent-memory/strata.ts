import { createServerFn } from "@tanstack/react-start";
import type postgres from "postgres";

// Agent Memory reads only demo-safe data: the materialized views from
// db/agent-memory/demo-safe.sql (demo_events / demo_urls) and the research agent's
// own runs (public.research_runs), filtered through demo_text_unsafe().

const TZ = "America/Los_Angeles";
// URLs an agent actually opened, not every link listed in search results.
const PAGE_KINDS = ["open_target", "page_reference"];
// URLs that say where a search went: its results plus the pages opened.
const DOMAIN_KINDS = ["search_result", ...PAGE_KINDS];
// Our own smoke tests of the research agent ("cap test a1 9983", "please fail 9298").
const TEST_RUN = "\\m(test|fail)\\M.*\\d{4,}\\s*$";
const SEARCH_TOOL = "^(tavily|telem|telem_hack)\\.[a-z_]*search";

export type Strata = {
	searches: number;
	pages: number;
	machines: number;
	first: string; // first PT day with a search, YYYY-MM-DD
};

export type Grain = "15m" | "hour" | "day";
// One bar per PT bucket ("YYYY-MM-DDTHH:MI"), split by who ran the search.
export type Bucket = { t: string; web: number; tavily: number; telem: number };
export type Series = { grain: Grain; rows: Bucket[] };
export type Detail = {
	t: string;
	domains: { d: string; n: number }[];
	queries: { text: string; engine: string; n: number }[];
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

const STEP: Record<Grain, string> = {
	"15m": "15 minutes",
	hour: "1 hour",
	day: "1 day",
};
// How far back each grain reaches; "day" goes back to the first search.
const SPAN: Record<Grain, string> = {
	"15m": "2 days",
	hour: "7 days",
	day: "10 years",
};
const grainOf = (g: unknown): Grain =>
	g === "15m" || g === "hour" ? g : "day";

type Sql = ReturnType<typeof import("../db").db>;
async function getSql(): Promise<Sql> {
	const { db } = await import("../db");
	return db();
}

// Every research-agent search as (at, engine, query text): one row per query, since a
// Telem call can carry several. Text is null when it fails the privacy filter.
const researchSearches = (
	sql: Sql,
	from: string | Date | postgres.PendingQuery<postgres.Row[]>,
) => sql`
	select (e->>'at')::timestamptz as at,
		case when e->>'text' like 'tavily.%' then 'Tavily' else 'Telem' end as engine,
		case when hackathon_agent_data.demo_text_unsafe(q) then null else q end as text,
		r.id as run
	from public.research_runs r
	cross join jsonb_array_elements(r.events) e
	cross join jsonb_array_elements_text(
		case when jsonb_typeof(e->'call'->'queries') = 'array'
				and jsonb_array_length(e->'call'->'queries') > 0
			then e->'call'->'queries'
			else jsonb_build_array(substring(e->>'text' from ': (.*)$')) end) q
	where r.created_at >= ${from}::timestamptz - interval '1 day'
		and e->>'kind' = 'tool' and e->>'text' ~ ${SEARCH_TOOL}
		and r.query !~* ${TEST_RUN}`;

let strata: Promise<Omit<Strata, "searches"> & { agent: number }> | undefined;

// Totals: the static agent snapshot (cached) plus every research-agent search so far.
export const getStrata = createServerFn({ method: "GET" }).handler(
	async (): Promise<Strata> => {
		const sql = await getSql();
		strata ??= (async () => {
			const [r] = await sql`select
				(select count(*) from hackathon_agent_data.demo_events where event_type = 'search_operation')::int as agent,
				(select count(*) from hackathon_agent_data.demo_urls where occurrence_kind = any(${PAGE_KINDS}))::int as pages,
				(select count(distinct machine) from hackathon_agent_data.demo_events)::int as machines,
				(select to_char((min(ts) at time zone ${TZ})::date, 'YYYY-MM-DD')
					from hackathon_agent_data.demo_events where event_type = 'search_operation') as first`;
			return r as Omit<Strata, "searches"> & { agent: number };
		})().catch((err) => {
			strata = undefined;
			throw err;
		});
		const [{ agent, ...s }, [runs]] = await Promise.all([
			strata,
			sql`select count(*)::int as n from (${researchSearches(sql, "-infinity")}) x`,
		]);
		return { ...s, searches: agent + runs.n };
	},
);

// Searches per bucket for one grain, every bucket filled (zeros included), oldest first.
export const getSeries = createServerFn({ method: "GET" })
	.validator((d: { grain: Grain }) => ({ grain: grainOf(d?.grain) }))
	.handler(async ({ data }): Promise<Series> => {
		const sql = await getSql();
		const step = STEP[data.grain];
		const origin = "2000-01-01";
		const rows = await sql`
			with lo as (
				select greatest(now() - ${SPAN[data.grain]}::interval,
					(select min(ts) from hackathon_agent_data.demo_events where event_type = 'search_operation')) as ts
			),
			hits as (
				select ts as at, 'web' as engine from hackathon_agent_data.demo_events
				where event_type = 'search_operation' and ts >= (select ts from lo)
				union all
				select at, engine from (${researchSearches(sql, sql`(select ts from lo)`)}) r
				where at >= (select ts from lo)
			),
			binned as (
				select date_bin(${step}::interval, at at time zone ${TZ}, ${origin}::timestamp) as t, engine
				from hits
			),
			b as (
				select generate_series(
					date_bin(${step}::interval, (select ts from lo) at time zone ${TZ}, ${origin}::timestamp),
					date_bin(${step}::interval, now() at time zone ${TZ}, ${origin}::timestamp),
					${step}::interval) as t
			)
			select to_char(b.t, 'YYYY-MM-DD"T"HH24:MI') as t,
				count(x.engine) filter (where x.engine = 'web')::int as web,
				count(x.engine) filter (where x.engine = 'Tavily')::int as tavily,
				count(x.engine) filter (where x.engine = 'Telem')::int as telem
			from b left join binned x on x.t = b.t
			group by b.t order by b.t`;
		return { grain: data.grain, rows: rows as unknown as Bucket[] };
	});

// One bucket's top domains and most repeated queries. Without t: the latest bucket.
export const getDetail = createServerFn({ method: "GET" })
	.validator((d: { grain: Grain; t?: string }) => ({
		grain: grainOf(d?.grain),
		t: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d?.t ?? "") ? d.t : undefined,
	}))
	.handler(async ({ data }): Promise<Detail> => {
		const sql = await getSql();
		const step = STEP[data.grain];
		const local = data.t
			? sql`${data.t}::timestamp`
			: sql`date_bin(${step}::interval, now() at time zone ${TZ}, '2000-01-01'::timestamp)`;
		const [range] = await sql`select ${local} at time zone ${TZ} as "from",
			(${local} + ${step}::interval) at time zone ${TZ} as "to",
			to_char(${local}, 'YYYY-MM-DD"T"HH24:MI') as t`;
		const { from, to } = range;
		const [domains, queries] = await Promise.all([
			sql`select d, sum(n)::int as n from (
					select u.reg_domain as d, count(*) as n
					from hackathon_agent_data.demo_events e
					join hackathon_agent_data.demo_urls u on u.event_id = e.id
					where e.ts >= ${from} and e.ts < ${to}
						and u.reg_domain is not null and not coalesce(u.url_hidden, false)
						and u.occurrence_kind = any(${DOMAIN_KINDS})
					group by 1
					union all
					select regexp_replace(substring(h->>1 from '^[a-z]+://([^/?#:]+)'), '^www\\.', '') as d, count(*) as n
					from public.research_runs r
					cross join jsonb_array_elements(r.events) e
					cross join jsonb_array_elements(
						case when jsonb_typeof(e->'call'->'hits') = 'array' then e->'call'->'hits' else '[]'::jsonb end) h
					where r.created_at >= ${from}::timestamptz - interval '1 day' and r.created_at < ${to}
						and (e->>'at')::timestamptz >= ${from} and (e->>'at')::timestamptz < ${to}
						and e->>'kind' = 'result' and r.query !~* ${TEST_RUN}
						and not hackathon_agent_data.demo_text_unsafe(r.query)
					group by 1
				) x where d is not null and d <> '' group by d order by n desc, d limit 5`,
			sql`select text, engine, count(*)::int as n from (
					select query_text as text, 'web' as engine, ts as at
					from hackathon_agent_data.demo_events
					where event_type = 'search_operation' and query_text is not null
						and ts >= ${from} and ts < ${to}
					union all
					select text, engine, at from (${researchSearches(sql, from)}) r
					where text is not null and at >= ${from} and at < ${to}
				) q group by 1, 2 order by n desc, max(at) desc limit 6`,
		]);
		return {
			t: range.t,
			domains: domains as unknown as Detail["domains"],
			queries: queries as unknown as Detail["queries"],
		};
	});

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
		const sql = await getSql();
		const [{ start }] =
			await sql`select date_trunc('day', now() at time zone ${TZ}) at time zone ${TZ} as start`;
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
			sql`select run, at, engine, text from (${researchSearches(sql, start)}) r
				where text is not null and at >= ${start} order by at`,
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
			const c = clusters.get(`run:${h.run}`);
			if (!c) continue;
			const at = new Date(h.at).toISOString();
			if (!c.searches.some((s) => s.text === h.text))
				c.searches.push({ at, text: h.text, engine: h.engine });
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

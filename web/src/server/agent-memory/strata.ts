import { createServerFn } from "@tanstack/react-start";
import type postgres from "postgres";

// Agent Memory reads only demo-safe data: the materialized views from
// db/agent-memory/demo-safe.sql (demo_events / demo_urls) and the research agent's
// own runs (public.research_runs), filtered through demo_text_unsafe().

const TZ = "America/Los_Angeles";
// The page starts here (a PT day): nothing earlier is shown or sent to the browser.
const SINCE = "2026-09-01";
// URLs an agent actually opened, not every link listed in search results.
const PAGE_KINDS = ["open_target", "page_reference"];
// URLs that say where a search went: its results plus the pages opened.
const DOMAIN_KINDS = ["search_result", ...PAGE_KINDS];
// Our own smoke tests of the research agent ("cap test a1 9983", "please fail 9298").
const TEST_RUN = "\\m(test|fail)\\M.*\\d{4,}\\s*$";
const SEARCH_TOOL = "^(tavily|telem|telem_hack)\\.[a-z_]*search";
// Every Telem / Tavily call (search or fetch): what memory recall is measured against.
const WEB_CALL = "^(tavily|telem|telem_hack)\\.";
const MAX_SESSIONS = 8;

// Who ran a search: a coding agent's built-in web search, or our research agent
// calling Telem / Tavily for a question someone asked on /research.
export type Source = "Claude Code" | "Codex" | "Telem" | "Tavily";
const AGENT_SOURCE =
	"case agent when 'claude' then 'Claude Code' when 'codex' then 'Codex' else agent end";

export type Strata = {
	searches: number;
	pages: number;
	machines: number;
	first: string; // first PT day with a search, YYYY-MM-DD
	memoryRuns: number; // research runs that started from memory
	saved: number; // net web calls those runs skipped against a typical run
};

export type Grain = "15m" | "hour" | "day";
// One bar per PT bucket ("YYYY-MM-DDTHH:MI"), split by who ran the search.
export type Bucket = {
	t: string;
	claude: number;
	codex: number;
	telem: number;
	tavily: number;
};
export type Series = { grain: Grain; rows: Bucket[] };

export type Page = { url: string; title?: string; note?: string };
export type Hit = { at: string; text: string; engine: string };
export type Cluster = {
	id: string;
	kind: "agent" | "research";
	title: string;
	who: string;
	start: string;
	end: string;
	n: number; // searches in this bucket, before de-duplicating texts
	searches: Hit[];
	pages: Page[];
	memory?: MemoryHit;
};
// A research run that started from memory: what recall matched and what it saved.
export type MemoryHit = {
	matched: number; // earlier runs recalled
	best: number; // best similarity
	reused: number; // timeline sources that came from memory
	calls: number; // Telem / Tavily calls this run made
	typicalCalls: number | null;
	secs: number | null;
	typicalSecs: number | null;
};
export type Detail = {
	t: string;
	domains: { d: string; n: number }[];
	queries: { text: string; engine: string; n: number }[];
	sessions: Cluster[];
};

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
type Ts = string | Date | postgres.PendingQuery<postgres.Row[]>;
const sinceTs = (sql: Sql) => sql`(${SINCE}::timestamp at time zone ${TZ})`;
async function getSql(): Promise<Sql> {
	const { db } = await import("../db");
	return db();
}

// Every research-agent search as (at, engine, query text): one row per query, since a
// Telem call can carry several. Text is null when it fails the privacy filter.
const researchSearches = (sql: Sql, from: Ts) => sql`
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

type Static = Omit<Strata, "searches" | "memoryRuns" | "saved"> & {
	agent: number;
};
let strata: Promise<Static> | undefined;

// Totals: the static agent snapshot (cached) plus every research-agent search so far.
export const getStrata = createServerFn({ method: "GET" }).handler(
	async (): Promise<Strata> => {
		const sql = await getSql();
		strata ??= (async () => {
			const since = sinceTs(sql);
			const [r] = await sql`select
				(select count(*) from hackathon_agent_data.demo_events
					where event_type = 'search_operation' and ts >= ${since})::int as agent,
				(select count(*) from hackathon_agent_data.demo_urls u
					join hackathon_agent_data.demo_events e on e.id = u.event_id
					where u.occurrence_kind = any(${PAGE_KINDS}) and e.ts >= ${since})::int as pages,
				(select count(distinct machine) from hackathon_agent_data.demo_events
					where ts >= ${since})::int as machines,
				(select to_char((min(ts) at time zone ${TZ})::date, 'YYYY-MM-DD')
					from hackathon_agent_data.demo_events
					where event_type = 'search_operation' and ts >= ${since}) as first`;
			return r as Static;
		})().catch((err) => {
			strata = undefined;
			throw err;
		});
		const [{ agent, ...s }, [runs], [mem]] = await Promise.all([
			strata,
			sql`select count(*)::int as n from (${researchSearches(sql, sinceTs(sql))}) x
				where at >= ${sinceTs(sql)}`,
			sql`select count(*)::int as runs,
					coalesce(sum((m->'baseline'->>'searchCalls')::int - (
						select count(*) from jsonb_array_elements(r.events) e
						where e->>'kind' = 'tool' and e->>'text' ~ ${WEB_CALL})), 0)::int as saved
				from public.research_runs r
				cross join lateral (select e->'memory' as m from jsonb_array_elements(r.events) e
					where e->>'kind' = 'memory' limit 1) x
				where r.status = 'done' and r.query !~* ${TEST_RUN}
					and r.created_at >= ${sinceTs(sql)}
					and jsonb_array_length(coalesce(m->'runs', '[]')) > 0`,
		]);
		return {
			...s,
			searches: agent + runs.n,
			memoryRuns: mem.runs,
			saved: mem.saved,
		};
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
				select greatest(now() - ${SPAN[data.grain]}::interval, ${sinceTs(sql)},
					(select min(ts) from hackathon_agent_data.demo_events where event_type = 'search_operation')) as ts
			),
			hits as (
				select ts as at, ${sql.unsafe(AGENT_SOURCE)} as engine from hackathon_agent_data.demo_events
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
				count(x.engine) filter (where x.engine = 'Claude Code')::int as claude,
				count(x.engine) filter (where x.engine = 'Codex')::int as codex,
				count(x.engine) filter (where x.engine = 'Telem')::int as telem,
				count(x.engine) filter (where x.engine = 'Tavily')::int as tavily
			from b left join binned x on x.t = b.t
			group by b.t order by b.t`;
		return { grain: data.grain, rows: rows as unknown as Bucket[] };
	});

// One bucket: top domains, most repeated queries, and the sessions / research runs in it.
// Without t: the latest bucket.
export const getDetail = createServerFn({ method: "GET" })
	.validator((d: { grain: Grain; t?: string }) => {
		const t = d?.t ?? "";
		return {
			grain: grainOf(d?.grain),
			// Buckets before SINCE fall back to the latest one.
			t:
				/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t) && t >= SINCE ? t : undefined,
		};
	})
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
		const [domains, queries, sessions] = await Promise.all([
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
					select query_text as text, ${sql.unsafe(AGENT_SOURCE)} as engine, ts as at
					from hackathon_agent_data.demo_events
					where event_type = 'search_operation' and query_text is not null
						and ts >= ${from} and ts < ${to}
					union all
					select text, engine, at from (${researchSearches(sql, from)}) r
					where text is not null and at >= ${from} and at < ${to}
				) q group by 1, 2 order by n desc, max(at) desc limit 6`,
			sessionsIn(sql, from, to),
		]);
		return {
			t: range.t,
			domains: domains as unknown as Detail["domains"],
			queries: queries as unknown as Detail["queries"],
			sessions,
		};
	});

const AGENT: Record<string, string> = {
	claude: "Claude Code",
	codex: "Codex",
};

type ResultItem = { url?: string; headline?: string; detail?: string };
const iso = (d: Date | string) => new Date(d).toISOString();

// The most recent agent sessions and research runs with searches in [from, to):
// what each searched, and the pages it kept (research runs add a headline + summary).
async function sessionsIn(sql: Sql, from: Date, to: Date): Promise<Cluster[]> {
	const [agentSessions, runs] = await Promise.all([
		sql`with s as (
				-- A session synced to several machines is one session: name one machine and
				-- count each search once.
				select session_key, min(agent) as agent, min(machine) as machine, min(ts) as start,
					max(ts) as "end", count(distinct (ts, query_text))::int as n
				from hackathon_agent_data.demo_events
				where event_type = 'search_operation' and query_text is not null
					and ts >= ${from} and ts < ${to}
				group by 1 order by max(ts) desc limit ${MAX_SESSIONS}
			)
			select s.*,
				(select json_agg(q order by q.at) from (
					select query_text as text, min(ts) as at
					from hackathon_agent_data.demo_events e
					where e.session_key = s.session_key and e.event_type = 'search_operation'
						and e.query_text is not null and e.ts >= ${from} and e.ts < ${to}
					group by 1 order by 2 limit 30) q) as hits,
				(select json_agg(p.display_url) from (
					select u.display_url, min(e.ts)
					from hackathon_agent_data.demo_events e
					join hackathon_agent_data.demo_urls u on u.event_id = e.id
					where e.session_key = s.session_key and e.ts >= ${from} and e.ts < ${to}
						and u.display_url is not null and u.occurrence_kind = any(${PAGE_KINDS})
					group by 1 order by 2 limit 12) p) as pages
			from s`,
		sql`select r.id, r.query, r.created_at, r.finished_at, r.result, r.duration_ms,
				hackathon_agent_data.demo_text_unsafe(r.query) as hidden,
				(select e->'memory' from jsonb_array_elements(r.events) e
					where e->>'kind' = 'memory' limit 1) as memory,
				(select count(*) from jsonb_array_elements(r.events) e
					where e->>'kind' = 'tool' and e->>'text' ~ ${WEB_CALL})::int as calls
			from public.research_runs r
			where r.query !~* ${TEST_RUN}
				and exists (select 1 from jsonb_array_elements(r.events) e
					where (e->>'kind' = 'tool' and e->>'text' ~ ${SEARCH_TOOL}
							or e->>'kind' = 'memory' and jsonb_array_length(coalesce(e->'memory'->'runs', '[]')) > 0)
						and (e->>'at')::timestamptz >= ${from} and (e->>'at')::timestamptz < ${to})
				and r.created_at >= ${from}::timestamptz - interval '1 day' and r.created_at < ${to}
			order by r.created_at desc limit ${MAX_SESSIONS}`,
	]);
	const runIds = runs.map((r) => r.id as string);
	const runHits = runIds.length
		? await sql`select run, at, engine, text from (${researchSearches(sql, from)}) r
				where at >= ${from} and at < ${to} and run = any(${runIds}) order by at`
		: [];

	const out: Cluster[] = agentSessions.map((s) => {
		const who = AGENT[s.agent] ?? s.agent;
		return {
			id: s.session_key,
			kind: "agent",
			title: s.hits?.[0]?.text ?? "Search",
			who: `${who} · ${s.machine}`,
			start: iso(s.start),
			end: iso(s.end),
			n: s.n,
			searches: (s.hits ?? []).map((h: { text: string; at: string }) => ({
				at: iso(h.at),
				text: h.text,
				engine: who,
			})),
			pages: (s.pages ?? []).map((url: string) => ({ url })),
		};
	});
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
		const hits = runHits.filter((h) => h.run === r.id);
		const searches: Hit[] = [];
		for (const h of hits)
			if (h.text && !searches.some((s) => s.text === h.text))
				searches.push({ at: iso(h.at), text: h.text, engine: h.engine });
		const start = hits[0] ? iso(hits[0].at) : iso(r.created_at);
		out.push({
			id: `run:${r.id}`,
			kind: "research",
			title: r.hidden ? "Hidden question" : r.query,
			who: "Research agent · asked on /research",
			start,
			end: r.finished_at ? iso(r.finished_at) : start,
			n: hits.length,
			searches,
			pages: r.hidden ? [] : pages,
			memory: memoryHit(r, items),
		});
	}
	return out.sort((a, b) => b.end.localeCompare(a.end)).slice(0, MAX_SESSIONS);
}

type MemoryTraceRow = {
	runs?: { similarity: number }[];
	best?: number;
	urls?: string[];
	baseline?: { searchCalls: number; durationMs: number } | null;
};

function memoryHit(
	r: postgres.Row,
	items: ResultItem[],
): MemoryHit | undefined {
	const m = r.memory as MemoryTraceRow | null;
	if (!m?.runs?.length) return undefined;
	const known = new Set(m.urls ?? []);
	const b = m.baseline;
	return {
		matched: m.runs.length,
		best: m.best ?? Math.max(...m.runs.map((x) => x.similarity)),
		reused: items.filter((it) => it.url && known.has(it.url)).length,
		calls: r.calls,
		typicalCalls: b ? b.searchCalls : null,
		secs: r.duration_ms != null ? Math.round(r.duration_ms / 1000) : null,
		typicalSecs: b ? Math.round(b.durationMs / 1000) : null,
	};
}

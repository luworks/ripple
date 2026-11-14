// Memory-first research: before the agent searches, find earlier finished runs about the
// same event and hand it their verified sources, so it only searches for what is new.
// Matching is semantic (OpenAI embeddings over each run's whole result), so
// "黄仁勋辞职" finds "Jensen Huang resigns as Nvidia CEO".
import { db } from "./db";
import type { MemoryTrace, ResearchResult } from "./research-types";

const MODEL = "text-embedding-3-large";
// Calibrated on our runs: same event scores 0.45–0.68, unrelated events stay under 0.32.
const MIN_SIM = 0.42;
const BAND = 0.05; // keep only runs within this of the best match
const MAX_RUNS = 3;
const MAX_ITEMS = 15;
const MAX_CANDIDATES = 200;
const TEST_RUN = "(^QA([[:space:]]|:)|\\m(test|fail)\\M.*\\d{4,}\\s*$)";
const SEARCH_TOOL = "^(tavily|telem|telem_hack)\\.";
// Only real agent runs: the Docker runner always emits this event.
const REAL = [{ text: "Starting agent container" }];

// Run embeddings never change, so keep them for the life of the process.
const g = globalThis as unknown as { __memoryEmb?: Map<string, number[]> };
g.__memoryEmb ??= new Map();
const cache = g.__memoryEmb;

async function embed(input: string[]): Promise<number[][]> {
	const res = await fetch("https://api.openai.com/v1/embeddings", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
		},
		body: JSON.stringify({ model: MODEL, input }),
		signal: AbortSignal.timeout(10_000),
	});
	if (!res.ok) throw new Error(`embeddings ${res.status}`);
	const j = (await res.json()) as { data: { embedding: number[] }[] };
	return j.data.map((d) => d.embedding);
}

const dot = (a: number[], b: number[]) =>
	a.reduce((s, x, i) => s + x * b[i], 0);

function doc(query: string, r: ResearchResult) {
	return [
		query,
		r.event.title,
		r.event.summary,
		r.people.map((p) => p.name).join(", "),
		r.tickers.map((t) => `${t.symbol} ${t.name}`).join(", "),
	].join("\n");
}

const clip = (s: string, n: number) =>
	s.length > n ? `${s.slice(0, n - 1)}…` : s;

export type Recall = { trace: MemoryTrace; prompt: string };

export async function recall(query: string): Promise<Recall | null> {
	if (!process.env.OPENAI_API_KEY) return null;
	const t0 = Date.now();
	const sql = db();
	const [rows, [base]] = await Promise.all([
		sql`select id, query, created_at, result from research_runs
			where status = 'done' and result is not null and query !~* ${TEST_RUN}
				and events @> ${sql.json(REAL)}
			order by created_at desc limit ${MAX_CANDIDATES}`,
		sql`select count(*)::int as runs,
				percentile_cont(0.5) within group (order by n) as search_calls,
				percentile_cont(0.5) within group (order by duration_ms) as duration_ms
			from (
				select duration_ms, (select count(*) from jsonb_array_elements(events) e
					where e->>'kind' = 'tool' and e->>'text' ~ ${SEARCH_TOOL}) as n
				from research_runs
				where status = 'done' and query !~* ${TEST_RUN} and events @> ${sql.json(REAL)}
					and not exists (select 1 from jsonb_array_elements(events) e
						where e->>'kind' = 'memory'
							and jsonb_array_length(e->'memory'->'runs') > 0)
			) t`,
	]);
	const baseline = base?.runs
		? {
				runs: base.runs as number,
				searchCalls: Math.round(Number(base.search_calls)),
				durationMs: Math.round(Number(base.duration_ms)),
			}
		: null;

	const missing = rows.filter((r) => !cache.has(r.id));
	const vecs = await embed([
		query,
		...missing.map((r) => doc(r.query, r.result as ResearchResult)),
	]);
	missing.forEach((r, i) => {
		cache.set(r.id, vecs[i + 1]);
	});
	const scored = rows
		.map((r) => ({ r, s: dot(vecs[0], cache.get(r.id) as number[]) }))
		.sort((a, b) => b.s - a.s);
	const best = scored[0]?.s ?? 0;
	const hits =
		best < MIN_SIM
			? []
			: scored.filter((x) => x.s >= best - BAND).slice(0, MAX_RUNS);

	// Newest run first, so its version of a shared source wins.
	hits.sort((a, b) => +new Date(b.r.created_at) - +new Date(a.r.created_at));
	const items = new Map<string, ResearchResult["timeline"][number]>();
	const tickers = new Map<string, ResearchResult["tickers"][number]>();
	const people = new Map<string, ResearchResult["people"][number]>();
	for (const { r } of hits) {
		const res = r.result as ResearchResult;
		for (const it of res.timeline)
			if (it.url && items.size < MAX_ITEMS && !items.has(it.url))
				items.set(it.url, it);
		for (const t of res.tickers)
			if (!tickers.has(t.symbol)) tickers.set(t.symbol, t);
		for (const p of res.people) if (!people.has(p.name)) people.set(p.name, p);
	}

	const trace: MemoryTrace = {
		runs: hits.map(({ r, s }) => ({
			id: r.id,
			query: r.query,
			at: new Date(r.created_at).toISOString(),
			similarity: Math.round(s * 100) / 100,
		})),
		best: Math.round(best * 100) / 100,
		urls: [...items.keys()],
		tickers: tickers.size,
		ms: Date.now() - t0,
		baseline,
	};
	if (!hits.length) return { trace, prompt: "" };

	const timeline = [...items.values()].sort((a, b) =>
		a.time.localeCompare(b.time),
	);
	const prompt = [
		"<memory>",
		"Earlier research runs from our own memory that look like the same event:",
		...trace.runs.map((r) => `- "${r.query}" (researched ${r.at})`),
		"",
		"Timeline items those runs verified (publish time | kind | source | headline — detail | url):",
		...timeline.map(
			(t) =>
				`- ${t.time} | ${t.kind} | ${t.source} | ${clip(t.headline, 160)} — ${clip(t.detail, 200)} | ${t.url}`,
		),
		"",
		"Tickers they chose:",
		...[...tickers.values()].map(
			(t) =>
				`- ${t.symbol} (${t.name}, ${t.relation}): ${clip(t.rationale, 160)}`,
		),
		"",
		"People:",
		...[...people.values()].map((p) => `- ${p.name}: ${clip(p.role, 100)}`),
		"</memory>",
	].join("\n");
	return { trace, prompt };
}

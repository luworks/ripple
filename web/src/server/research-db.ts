import { db } from "./db";
import type { AgentEvent, ResearchResult } from "./research-types";

export type RunStatus = "running" | "done" | "error";

export type RunRow = {
	id: string;
	query: string;
	status: RunStatus;
	events: AgentEvent[];
	result: ResearchResult | null;
	error: string | null;
	durationMs: number | null;
	createdAt: string;
	finishedAt: string | null;
};

export type RunSummary = Omit<RunRow, "events" | "result"> & {
	title: string | null;
	result: ResearchResult | null; // only for finished runs from the real agent
};

let ready: Promise<void> | undefined;

// Idempotent schema setup, run once per process on first use.
function ensureSchema() {
	ready ??= (async () => {
		const sql = db();
		await sql`create table if not exists research_runs (
			id text primary key,
			query text not null,
			normalized_query text not null,
			status text not null check (status in ('running','done','error')),
			events jsonb not null default '[]',
			result jsonb,
			error text,
			duration_ms int,
			created_at timestamptz not null default now(),
			finished_at timestamptz
		)`;
		await sql`create index if not exists research_runs_nq_created_idx
			on research_runs (normalized_query, created_at desc)`;
		await sql`create index if not exists research_runs_created_idx
			on research_runs (created_at desc)`;
	})().catch((err) => {
		ready = undefined;
		throw err;
	});
	return ready;
}

export function normalizeQuery(q: string) {
	return q.toLowerCase().replace(/\s+/g, " ").trim();
}

function toRow(r: Record<string, unknown>): RunRow {
	return {
		id: r.id as string,
		query: r.query as string,
		status: r.status as RunStatus,
		events: (r.events as AgentEvent[]) ?? [],
		result: (r.result as ResearchResult | null) ?? null,
		error: (r.error as string | null) ?? null,
		durationMs: (r.duration_ms as number | null) ?? null,
		createdAt: new Date(r.created_at as string).toISOString(),
		finishedAt: r.finished_at
			? new Date(r.finished_at as string).toISOString()
			: null,
	};
}

export async function findCachedRun(normalized: string, withinMs: number) {
	await ensureSchema();
	const since = new Date(Date.now() - withinMs);
	const [row] = await db()`select id from research_runs
		where normalized_query = ${normalized} and status = 'done' and created_at > ${since}
		order by created_at desc limit 1`;
	return (row?.id as string | undefined) ?? null;
}

// Serialize reservations in the database so simultaneous requests cannot exceed
// the rolling 24-hour limit, including after a server restart.
export async function insertRun(
	id: string,
	query: string,
	dailyLimit?: number,
) {
	await ensureSchema();
	return db().begin(async (tx) => {
		if (dailyLimit !== undefined) {
			await tx`select pg_advisory_xact_lock(hashtext('brain0.research.daily'))`;
			const [row] = await tx`select count(*)::int as n from research_runs
				where created_at > now() - interval '24 hours'`;
			if (row.n >= dailyLimit) return false;
		}
		await tx`insert into research_runs (id, query, normalized_query, status)
			values (${id}, ${query}, ${normalizeQuery(query)}, 'running')`;
		return true;
	});
}

export async function appendEvent(id: string, e: AgentEvent) {
	const sql = db();
	await sql`update research_runs set events = events || ${sql.json([e])}::jsonb where id = ${id}`;
}

export async function finishRun(
	id: string,
	f: {
		status: "done" | "error";
		result?: ResearchResult;
		error?: string;
		durationMs: number;
	},
) {
	const sql = db();
	await sql`update research_runs set
		status = ${f.status},
		result = ${f.result ? sql.json(f.result) : null},
		error = ${f.error ?? null},
		duration_ms = ${Math.round(f.durationMs)},
		finished_at = now()
		where id = ${id}`;
}

export async function getRun(id: string): Promise<RunRow | null> {
	await ensureSchema();
	const [row] = await db()`select * from research_runs where id = ${id}`;
	return row ? toRow(row) : null;
}

export async function listRecentRuns(limit = 20): Promise<RunSummary[]> {
	await ensureSchema();
	const rows =
		await db()`select id, query, status, error, duration_ms, created_at, finished_at,
		result->'event'->>'title' as title, case when status = 'done' then result end as result
		from research_runs
		-- Real runs only: the Docker runner always emits this event; stub/test rows never do.
		where status = 'running'
			or events @> '[{"text": "Starting agent container"}]'::jsonb
		order by created_at desc limit ${limit}`;
	return rows.map((r) => {
		const { events: _e, ...rest } = toRow(r);
		return { ...rest, title: (r.title as string | null) ?? null };
	});
}

// Server-only orchestration: starts background research runs, persists progress,
// and fans live events out to SSE subscribers in this process.
import { randomUUID } from "node:crypto";
import { runResearch } from "./agent-runner";
import { recall } from "./memory";
import { type Budget, budgetLabel, hardTimeoutMs } from "./research-budget";
import {
	appendEvent,
	findCachedRun,
	finishRun,
	insertRun,
	normalizeQuery,
} from "./research-db";
import type { AgentEvent, ResearchResult } from "./research-types";

export const MAX_QUERY_LEN = 300;
// Each agent container idles ~150 MB waiting on the network; 8 lets several demo viewers run at once.
const configuredConcurrency = Number(process.env.RESEARCH_MAX_CONCURRENT ?? 8);
const MAX_CONCURRENT =
	Number.isSafeInteger(configuredConcurrency) && configuredConcurrency > 0
		? configuredConcurrency
		: 0;
const CACHE_MS = 10 * 60 * 1000;

export type LiveMessage =
	| { type: "event"; event: AgentEvent }
	| { type: "done"; result: ResearchResult; durationMs: number }
	| { type: "error"; error: string; durationMs: number };

type Live = { listeners: Set<(m: LiveMessage) => void> };

// Survive Vite HMR module reloads in dev.
const g = globalThis as unknown as { __researchLive?: Map<string, Live> };
g.__researchLive ??= new Map<string, Live>();
const live = g.__researchLive;

export function subscribe(id: string, fn: (m: LiveMessage) => void) {
	const run = live.get(id);
	if (!run) return null;
	run.listeners.add(fn);
	return () => run.listeners.delete(fn);
}

// Memory first: look up earlier runs on the same event and pass their verified sources
// to the agent. Recall failing never blocks a run; the agent just searches from scratch.
async function withMemory(query: string, onEvent: (e: AgentEvent) => void) {
	const at = new Date().toISOString();
	try {
		const m = await recall(query);
		if (!m) return query;
		const { runs, urls, tickers, ms } = m.trace;
		onEvent({
			at,
			kind: "memory",
			text: runs.length
				? `memory → ${urls.length} verified sources and ${tickers} tickers from ${runs.length} earlier ${runs.length === 1 ? "run" : "runs"} (${ms} ms)`
				: `memory → nothing on this event yet (closest match ${m.trace.best.toFixed(2)}); searching the web (${ms} ms)`,
			memory: m.trace,
		});
		return m.prompt ? `${query}\n\n${m.prompt}` : query;
	} catch (err) {
		console.error("research memory recall", err);
		onEvent({
			at,
			kind: "memory",
			text: "memory → unavailable; searching the web",
		});
		return query;
	}
}

export type StartResult =
	| { ok: true; id: string; cached: boolean }
	| { ok: false; error: string; status: number };

export async function startResearch(
	raw: string,
	budget: Budget,
): Promise<StartResult> {
	const query = raw.trim();
	if (!query) return { ok: false, error: "Query is empty.", status: 400 };
	if (query.length > MAX_QUERY_LEN)
		return {
			ok: false,
			error: `Query is longer than ${MAX_QUERY_LEN} characters.`,
			status: 400,
		};

	const cached = await findCachedRun(normalizeQuery(query), budget, CACHE_MS);
	if (cached) return { ok: true, id: cached, cached: true };

	if (live.size >= MAX_CONCURRENT)
		return {
			ok: false,
			error: `Too many research runs in progress (max ${MAX_CONCURRENT}). Try again in a minute.`,
			status: 429,
		};

	const id = randomUUID();
	const run: Live = { listeners: new Set() };
	live.set(id, run);
	try {
		const configuredLimit = process.env.RESEARCH_DAILY_LIMIT;
		const dailyLimit =
			configuredLimit === undefined ? undefined : Number(configuredLimit);
		if (
			dailyLimit !== undefined &&
			(!Number.isSafeInteger(dailyLimit) || dailyLimit < 0)
		) {
			throw new Error("Invalid RESEARCH_DAILY_LIMIT configuration");
		}
		if (!(await insertRun(id, query, budget, dailyLimit))) {
			live.delete(id);
			return {
				ok: false,
				error: "Research limit reached. Please try again later.",
				status: 429,
			};
		}
	} catch (err) {
		live.delete(id);
		throw err;
	}
	const emit = (m: LiveMessage) => {
		for (const fn of run.listeners) fn(m);
	};

	// Background: not tied to the request lifecycle.
	void (async () => {
		const started = Date.now();
		// Serialise DB appends so events keep their order.
		let writes = Promise.resolve();
		const onEvent = (event: AgentEvent) => {
			writes = writes
				.then(() => appendEvent(id, event))
				.catch((err) => console.error("research appendEvent", err));
			emit({ type: "event", event });
		};
		onEvent({
			at: new Date().toISOString(),
			kind: "status",
			text: `Run queued; search budget ${budgetLabel(budget)}`,
		});
		let msg: LiveMessage;
		try {
			const prompt = `${await withMemory(query, onEvent)}\n\n<budget seconds="${budget}"/>`;
			const out = await runResearch(prompt, onEvent, hardTimeoutMs(budget));
			msg = out.ok
				? { type: "done", result: out.result, durationMs: out.durationMs }
				: { type: "error", error: out.error, durationMs: out.durationMs };
		} catch (err) {
			msg = {
				type: "error",
				error: err instanceof Error ? err.message : String(err),
				durationMs: Date.now() - started,
			};
		}
		await writes;
		try {
			await finishRun(
				id,
				msg.type === "done"
					? { status: "done", result: msg.result, durationMs: msg.durationMs }
					: {
							status: "error",
							error: msg.type === "error" ? msg.error : "unknown",
							durationMs: msg.durationMs,
						},
			);
		} catch (err) {
			console.error("research finishRun", err);
		}
		emit(msg);
		live.delete(id);
	})();

	return { ok: true, id, cached: false };
}

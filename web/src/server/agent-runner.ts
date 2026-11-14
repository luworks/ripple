// Runs one research query in the brain0-agent Docker image (see agent/) and maps Codex's
// JSONL event stream to AgentEvents. One fresh container per query; keys come from env only.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import type {
	AgentEvent,
	ResearchResult,
	RunOutcome,
	ToolCallTrace,
} from "./research-types";

const IMAGE = process.env.AGENT_IMAGE ?? "brain0-agent";
const TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS ?? 240_000);
const KEYS = [
	"OPENAI_API_KEY",
	"TELEM_HACK_API_KEY",
	"TAVILY_API_KEY",
] as const;
const PASS_THROUGH = ["AGENT_MODEL", "AGENT_EFFORT"] as const;

type CodexItem = {
	type?: string;
	server?: string;
	tool?: string;
	arguments?: Record<string, unknown>;
	text?: string;
	error?: { message?: string };
	result?: { content?: { type?: string; text?: string }[] };
};
type CodexEvent = {
	type: string;
	item?: CodexItem;
	usage?: { input_tokens?: number; output_tokens?: number };
	error?: { message?: string };
	message?: string;
	result?: ResearchResult;
	exit_code?: number;
};

const clip = (s: string, n = 140) =>
	s.length > n ? `${s.slice(0, n - 1)}…` : s;

function describeArgs(args: Record<string, unknown> = {}): string {
	const pick = (k: string) => args[k];
	const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
	const v =
		pick("query") ??
		first(pick("queries")) ??
		first(pick("urls")) ??
		(Array.isArray(pick("symbols"))
			? (pick("symbols") as string[]).join(", ")
			: undefined) ??
		pick("symbol");
	return typeof v === "string" ? v : v ? JSON.stringify(v) : "";
}

const SEARCH_SERVERS = new Set(["telem", "telem_hack", "tavily"]);
const strings = (v: unknown): string[] | undefined =>
	Array.isArray(v)
		? v.filter((x): x is string => typeof x === "string")
		: typeof v === "string"
			? [v]
			: undefined;

// Request side of a search/fetch call, straight from the tool arguments.
function requestTrace(it: CodexItem): ToolCallTrace | undefined {
	if (!it.server || !it.tool || !SEARCH_SERVERS.has(it.server)) return;
	const a = it.arguments ?? {};
	const queries = strings(a.queries) ?? strings(a.query);
	const urls = strings(a.urls);
	return {
		server: it.server,
		tool: it.tool,
		...(queries && { queries }),
		...(typeof a.topic === "string" && { topic: a.topic }),
		...(urls && { urls }),
	};
}

// Result side: which provider returned which URL (Telem tags every result "[provider] URL: ...").
function resultTrace(it: CodexItem): ToolCallTrace | undefined {
	const req = requestTrace(it);
	if (!req || it.error) return;
	const text = (it.result?.content ?? []).map((c) => c.text ?? "").join("\n");
	if (/fetch|extract/.test(req.tool)) {
		// Telem marks each page "Status: succeeded"; Tavily extract returns one "url" per page.
		const pages = req.tool.includes("extract")
			? (text.match(/"url"\s*:/g)?.length ?? 0)
			: (text.match(/^Status: succeeded/gm)?.length ?? 0);
		return {
			server: req.server,
			tool: req.tool,
			pages,
		};
	}
	const hits: [string, string][] = [];
	const seen = new Set<string>();
	const re =
		req.server === "tavily"
			? /"url"\s*:\s*"([^"]+)"|^URL: (\S+)/gm
			: /^\[([^\]]+)\] URL: (\S+)/gm;
	for (const m of text.matchAll(re)) {
		const [provider, url] =
			req.server === "tavily" ? ["tavily", m[1] ?? m[2]] : [m[1], m[2]];
		const k = `${provider} ${url}`;
		if (url && !seen.has(k)) {
			seen.add(k);
			hits.push([provider, url]);
		}
	}
	return { server: req.server, tool: req.tool, hits };
}

function toEvent(e: CodexEvent): AgentEvent | undefined {
	const at = new Date().toISOString();
	const it = e.item;
	if (e.type === "thread.started")
		return { at, kind: "status", text: "Agent started" };
	if (e.type === "item.started" && it?.type === "mcp_tool_call") {
		const call = requestTrace(it);
		return {
			at,
			kind: "tool",
			text: clip(`${it.server}.${it.tool}: ${describeArgs(it.arguments)}`),
			...(call && { call }),
		};
	}
	if (e.type === "item.completed" && it?.type === "mcp_tool_call" && it.error)
		return {
			at,
			kind: "error",
			text: clip(`${it.server}.${it.tool} failed: ${it.error.message ?? ""}`),
		};
	if (e.type === "item.completed" && it?.type === "mcp_tool_call") {
		const call = resultTrace(it);
		if (!call) return undefined;
		const n = call.hits
			? `${new Set(call.hits.map((h) => h[1])).size} results from ${new Set(call.hits.map((h) => h[0])).size} providers`
			: `${call.pages ?? 0} pages read`;
		return { at, kind: "result", text: `${it.server}.${it.tool} → ${n}`, call };
	}
	if (e.type === "item.completed" && it?.type === "reasoning" && it.text)
		return {
			at,
			kind: "status",
			text: clip(it.text.split("\n")[0].replace(/\*\*/g, "")),
		};
	if (e.type === "turn.completed")
		return { at, kind: "status", text: "Writing structured result" };
	if (e.type === "error" || e.type === "turn.failed")
		return {
			at,
			kind: "error",
			text: clip(e.error?.message ?? e.message ?? e.type),
		};
	return undefined;
}

export function runResearch(
	query: string,
	onEvent: (e: AgentEvent) => void,
	timeoutMs = TIMEOUT_MS,
	signal?: AbortSignal,
): Promise<RunOutcome> {
	if (process.env.AGENT_ENDPOINT)
		return runRemoteResearch(query, onEvent, timeoutMs, signal);
	const started = Date.now();
	const name = `brain0-agent-${randomUUID().slice(0, 8)}`;
	const env: Record<string, string> = { PATH: process.env.PATH ?? "" };
	for (const k of [...KEYS, ...PASS_THROUGH])
		if (process.env[k]) env[k] = process.env[k] as string;
	const missing = KEYS.filter((k) => !env[k]);
	if (missing.length)
		return Promise.resolve({
			ok: false,
			error: `Missing env: ${missing.join(", ")}`,
			durationMs: 0,
		});

	// biome-ignore format: one flag per line reads better
	const args = [
		"run", "--rm", "--name", name,
		"--read-only", "--tmpfs", "/tmp",
		"--cap-drop", "ALL", "--security-opt", "no-new-privileges",
		"--memory", "1g", "--pids-limit", "256",
		...[...KEYS, ...PASS_THROUGH].filter((k) => env[k]).flatMap((k) => ["-e", k]),
		IMAGE, query,
	];

	return new Promise((resolve) => {
		const child = spawn("docker", args, {
			env,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let result: ResearchResult | undefined;
		let usage: { inputTokens: number; outputTokens: number } | undefined;
		let lastError = "";
		let stderr = "";
		const kill = (why: string) => {
			lastError ||= why;
			spawn("docker", ["kill", name], { stdio: "ignore" });
		};
		const timer = setTimeout(
			() => kill(`Timed out after ${Math.round(timeoutMs / 1000)}s`),
			timeoutMs,
		);
		signal?.addEventListener("abort", () => kill("Cancelled"), { once: true });

		onEvent({
			at: new Date().toISOString(),
			kind: "status",
			text: "Starting agent container",
		});
		createInterface({ input: child.stdout }).on("line", (line) => {
			let e: CodexEvent;
			try {
				e = JSON.parse(line);
			} catch {
				return;
			}
			if (e.type === "brain0.result" && e.result) result = e.result;
			if (e.type === "turn.completed" && e.usage)
				usage = {
					inputTokens: e.usage.input_tokens ?? 0,
					outputTokens: e.usage.output_tokens ?? 0,
				};
			const ev = toEvent(e);
			if (
				ev?.kind === "error" &&
				(e.type === "error" || e.type === "turn.failed")
			)
				lastError = ev.text;
			if (ev) onEvent(ev);
		});
		child.stderr.on("data", (d) => {
			stderr = (stderr + d).slice(-2000);
		});
		const finish = (code: number | null) => {
			clearTimeout(timer);
			const durationMs = Date.now() - started;
			if (result) resolve({ ok: true, result, durationMs, usage });
			else
				resolve({
					ok: false,
					durationMs,
					error:
						lastError ||
						clip(stderr.trim().split("\n").pop() ?? "", 300) ||
						`Agent exited with code ${code}`,
				});
		};
		child.on("error", (err) => {
			lastError ||= `Failed to start docker: ${err.message}`;
		});
		child.on("close", finish);
	});
}

async function runRemoteResearch(
	query: string,
	onEvent: (e: AgentEvent) => void,
	timeoutMs: number,
	signal?: AbortSignal,
): Promise<RunOutcome> {
	const started = Date.now();
	const token = process.env.AGENT_INTERNAL_TOKEN;
	if (!token || !process.env.AGENT_ENDPOINT)
		return {
			ok: false,
			error: "Agent service is not configured",
			durationMs: 0,
		};
	let result: ResearchResult | undefined;
	let usage: { inputTokens: number; outputTokens: number } | undefined;
	let lastError = "";
	onEvent({
		at: new Date().toISOString(),
		kind: "status",
		text: "Starting agent container",
	});
	try {
		const timeout = AbortSignal.timeout(timeoutMs);
		const response = await fetch(process.env.AGENT_ENDPOINT, {
			method: "POST",
			headers: {
				authorization: `Bearer ${token}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ query }),
			signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
		});
		if (!response.ok || !response.body)
			throw new Error(`Agent service returned ${response.status}`);
		const lines = createInterface({
			input: (await import("node:stream")).Readable.fromWeb(
				response.body as import("node:stream/web").ReadableStream,
			),
		});
		for await (const line of lines) {
			let event: CodexEvent;
			try {
				event = JSON.parse(line);
			} catch {
				continue;
			}
			if (event.type === "brain0.result" && event.result) result = event.result;
			if (event.type === "brain0.error")
				lastError = `Agent exited with code ${event.exit_code ?? "unknown"}`;
			if (event.type === "turn.completed" && event.usage)
				usage = {
					inputTokens: event.usage.input_tokens ?? 0,
					outputTokens: event.usage.output_tokens ?? 0,
				};
			const mapped = toEvent(event);
			if (mapped) onEvent(mapped);
			if (
				mapped?.kind === "error" &&
				(event.type === "error" || event.type === "turn.failed")
			)
				lastError = mapped.text;
		}
	} catch (error) {
		lastError = error instanceof Error ? error.message : "Agent request failed";
	}
	const durationMs = Date.now() - started;
	return result
		? { ok: true, result, durationMs, usage }
		: { ok: false, error: lastError || "Agent returned no result", durationMs };
}

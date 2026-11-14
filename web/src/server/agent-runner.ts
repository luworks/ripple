// Runs one research query in the brain0-agent Docker image (see agent/) and maps Codex's
// JSONL event stream to AgentEvents. One fresh container per query; keys come from env only.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import type { AgentEvent, ResearchResult, RunOutcome } from "./research-types";

const IMAGE = process.env.AGENT_IMAGE ?? "brain0-agent";
const TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS ?? 240_000);
const KEYS = ["OPENAI_API_KEY", "TELEM_API_KEY", "TAVILY_API_KEY"] as const;
const PASS_THROUGH = [
	"TELEM_HACK_API_KEY",
	"AGENT_MODEL",
	"AGENT_EFFORT",
] as const;

type CodexItem = {
	type?: string;
	server?: string;
	tool?: string;
	arguments?: Record<string, unknown>;
	text?: string;
	error?: { message?: string };
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

function toEvent(e: CodexEvent): AgentEvent | undefined {
	const at = new Date().toISOString();
	const it = e.item;
	if (e.type === "thread.started")
		return { at, kind: "status", text: "Agent started" };
	if (e.type === "item.started" && it?.type === "mcp_tool_call")
		return {
			at,
			kind: "tool",
			text: clip(`${it.server}.${it.tool}: ${describeArgs(it.arguments)}`),
		};
	if (e.type === "item.completed" && it?.type === "mcp_tool_call" && it.error)
		return {
			at,
			kind: "error",
			text: clip(`${it.server}.${it.tool} failed: ${it.error.message ?? ""}`),
		};
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
	signal?: AbortSignal,
): Promise<RunOutcome> {
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
			() => kill(`Timed out after ${TIMEOUT_MS / 1000}s`),
			TIMEOUT_MS,
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

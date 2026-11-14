// "From memory" panel for a research run: which earlier runs memory recall matched, how many
// of their verified sources the agent reused, and what that saved against a typical run.
// Every number comes from recorded events and durations, never from the model's answer.
import { Link } from "@tanstack/react-router";
import { formatPT } from "#/components/PriceChart";
import type { AgentEvent, ResearchResult } from "#/server/research-types";

const SEARCH = /^(tavily|telem|telem_hack)\./;

export function memoryOf(events: AgentEvent[]) {
	return events.find((e) => e.kind === "memory")?.memory;
}

export function MemoryPanel({
	events,
	result,
	durationMs,
}: {
	events: AgentEvent[];
	result: ResearchResult;
	durationMs: number | null;
}) {
	const m = memoryOf(events);
	if (!m) return null;
	if (!m.runs.length)
		return (
			<p className="rounded-2xl border border-zinc-800 px-5 py-3 text-sm text-zinc-400">
				<span className="font-medium text-emerald-400">Memory</span> · nothing
				on this event yet, so the agent searched from scratch. Its sources are
				now in memory for the next question about it.
			</p>
		);

	const known = new Set(m.urls);
	const reused = result.timeline.filter((t) => known.has(t.url)).length;
	const calls = events.filter(
		(e) => e.kind === "tool" && SEARCH.test(e.text),
	).length;
	const b = m.baseline;
	const less = (now: number, typical: number) =>
		typical > 0 ? Math.round((1 - now / typical) * 100) : null;
	const callsLess = b ? less(calls, b.searchCalls) : null;
	const timeLess =
		b && durationMs != null ? less(durationMs, b.durationMs) : null;

	return (
		<section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.03] p-6">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
					From memory
				</h2>
				<span className="text-xs text-zinc-500">
					Matched by meaning, before any web search · {m.ms} ms
				</span>
			</div>
			<dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
				<Stat
					label="Sources reused"
					value={String(reused)}
					sub={`of ${result.timeline.length} in the timeline · ${m.urls.length} recalled`}
				/>
				<Stat
					label="Search calls"
					value={String(calls)}
					sub={b ? `typical run: ${b.searchCalls}` : "no baseline yet"}
					delta={callsLess}
				/>
				<Stat
					label="Time"
					value={durationMs != null ? `${Math.round(durationMs / 1000)}s` : "—"}
					sub={
						b
							? `typical run: ${Math.round(b.durationMs / 1000)}s`
							: "no baseline yet"
					}
					delta={timeLess}
				/>
				<Stat
					label="Tickers recalled"
					value={String(m.tickers)}
					sub="prices always re-fetched live"
				/>
			</dl>
			<ul className="mt-5 flex flex-col gap-1.5 text-sm">
				{m.runs.map((r) => (
					<li key={r.id} className="flex flex-wrap items-baseline gap-x-3">
						<span className="font-mono text-xs text-zinc-500">
							{formatPT(r.at)} · match {r.similarity.toFixed(2)}
						</span>
						<Link
							to="/research/$id"
							params={{ id: r.id }}
							className="text-zinc-300 hover:text-emerald-300"
						>
							“{r.query}”
						</Link>
					</li>
				))}
			</ul>
			{b && (
				<p className="mt-4 text-xs text-zinc-500">
					Typical run = median of {b.runs} earlier runs that found nothing in
					memory.
				</p>
			)}
		</section>
	);
}

function Stat({
	label,
	value,
	sub,
	delta,
}: {
	label: string;
	value: string;
	sub: string;
	delta?: number | null;
}) {
	return (
		<div>
			<dt className="text-xs text-zinc-500">{label}</dt>
			<dd className="mt-1 flex items-baseline gap-2">
				<span className="text-2xl font-semibold tabular-nums">{value}</span>
				{delta != null && delta !== 0 && (
					<span
						className={`font-mono text-xs ${delta > 0 ? "text-emerald-300" : "text-rose-300"}`}
					>
						{delta > 0 ? `−${delta}%` : `+${-delta}%`}
					</span>
				)}
			</dd>
			<dd className="mt-0.5 text-xs text-zinc-500">{sub}</dd>
		</div>
	);
}

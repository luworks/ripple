import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { Cluster, MemoryHit } from "#/server/agent-memory/strata";

const TZ = "America/Los_Angeles";
const time = (iso: string) =>
	new Date(iso).toLocaleTimeString("en-US", {
		timeZone: TZ,
		hour: "numeric",
		minute: "2-digit",
	});

// Who ran a search. Claude Code and Codex search on their own while they code; Telem
// and Tavily are what our research agent calls when someone asks on /research.
export const SOURCES = [
	{
		key: "codex",
		name: "Codex",
		via: "built-in web search",
		color: "bg-zinc-400",
	},
	{
		key: "claude",
		name: "Claude Code",
		via: "WebSearch tool",
		color: "bg-violet-400",
	},
	{ key: "telem", name: "Telem", via: "research agent", color: "bg-amber-400" },
	{ key: "tavily", name: "Tavily", via: "research agent", color: "bg-sky-400" },
] as const;
export const sourceColor = (name: string) =>
	SOURCES.find((s) => s.name === name)?.color ?? "bg-zinc-400";

export function SourceTag({ name }: { name: string }) {
	return (
		<span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-zinc-500">
			<span className={`h-1.5 w-1.5 rounded-full ${sourceColor(name)}`} />
			{name}
		</span>
	);
}

// One card per agent session or research run in the selected bucket; open one to see
// what it searched and which pages it kept. Fixed heights (2 rows of 10rem cards, a
// 26rem detail panel) keep the page still while hovering through buckets.
export function Sessions({ sessions }: { sessions: Cluster[] }) {
	const [open, setOpen] = useState<string | null>(sessions[0]?.id ?? null);
	const sel = sessions.find((c) => c.id === open);
	if (!sessions.length)
		return (
			<p className="h-[47.75rem] text-sm text-zinc-500">No visible sessions.</p>
		);
	return (
		<div className="flex flex-col gap-4">
			<div className="grid h-[20.75rem] auto-rows-[10rem] grid-cols-1 content-start gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-4">
				{sessions.map((c) => (
					<SessionCard
						key={c.id}
						c={c}
						active={c.id === open}
						onClick={() => setOpen(c.id)}
					/>
				))}
			</div>
			{sel ? <SessionDetail c={sel} /> : <div className="h-[26rem]" />}
		</div>
	);
}

function SessionCard({
	c,
	active,
	onClick,
}: {
	c: Cluster;
	active: boolean;
	onClick: () => void;
}) {
	const engines = [...new Set(c.searches.map((s) => s.engine))];
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex flex-col gap-2 overflow-hidden rounded-2xl border p-4 text-left transition-colors ${active ? (c.memory ? "border-emerald-400/60 bg-zinc-900/60" : "border-sky-400/60 bg-zinc-900/60") : c.memory ? "border-emerald-500/30 hover:border-emerald-400/50" : "border-zinc-800 hover:border-zinc-600"}`}
		>
			<span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-zinc-500">
				{time(c.start)}
				{c.memory && <MemoryTag />}
				{engines.map((e) => (
					<SourceTag key={e} name={e} />
				))}
			</span>
			<span className="line-clamp-2 shrink-0 font-medium leading-snug">
				{c.title}
			</span>
			<span
				className={`${c.memory ? "line-clamp-1" : "line-clamp-2"} text-xs text-zinc-500`}
			>
				{c.who} · {c.n} {c.n === 1 ? "search" : "searches"}
				{c.pages.length ? ` · ${c.pages.length} pages` : ""}
			</span>
			{c.memory && (
				<span className="line-clamp-1 text-xs text-emerald-300">
					{savedLine(c.memory)}
				</span>
			)}
		</button>
	);
}

// A research run that started from memory: emerald, like the "From memory" panel on
// its /research page.
function MemoryTag() {
	return (
		<span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-emerald-400">
			<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
			Memory
		</span>
	);
}

// Memory is a head start, not a reason to search less: show speed, never call counts.
const savedLine = (m: MemoryHit) =>
	m.secs != null && m.typicalSecs != null
		? `${m.secs}s vs ${m.typicalSecs}s typical`
		: m.secs != null
			? `${m.secs}s`
			: `${m.reused} sources from memory`;

function MemoryDetail({ c, m }: { c: Cluster; m: MemoryHit }) {
	return (
		<div className="flex flex-col gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.03] px-4 py-3 text-sm lg:col-span-2">
			<span className="text-xs font-medium uppercase tracking-wider text-emerald-400">
				Started from memory
			</span>
			<span className="text-zinc-300">
				Matched {m.matched} earlier {m.matched === 1 ? "run" : "runs"} by
				meaning (best {m.best.toFixed(2)}) and reused {m.reused} of their
				verified sources · {savedLine(m)}.{" "}
				{c.id.startsWith("run:") && (
					<Link
						to="/research/$id"
						params={{ id: c.id.slice(4) }}
						className="text-emerald-300 underline-offset-4 hover:underline"
					>
						Open the run
					</Link>
				)}
			</span>
		</div>
	);
}

function SessionDetail({ c }: { c: Cluster }) {
	return (
		<div className="grid grid-cols-1 gap-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 lg:grid-cols-2">
			{c.memory && <MemoryDetail c={c} m={c.memory} />}
			<div className="flex flex-col gap-3">
				<span className="text-xs font-medium uppercase tracking-wider text-sky-400">
					What it searched
				</span>
				{c.searches.length === 0 && (
					<p className="text-sm text-zinc-500">
						{c.memory
							? "No web searches: it started from memory."
							: "No visible searches."}
					</p>
				)}
				<ol className="flex flex-col gap-2">
					{c.searches.map((s, i) => (
						<li
							key={`${i}-${s.text}`}
							className="grid grid-cols-[4.5rem_1fr] gap-3 text-sm"
						>
							<span className="font-mono text-xs leading-5 text-zinc-500">
								{time(s.at)}
							</span>
							<span className="flex flex-col gap-0.5 leading-5">
								<span>{s.text}</span>
								<SourceTag name={s.engine} />
							</span>
						</li>
					))}
				</ol>
			</div>
			<div className="flex flex-col gap-3">
				<span className="text-xs font-medium uppercase tracking-wider text-sky-400">
					What it kept
				</span>
				{c.pages.length === 0 && (
					<p className="text-sm text-zinc-500">No pages opened.</p>
				)}
				<ul className="flex flex-col gap-3">
					{c.pages.map((p, i) => {
						const [host, ...path] = p.url.split("/");
						return (
							<li
								key={`${i}-${p.url}`}
								className="flex flex-col gap-0.5 text-sm"
							>
								{p.title && <span className="font-medium">{p.title}</span>}
								<span className="break-all font-mono text-xs">
									<span className="text-zinc-300">{host}</span>
									<span className="text-zinc-500">
										{path.length ? `/${path.join("/")}` : ""}
									</span>
								</span>
								{p.note && <span className="text-zinc-400">{p.note}</span>}
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);
}

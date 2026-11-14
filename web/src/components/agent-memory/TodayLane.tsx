import { useState } from "react";
import type { Cluster, Today } from "#/server/agent-memory/strata";

const TZ = "America/Los_Angeles";
const time = (iso: string) =>
	new Date(iso).toLocaleTimeString("en-US", {
		timeZone: TZ,
		hour: "numeric",
		minute: "2-digit",
	});
const ptHour = (iso: string) => {
	const p = new Intl.DateTimeFormat("en-US", {
		timeZone: TZ,
		hour: "numeric",
		minute: "numeric",
		hourCycle: "h23",
	}).formatToParts(new Date(iso));
	const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
	return g("hour") + g("minute") / 60;
};

export const ENGINE_COLOR: Record<string, string> = {
	Tavily: "bg-sky-400",
	Telem: "bg-amber-400",
	web: "bg-zinc-300",
};
const LEGEND = [
	["web", "Claude Code / Codex"],
	["Tavily", "Tavily"],
	["Telem", "Telem"],
] as const;

// Today from midnight PT to now: one dot per search, then one card per session / run.
export function TodayLane({ today }: { today: Today }) {
	const [open, setOpen] = useState<string | null>(
		today.clusters[0]?.id ?? null,
	);
	const end = Math.max(ptHour(today.now), 1);
	const x = (iso: string) => `${Math.min(ptHour(iso) / end, 1) * 100}%`;
	const ticks = [0, 3, 6, 9, 12, 15, 18, 21].filter((t) => t < end - 0.75);
	const hits = today.clusters.flatMap((c) =>
		c.searches.map((s) => ({ ...s, c })),
	);
	const sel = today.clusters.find((c) => c.id === open);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-zinc-500">
				{LEGEND.map(([k, label]) => (
					<span key={k} className="flex items-center gap-1.5">
						<span className={`h-2 w-2 rounded-full ${ENGINE_COLOR[k]}`} />
						{label}
					</span>
				))}
				<span className="ml-auto font-mono">{hits.length} searches today</span>
			</div>

			<div className="relative h-10 border-t border-zinc-800">
				{ticks.map((t) => (
					<span
						key={t}
						className="absolute top-0 h-full"
						style={{ left: `${(t / end) * 100}%` }}
					>
						<span className="block h-1.5 border-l border-zinc-700" />
						<span className="absolute top-2 -translate-x-1/2 font-mono text-[10px] text-zinc-500">
							{t === 0
								? "12a"
								: t === 12
									? "12p"
									: t < 12
										? `${t}a`
										: `${t - 12}p`}
						</span>
					</span>
				))}
				<span className="absolute -top-3 right-0 h-4.5 border-l border-dashed border-emerald-400" />
				<span className="absolute top-2 right-0 font-mono text-[10px] text-emerald-400">
					now
				</span>
				{hits.map((h) => (
					<button
						type="button"
						key={`${h.c.id}-${h.at}-${h.text}`}
						title={`${time(h.at)} · ${h.engine === "web" ? h.c.who : h.engine} · ${h.text}`}
						onClick={() => setOpen(h.c.id)}
						className={`absolute -top-1 h-2 w-2 -translate-x-1/2 rounded-full opacity-80 ring-2 ring-zinc-950 hover:scale-150 hover:opacity-100 ${ENGINE_COLOR[h.engine] ?? ENGINE_COLOR.web}`}
						style={{ left: x(h.at) }}
					/>
				))}
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{today.clusters.map((c) => (
					<ClusterCard
						key={c.id}
						c={c}
						active={c.id === open}
						onClick={() => setOpen(c.id)}
					/>
				))}
			</div>

			{sel && <ClusterDetail c={sel} />}
		</div>
	);
}

function engines(c: Cluster) {
	return [...new Set(c.searches.map((s) => s.engine))];
}

function ClusterCard({
	c,
	active,
	onClick,
}: {
	c: Cluster;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition-colors ${active ? "border-sky-400/60 bg-zinc-900/60" : "border-zinc-800 hover:border-zinc-600"}`}
		>
			<span className="flex items-center gap-2 font-mono text-xs text-zinc-500">
				{time(c.start)}
				<span className="flex gap-1">
					{engines(c).map((e) => (
						<span
							key={e}
							className={`h-1.5 w-1.5 rounded-full ${ENGINE_COLOR[e] ?? ENGINE_COLOR.web}`}
						/>
					))}
				</span>
			</span>
			<span className="line-clamp-2 font-medium leading-snug">{c.title}</span>
			<span className="text-xs text-zinc-500">
				{c.who} · {c.searches.length}{" "}
				{c.searches.length === 1 ? "search" : "searches"}
				{c.pages.length ? ` · ${c.pages.length} pages` : ""}
			</span>
		</button>
	);
}

function ClusterDetail({ c }: { c: Cluster }) {
	return (
		<div className="grid grid-cols-1 gap-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 lg:grid-cols-2">
			<div className="flex flex-col gap-3">
				<span className="text-xs font-medium uppercase tracking-wider text-sky-400">
					What it searched
				</span>
				<ol className="flex flex-col gap-2">
					{c.searches.map((s) => (
						<li
							key={`${s.at}-${s.text}`}
							className="grid grid-cols-[4.5rem_1fr] gap-3 text-sm"
						>
							<span className="font-mono text-xs leading-5 text-zinc-500">
								{time(s.at)}
							</span>
							<span className="leading-5">
								<span
									className={`mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle ${ENGINE_COLOR[s.engine] ?? ENGINE_COLOR.web}`}
								/>
								{s.text}
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
					{c.pages.map((p) => {
						const [host, ...path] = p.url.split("/");
						return (
							<li key={p.url} className="flex flex-col gap-0.5 text-sm">
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

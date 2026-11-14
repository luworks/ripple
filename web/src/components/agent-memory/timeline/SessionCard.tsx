import { Link } from "@tanstack/react-router";
import type { SessionCard as Card } from "#/server/agent-memory/timeline";

export type Filters = { machine?: string; agent?: string };

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "es"}`;

export function SessionCard({
	s,
	color,
	filters,
	expanded = false,
}: {
	s: Card;
	color: string;
	filters: Filters;
	expanded?: boolean;
}) {
	return (
		<article
			className={`flex flex-col gap-3 rounded-xl border bg-zinc-900/50 p-4 ${expanded ? "border-sky-900" : "border-zinc-800"}`}
		>
			<header className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
				<span className="font-medium tabular-nums text-zinc-100">
					{expanded ? `${s.dayLabel} · ` : ""}
					{s.timeRange}
				</span>
				<span className="flex items-center gap-1.5 text-zinc-300">
					<span
						className="inline-block size-2 rounded-full"
						style={{ background: color }}
					/>
					{s.machine}
				</span>
				<span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
					{s.agent}
				</span>
				<span className="ml-auto text-xs tabular-nums text-zinc-500">
					{plural(s.searches, "search")} · {s.pages}{" "}
					{s.pages === 1 ? "page" : "pages"}
					{s.hidden > 0 && ` · ${s.hidden} hidden`}
				</span>
			</header>

			{s.trail.length > 0 ? (
				<ol className="flex flex-col gap-1 text-sm">
					{s.trail.map((t, i) =>
						t.kind === "query" ? (
							// biome-ignore lint/suspicious/noArrayIndexKey: trail order is fixed per render
							<li key={i} className="flex gap-2 text-zinc-200">
								<span className="select-none text-sky-400" aria-hidden>
									⌕
								</span>
								<span className="min-w-0 break-words">{t.text}</span>
							</li>
						) : (
							// biome-ignore lint/suspicious/noArrayIndexKey: trail order is fixed per render
							<li key={i} className="flex gap-2 pl-4">
								<span className="select-none text-zinc-600" aria-hidden>
									↳
								</span>
								<span className="min-w-0 truncate">
									<span className="font-semibold text-zinc-200">{t.host}</span>
									<span className="text-zinc-500">{t.path}</span>
								</span>
							</li>
						),
					)}
				</ol>
			) : (
				<p className="text-sm text-zinc-500">
					Only hidden activity in this session.
				</p>
			)}

			<footer className="flex flex-wrap items-center gap-4 text-xs">
				{s.more > 0 &&
					(expanded ? (
						<span className="text-zinc-500">+{s.more} more not shown</span>
					) : (
						<Link
							to="/agent-memory"
							search={{ view: "timeline", ...filters, session: s.key }}
							className="text-zinc-400 hover:text-zinc-200"
						>
							+{s.more} more
						</Link>
					))}
				{!expanded && (
					<Link
						to="/agent-memory"
						search={{ view: "timeline", ...filters, session: s.key }}
						className="text-zinc-400 hover:text-zinc-200"
					>
						Open session
					</Link>
				)}
				{s.firstQuery && (
					<Link
						to="/agent-memory"
						search={{ q: s.firstQuery.slice(0, 200) }}
						className="ml-auto text-sky-400 hover:text-sky-300"
					>
						Recall similar →
					</Link>
				)}
			</footer>
		</article>
	);
}

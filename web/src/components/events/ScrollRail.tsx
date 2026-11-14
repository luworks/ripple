import { useEffect, useState } from "react";

export type RailItem = {
	id: string;
	label: string;
	detail?: string;
	kicker?: string;
	/** Short always-visible tag next to the tick (e.g. a date) for major events. */
	tag?: string;
	major?: boolean;
};

export type QuickLink = { id: string; label: string };

/** Page sections that are not events: shown as labelled links below the rail, not as ticks. */
export const SECTION_LINKS: QuickLink[] = [
	{ id: "social", label: "Social pulse" },
	{ id: "method", label: "How Telem searched" },
];

/**
 * Minimap-style scroll rail on the left edge, like the one in a T3 Code thread: one tick
 * per section, major events drawn longer in amber with an always-visible tag, a preview
 * card on hover, smooth jump on click, and the tick for the section in view highlighted.
 */
export function ScrollRail({
	items,
	links = SECTION_LINKS,
}: {
	items: RailItem[];
	links?: QuickLink[];
}) {
	const [active, setActive] = useState(items[0]?.id);
	const [hover, setHover] = useState<string | null>(null);

	useEffect(() => {
		const visible = new Map<string, number>();
		const obs = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting)
						visible.set(e.target.id, e.boundingClientRect.top);
					else visible.delete(e.target.id);
				}
				const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
				if (top) setActive(top[0]);
			},
			{ rootMargin: "-15% 0px -55% 0px" },
		);
		for (const i of [...items, ...links]) {
			const el = document.getElementById(i.id);
			if (el) obs.observe(el);
		}
		return () => obs.disconnect();
	}, [items, links]);

	const jump = (id: string) => {
		document
			.getElementById(id)
			?.scrollIntoView({ behavior: "smooth", block: "start" });
		history.replaceState(null, "", `${location.search}#${id}`);
	};

	return (
		<nav
			aria-label="Jump to event"
			className="fixed top-1/2 left-2 z-30 hidden -translate-y-1/2 lg:block"
			onMouseLeave={() => setHover(null)}
		>
			<ul className="flex flex-col items-start gap-1.5 py-3 pr-3 pl-1">
				{items.map((i) => {
					const on = active === i.id;
					return (
						<li key={i.id} className="relative flex items-center">
							<button
								type="button"
								aria-label={i.label}
								aria-current={on ? "location" : undefined}
								onMouseEnter={() => setHover(i.id)}
								onFocus={() => setHover(i.id)}
								onBlur={() => setHover(null)}
								onClick={() => jump(i.id)}
								className="group flex h-2.5 items-center gap-2"
							>
								<span
									className={`block h-[3px] rounded-full transition-all duration-150 ${
										on
											? "w-7 bg-emerald-400"
											: i.major
												? "w-6 bg-amber-400 group-hover:w-7 group-hover:bg-amber-300"
												: "w-3 bg-zinc-600 group-hover:w-5 group-hover:bg-zinc-300"
									}`}
								/>
								{i.major && i.tag && (
									<span
										className={`font-mono text-[10px] leading-none whitespace-nowrap ${on ? "text-emerald-300" : "text-amber-300/80 group-hover:text-amber-200"}`}
									>
										{i.tag}
									</span>
								)}
							</button>
							{hover === i.id && (
								<div className="pointer-events-none absolute top-1/2 left-full ml-3 w-80 -translate-y-1/2 rounded-xl border border-zinc-700/80 bg-zinc-900/95 p-3.5 shadow-2xl shadow-black/50 backdrop-blur">
									<div className="mb-1 flex items-center gap-2 font-mono text-[11px] text-emerald-400">
										{i.kicker}
										{i.major && (
											<span className="rounded-full bg-amber-400/15 px-1.5 py-px font-sans text-[10px] font-medium text-amber-300">
												Major
											</span>
										)}
									</div>
									<div className="line-clamp-2 text-sm font-semibold text-zinc-100">
										{i.label}
									</div>
									{i.detail && (
										<p className="mt-1 line-clamp-3 text-xs leading-relaxed text-zinc-400">
											{i.detail}
										</p>
									)}
								</div>
							)}
						</li>
					);
				})}
			</ul>
			{links.length > 0 && (
				<ul className="mt-2 ml-1 flex flex-col gap-1 border-t border-zinc-800 pt-3">
					{links.map((l) => (
						<li key={l.id}>
							<button
								type="button"
								aria-current={active === l.id ? "location" : undefined}
								onClick={() => jump(l.id)}
								className={`rounded-md px-2 py-1 text-xs whitespace-nowrap transition-colors ${
									active === l.id
										? "bg-emerald-400/10 text-emerald-300"
										: "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
								}`}
							>
								{l.label} →
							</button>
						</li>
					))}
				</ul>
			)}
		</nav>
	);
}

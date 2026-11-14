import { useState } from "react";
import type { Strata } from "#/server/agent-memory/strata";

const H = 120;
const fmt = new Intl.NumberFormat("en-US");
const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions) =>
	new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
		timeZone: "UTC",
		...opts,
	});

// One bar per PT day, log scale, so a quiet week and a 100k-search batch night both read.
export function DailyStrip({ days }: { days: Strata["days"] }) {
	const [hover, setHover] = useState<number | null>(null);
	const max = Math.max(...days.map((d) => d.n), 1);
	const h = (n: number) =>
		n > 0
			? Math.round(3 + (Math.log10(n + 1) / Math.log10(max + 1)) * (H - 3))
			: 0;
	const peak = days.reduce((a, d, i) => (d.n > days[a].n ? i : a), 0);
	const last = days.length - 1;
	const months = days.flatMap((d, i) =>
		d.day.endsWith("-01") || i === 0
			? [{ i, label: dayLabel(d.day, { month: "short" }) }]
			: [],
	);
	const pct = (i: number) => ((i + 0.5) / days.length) * 100;
	const shown = hover ?? last;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-baseline justify-between gap-4 text-sm">
				<span className="text-zinc-400">
					<span className="text-zinc-100">
						{dayLabel(days[shown].day, {
							weekday: "short",
							month: "short",
							day: "numeric",
						})}
					</span>
					{" · "}
					<span className="font-mono text-zinc-100">
						{fmt.format(days[shown].n)}
					</span>{" "}
					searches
				</span>
				<span className="text-xs text-zinc-500">
					one bar per day · log scale
				</span>
			</div>
			<div className="relative">
				<span
					className="absolute -top-1 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-zinc-500"
					style={{ left: `${pct(peak)}%` }}
				>
					{dayLabel(days[peak].day, { month: "short", day: "numeric" })} ·
					overnight batch, {fmt.format(days[peak].n)}
				</span>
				<fieldset
					className="m-0 flex items-end gap-px border-0 p-0 pt-5"
					style={{ height: H + 20 }}
					onMouseLeave={() => setHover(null)}
				>
					{days.map((d, i) => (
						<button
							type="button"
							key={d.day}
							aria-label={`${d.day}: ${d.n} searches`}
							onMouseEnter={() => setHover(i)}
							onFocus={() => setHover(i)}
							className="group flex h-full flex-1 items-end"
						>
							<span
								className={`w-full rounded-t-[1px] transition-colors ${i === last ? "bg-sky-400" : i === hover ? "bg-zinc-100" : "bg-zinc-600 group-hover:bg-zinc-300"}`}
								style={{ height: h(d.n) }}
							/>
						</button>
					))}
				</fieldset>
			</div>
			<div className="relative h-4 border-t border-zinc-800 font-mono text-[10px] text-zinc-500">
				{months.map((m) => (
					<span
						key={m.i}
						className="absolute top-1"
						style={{ left: `${(m.i / days.length) * 100}%` }}
					>
						{m.label}
					</span>
				))}
				<span className="absolute top-1 right-0 text-sky-400">today</span>
			</div>
		</div>
	);
}

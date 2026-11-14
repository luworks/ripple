import { useEffect, useRef, useState } from "react";
import type { RecallChart } from "#/server/agent-memory/recall";
import { abbrev, colorFor, fmt, longDay, pct, shortDay } from "./data";

const H = 240;
const M = { top: 12, right: 8, bottom: 28, left: 40 };
const GAP = 2; // surface gap between stacked segments
const R = 4; // rounded data-end radius

// Round tick step (1/2/2.5/5 × 10^k) giving about 4 intervals; returns the tick values.
function niceTicks(v: number) {
	const raw = Math.max(v, 1) / 4;
	const mag = 10 ** Math.floor(Math.log10(raw));
	const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
	const n = Math.ceil(Math.max(v, 1) / step);
	return Array.from({ length: n + 1 }, (_, i) => i * step);
}

// Rect with only the top corners rounded.
function topRounded(x: number, y: number, w: number, h: number, r: number) {
	const rr = Math.min(r, h, w / 2);
	return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function WeeklyDomainsChart({
	chart,
	selected,
	onSelect,
}: {
	chart: RecallChart;
	selected: number;
	onSelect: (i: number) => void;
}) {
	const wrap = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(720);
	const [hover, setHover] = useState<number | null>(null);

	useEffect(() => {
		const el = wrap.current;
		if (!el) return;
		const ro = new ResizeObserver(([e]) =>
			setWidth(Math.max(280, Math.round(e.contentRect.width))),
		);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const { days, series, values, totals, movingAvg } = chart;
	const plotW = width - M.left - M.right;
	const plotH = H - M.top - M.bottom;
	const ticks = niceTicks(Math.max(...totals, ...movingAvg));
	const yMax = ticks[ticks.length - 1];
	const y = (v: number) => M.top + plotH - (v / yMax) * plotH;
	const band = plotW / days.length;
	const barW = Math.min(56, band * 0.62);
	const cx = (i: number) => M.left + band * i + band / 2;
	const line = movingAvg
		.map((v, i) => `${i ? "L" : "M"}${cx(i)},${y(v)}`)
		.join("");
	const tip = hover ?? null;

	return (
		<div ref={wrap} className="relative" data-chart="recall-7d">
			<svg
				width={width}
				height={H}
				role="img"
				aria-label="Daily URL occurrences by registrable domain, last 7 days, with 7-day moving average"
				className="block"
			>
				{ticks.map((t) => (
					<g key={t}>
						<line
							x1={M.left}
							x2={width - M.right}
							y1={y(t)}
							y2={y(t)}
							stroke="#27272a"
							strokeWidth={1}
						/>
						<text
							x={M.left - 8}
							y={y(t)}
							dy="0.32em"
							textAnchor="end"
							className="fill-zinc-500 text-[11px] tabular-nums"
						>
							{abbrev(t)}
						</text>
					</g>
				))}
				{days.map((d, i) => {
					const active = i === selected;
					let acc = 0;
					const segs = series
						.map((s) => ({ key: s.key, v: values[i][s.key] ?? 0 }))
						.filter((s) => s.v > 0);
					return (
						<g key={d}>
							{(active || i === hover) && (
								<rect
									x={M.left + band * i + 2}
									y={M.top}
									width={band - 4}
									height={plotH}
									rx={6}
									fill={active ? "#27272a" : "#18181b"}
									opacity={active ? 0.7 : 1}
								/>
							)}
							{segs.map((s, j) => {
								const y0 = y(acc);
								acc += s.v;
								const y1 = y(acc);
								const top = j === segs.length - 1;
								const h = Math.max(0, y0 - y1 - (j > 0 ? GAP : 0));
								const x = cx(i) - barW / 2;
								const fill = colorFor(series, s.key);
								return top ? (
									<path
										key={s.key}
										d={topRounded(x, y1, barW, h, R)}
										fill={fill}
									/>
								) : (
									<rect
										key={s.key}
										x={x}
										y={y1}
										width={barW}
										height={h}
										fill={fill}
									/>
								);
							})}
							<text
								x={cx(i)}
								y={H - 8}
								textAnchor="middle"
								className={`text-[11px] ${active ? "fill-zinc-100 font-medium" : "fill-zinc-500"}`}
							>
								{shortDay(d)}
							</text>
						</g>
					);
				})}
				<path
					d={line}
					fill="none"
					stroke="#e4e4e7"
					strokeWidth={2}
					strokeDasharray="5 4"
					strokeLinecap="round"
				/>
				{movingAvg.map((v, i) => (
					<circle
						key={days[i]}
						cx={cx(i)}
						cy={y(v)}
						r={i === tip ? 4 : 0}
						fill="#e4e4e7"
						stroke="#09090b"
						strokeWidth={2}
					/>
				))}
			</svg>

			{/* Hit targets: one full-height button per day, bigger than the bar. */}
			<div
				className="absolute flex"
				style={{ left: M.left, top: M.top, width: plotW, height: plotH }}
			>
				{days.map((d, i) => (
					<button
						key={d}
						type="button"
						aria-pressed={i === selected}
						aria-label={`${longDay(d)}: ${fmt.format(totals[i])} URL occurrences`}
						className="h-full flex-1 cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
						onMouseEnter={() => setHover(i)}
						onMouseLeave={() => setHover(null)}
						onFocus={() => setHover(i)}
						onBlur={() => setHover(null)}
						onClick={() => onSelect(i)}
					/>
				))}
			</div>

			{tip !== null && (
				<div
					className="pointer-events-none absolute z-10 w-52 rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs shadow-xl"
					style={{
						left: Math.min(Math.max(cx(tip) - 104, 0), width - 208),
						top: 0,
					}}
				>
					<div className="mb-1 flex justify-between font-medium text-zinc-100">
						<span>{longDay(days[tip])}</span>
						<span className="tabular-nums">{fmt.format(totals[tip])}</span>
					</div>
					{[...series]
						.map((s) => ({ key: s.key, v: values[tip][s.key] ?? 0 }))
						.sort((a, b) => b.v - a.v)
						.map((s) => (
							<div
								key={s.key}
								className="flex items-center gap-2 text-zinc-400"
							>
								<span
									className="size-2 shrink-0 rounded-sm"
									style={{ background: colorFor(series, s.key) }}
								/>
								<span className="truncate">{s.key}</span>
								<span className="ml-auto tabular-nums text-zinc-200">
									{fmt.format(s.v)}
								</span>
							</div>
						))}
					<div className="mt-1 flex justify-between border-t border-zinc-800 pt-1 text-zinc-400">
						<span>7-day avg</span>
						<span className="tabular-nums text-zinc-200">
							{fmt.format(Math.round(movingAvg[tip]))}
						</span>
					</div>
				</div>
			)}
		</div>
	);
}

export function ChartLegend({ chart }: { chart: RecallChart }) {
	return (
		<ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
			{chart.series.map((s) => (
				<li key={s.key} className="flex items-center gap-1.5">
					<span
						className="size-2.5 rounded-sm"
						style={{ background: colorFor(chart.series, s.key) }}
					/>
					<span className="text-zinc-300">{s.key}</span>
					<span className="tabular-nums text-zinc-500">
						{fmt.format(s.total)}
					</span>
				</li>
			))}
			<li className="flex items-center gap-1.5">
				<svg width="18" height="10" aria-hidden="true">
					<line
						x1="1"
						x2="17"
						y1="5"
						y2="5"
						stroke="#e4e4e7"
						strokeWidth="2"
						strokeDasharray="5 3"
					/>
				</svg>
				<span className="text-zinc-300">7-day avg</span>
			</li>
		</ul>
	);
}

export function DayBreakdown({
	chart,
	day,
}: {
	chart: RecallChart;
	day: number;
}) {
	const total = chart.totals[day] ?? 0;
	const rows = chart.series
		.map((s) => ({ key: s.key, v: chart.values[day]?.[s.key] ?? 0 }))
		.sort((a, b) => b.v - a.v);
	return (
		<div>
			<h3 className="mb-2 text-sm font-medium text-zinc-200">
				{longDay(chart.days[day])}{" "}
				<span className="text-zinc-500">· {fmt.format(total)} total</span>
			</h3>
			<table className="w-full text-sm">
				<thead className="sr-only">
					<tr>
						<th>Domain</th>
						<th>URL occurrences</th>
						<th>Share of day</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((r) => (
						<tr key={r.key} className="border-t border-zinc-800/70">
							<td className="py-1.5">
								<span className="flex items-center gap-2 text-zinc-300">
									<span
										className="size-2.5 shrink-0 rounded-sm"
										style={{ background: colorFor(chart.series, r.key) }}
									/>
									{r.key}
								</span>
							</td>
							<td className="py-1.5 text-right tabular-nums text-zinc-100">
								{fmt.format(r.v)}
							</td>
							<td className="w-16 py-1.5 text-right tabular-nums text-zinc-500">
								{pct(r.v, total)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function TopDomains({ chart }: { chart: RecallChart }) {
	const all = chart.series.reduce((s, x) => s + x.total, 0);
	const top = chart.series.filter((s) => s.key !== "Other");
	const max = Math.max(...top.map((s) => s.total), 1);
	return (
		<div>
			<h3 className="mb-2 text-sm font-medium text-zinc-200">
				Top domains <span className="text-zinc-500">· last 7 days</span>
			</h3>
			<ol className="flex flex-col gap-2.5">
				{top.map((s) => (
					<li key={s.key} className="text-sm">
						<div className="flex items-baseline gap-2">
							<span className="text-zinc-300">{s.key}</span>
							<span className="ml-auto tabular-nums text-zinc-100">
								{fmt.format(s.total)}
							</span>
							<span className="w-14 text-right tabular-nums text-zinc-500">
								{pct(s.total, all)}
							</span>
						</div>
						<div className="mt-1 h-1 rounded-full bg-zinc-800">
							<div
								className="h-1 rounded-full"
								style={{
									width: `${(s.total / max) * 100}%`,
									background: colorFor(chart.series, s.key),
								}}
							/>
						</div>
					</li>
				))}
			</ol>
		</div>
	);
}

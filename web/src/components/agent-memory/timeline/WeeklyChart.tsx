import { useEffect, useRef, useState } from "react";
import type { TimelineChart } from "#/server/agent-memory/timeline";

const H = 220;
const M = { top: 12, right: 8, bottom: 24, left: 36 };
const GAP = 2;
const R = 4;
const fmt = new Intl.NumberFormat("en-US");

function niceMax(v: number): number {
	if (v <= 4) return 4;
	const step = 10 ** Math.floor(Math.log10(v / 4));
	for (const m of [1, 2, 2.5, 5, 10]) {
		if (Math.ceil(v / (step * m)) <= 4) return 4 * step * m;
	}
	return v;
}

// Rect with only the top corners rounded (the data end); the baseline stays square.
function topRounded(x: number, y: number, w: number, h: number): string {
	const r = Math.min(R, h, w / 2);
	return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

export function WeeklyChart({ chart }: { chart: TimelineChart }) {
	const box = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(720);
	const [hover, setHover] = useState<number | null>(null);

	useEffect(() => {
		const el = box.current;
		if (!el) return;
		const ro = new ResizeObserver(([e]) =>
			setWidth(Math.max(280, Math.round(e.contentRect.width))),
		);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const { series, weeks } = chart;
	const totals = weeks.map((w) => w.counts.reduce((a, b) => a + b, 0));
	const max = niceMax(Math.max(0, ...totals));
	const innerW = width - M.left - M.right;
	const innerH = H - M.top - M.bottom;
	const band = weeks.length ? innerW / weeks.length : innerW;
	const barW = Math.max(2, Math.min(36, band * 0.72));
	const y = (v: number) => (v / max) * innerH;
	const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
	const labelEvery = Math.max(1, Math.ceil(34 / band));
	const hw = hover === null ? null : weeks[hover];

	return (
		<section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 className="text-sm font-medium text-zinc-200">
					Sessions with web activity, by machine · weekly (PT)
				</h2>
				<ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
					{series.map((s) => (
						<li key={s.key} className="flex items-center gap-1.5">
							<span
								className="inline-block size-2.5 rounded-sm"
								style={{ background: s.color }}
							/>
							{s.key}
							<span className="tabular-nums text-zinc-500">
								{fmt.format(s.total)}
							</span>
						</li>
					))}
				</ul>
			</div>

			<div ref={box} className="relative w-full">
				{weeks.length === 0 ? (
					<div className="flex h-[220px] items-center justify-center text-sm text-zinc-500">
						No sessions for this filter.
					</div>
				) : (
					<svg
						width={width}
						height={H}
						role="img"
						aria-label="Weekly sessions stacked by machine"
						onMouseLeave={() => setHover(null)}
					>
						<g transform={`translate(${M.left},${M.top})`}>
							{ticks.map((t) => (
								<g key={t} transform={`translate(0,${innerH - y(t)})`}>
									<line x2={innerW} stroke="#27272a" strokeWidth={1} />
									<text
										x={-8}
										dy="0.32em"
										textAnchor="end"
										className="fill-zinc-500 text-[10px] tabular-nums"
									>
										{fmt.format(t)}
									</text>
								</g>
							))}
							{weeks.map((w, i) => {
								const x = i * band + (band - barW) / 2;
								let acc = 0;
								let top = -1;
								w.counts.forEach((c, ci) => {
									if (c > 0) top = ci;
								});
								return (
									<g
										key={w.week}
										opacity={hover === null || hover === i ? 1 : 0.45}
									>
										{w.counts.map((c, si) => {
											if (!c) return null;
											const y0 = innerH - y(acc);
											acc += c;
											const y1 = innerH - y(acc);
											// 2px surface gap between stacked segments.
											const h = Math.max(1, y0 - y1 - (acc > c ? GAP : 0));
											const color = series[si]?.color ?? "#52525b";
											return si === top ? (
												<path
													key={series[si]?.key}
													d={topRounded(x, y1, barW, h)}
													fill={color}
												/>
											) : (
												<rect
													key={series[si]?.key}
													x={x}
													y={y1}
													width={barW}
													height={h}
													fill={color}
												/>
											);
										})}
										{i % labelEvery === 0 && (
											<text
												x={x + barW / 2}
												y={innerH + 16}
												textAnchor="middle"
												className="fill-zinc-500 text-[10px]"
											>
												{w.label}
											</text>
										)}
										{/* biome-ignore lint/a11y/noStaticElementInteractions: hover-only tooltip; the table below carries the same data */}
										<rect
											x={i * band}
											y={0}
											width={band}
											height={innerH}
											fill="transparent"
											onMouseEnter={() => setHover(i)}
										/>
									</g>
								);
							})}
						</g>
					</svg>
				)}
				{hw && hover !== null && (
					<div
						className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs shadow-lg"
						style={{
							left: Math.min(
								width - 172,
								Math.max(0, M.left + hover * band + band / 2 - 80),
							),
						}}
					>
						<div className="mb-1 font-medium text-zinc-200">
							{hw.label} · week of{" "}
							{dateFmt.format(new Date(`${hw.week}T00:00:00Z`))}
						</div>
						{series.map((s, si) =>
							hw.counts[si] ? (
								<div
									key={s.key}
									className="flex items-center gap-2 text-zinc-400"
								>
									<span
										className="inline-block size-2 rounded-sm"
										style={{ background: s.color }}
									/>
									{s.key}
									<span className="ml-auto tabular-nums text-zinc-200">
										{fmt.format(hw.counts[si])}
									</span>
								</div>
							) : null,
						)}
						<div className="mt-1 flex border-t border-zinc-800 pt-1 text-zinc-400">
							Total
							<span className="ml-auto tabular-nums text-zinc-100">
								{fmt.format(totals[hover])}
							</span>
						</div>
					</div>
				)}
			</div>

			<details className="text-xs text-zinc-500">
				<summary className="cursor-pointer select-none hover:text-zinc-300">
					Show as table
				</summary>
				<div className="mt-2 max-h-64 overflow-auto">
					<table className="w-full text-left tabular-nums">
						<thead className="text-zinc-400">
							<tr>
								<th className="py-1 pr-3 font-medium">Week</th>
								{series.map((s) => (
									<th key={s.key} className="py-1 pr-3 font-medium">
										{s.key}
									</th>
								))}
								<th className="py-1 font-medium">Total</th>
							</tr>
						</thead>
						<tbody>
							{weeks.map((w, i) => (
								<tr key={w.week} className="border-t border-zinc-800/60">
									<td className="py-1 pr-3">
										{w.label} ({w.week})
									</td>
									{w.counts.map((c, si) => (
										<td key={series[si]?.key} className="py-1 pr-3">
											{c}
										</td>
									))}
									<td className="py-1 text-zinc-300">{totals[i]}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</section>
	);
}

import { useEffect, useMemo, useRef, useState } from "react";
import type { PriceSeries, ResearchResult } from "#/server/research-types";
import { formatEventTime } from "./research-numbers";

// Dark-mode categorical palette, assigned by entity order (never by rank).
export const SERIES_COLORS = [
	"#3987e5",
	"#d95926",
	"#199e70",
	"#c98500",
	"#d55181",
	"#0ca30c",
	"#9085e9",
	"#e66767",
];

const PT = "America/Los_Angeles";
const fmtTime = new Intl.DateTimeFormat("en-US", {
	timeZone: PT,
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
});
const fmtDay = new Intl.DateTimeFormat("en-US", {
	timeZone: PT,
	weekday: "short",
	month: "short",
	day: "numeric",
});
const fmtShortDay = new Intl.DateTimeFormat("en-US", {
	timeZone: PT,
	month: "short",
	day: "numeric",
});
const fmtHour = new Intl.DateTimeFormat("en-US", {
	timeZone: PT,
	hour: "numeric",
	minute: "2-digit",
});
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: PT });

// A blank or malformed timestamp from the agent must not crash the page.
export function formatPT(t: number | string) {
	const d = new Date(t);
	return Number.isNaN(d.getTime()) ? "unknown time" : `${fmtTime.format(d)} PT`;
}

export type ChartSeries = {
	symbol: string;
	color: string;
	series: PriceSeries;
};
type Marker = ResearchResult["timeline"][number];

const M = { top: 28, right: 16, bottom: 50, left: 48 };

export function PriceChart({
	lines,
	markers,
}: {
	lines: ChartSeries[];
	markers: Marker[];
}) {
	const wrap = useRef<HTMLDivElement>(null);
	const [W, setW] = useState(800);
	// Taller aspect on phones so the lines stay readable; the svg scales with its width.
	const compact = W < 560;
	const H = compact ? 300 : 340;
	const [hover, setHover] = useState<number | null>(null);
	const [activeMarker, setActiveMarker] = useState<number | null>(null);
	const [pinned, setPinned] = useState<number | null>(null);

	useEffect(() => {
		const el = wrap.current;
		if (!el) return;
		const ro = new ResizeObserver(() => setW(Math.max(280, el.clientWidth)));
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// Trading-time axis: union of bar timestamps, plotted by index so overnight gaps collapse.
	const model = useMemo(() => {
		const ts = [
			...new Set(lines.flatMap((l) => l.series.points.map((p) => p.t))),
		].sort((a, b) => a - b);
		const idx = new Map(ts.map((t, i) => [t, i]));
		const pct = lines.map((l) => {
			const base = l.series.points[0]?.c;
			const vals: (number | null)[] = new Array(ts.length).fill(null);
			for (const p of l.series.points)
				vals[idx.get(p.t) as number] = base ? (p.c / base - 1) * 100 : null;
			return vals;
		});
		let lo = 0;
		let hi = 0;
		for (const v of pct.flat())
			if (v != null) {
				lo = Math.min(lo, v);
				hi = Math.max(hi, v);
			}
		const pad = Math.max((hi - lo) * 0.08, 0.5);
		return { ts, pct, lo: lo - pad, hi: hi + pad };
	}, [lines]);

	const { ts, pct, lo, hi } = model;
	const iw = W - M.left - M.right;
	const ih = H - M.top - M.bottom;
	const x = (i: number) =>
		M.left + (ts.length > 1 ? (i / (ts.length - 1)) * iw : iw / 2);
	const y = (v: number) => M.top + ((hi - v) / (hi - lo)) * ih;

	// A news item maps to the first bar at or after it (its next tradable moment).
	const markerIdx = (m: Marker) => {
		const t = Date.parse(m.time) / 1000;
		if (!ts.length || !Number.isFinite(t)) return null;
		if (t < ts[0] - 86400 * 3 || t > ts[ts.length - 1] + 86400 * 3) return null;
		let a = 0;
		let b = ts.length - 1;
		if (t >= ts[b]) return b;
		while (a < b) {
			const mid = (a + b) >> 1;
			if (ts[mid] < t) a = mid + 1;
			else b = mid;
		}
		return a;
	};
	const placed = markers
		.map((m, i) => ({ m, i, at: markerIdx(m) }))
		.filter((p): p is { m: Marker; i: number; at: number } => p.at != null);

	const yTicks = niceTicks(lo, hi, 5);
	const sessions: { i: number; label: string }[] = [];
	let prevDay = "";
	ts.forEach((t, i) => {
		const d = dayKey.format(new Date(t * 1000));
		if (d !== prevDay) {
			sessions.push({
				i,
				label: (compact ? fmtShortDay : fmtDay).format(new Date(t * 1000)),
			});
			prevDay = d;
		}
	});

	if (!ts.length)
		return (
			<div className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-500">
				No price data returned for this window.
			</div>
		);

	const onMove = (e: React.PointerEvent<SVGRectElement>) => {
		const r = e.currentTarget.getBoundingClientRect();
		const px = ((e.clientX - r.left) / r.width) * iw;
		setHover(
			Math.max(
				0,
				Math.min(ts.length - 1, Math.round((px / iw) * (ts.length - 1))),
			),
		);
	};

	// Cluster markers closer than 14px into one dot so none hide behind another.
	const groups: { at: number; items: number[] }[] = [];
	for (const p of [...placed].sort((a, b) => a.at - b.at)) {
		const g = groups[groups.length - 1];
		if (g && x(p.at) - x(g.at) < 14) g.items.push(p.i);
		else groups.push({ at: p.at, items: [p.i] });
	}
	const shown = activeMarker ?? pinned;
	const shownItems = shown != null ? (groups[shown]?.items ?? []) : [];
	const hx = hover != null ? x(hover) : 0;

	return (
		<div ref={wrap} className="relative">
			<svg
				width={W}
				height={H}
				viewBox={`0 0 ${W} ${H}`}
				className="block h-auto w-full select-none"
				role="img"
				aria-label="Percent change from window start, with news markers"
			>
				{yTicks.map((v) => (
					<g key={v}>
						<line
							x1={M.left}
							x2={W - M.right}
							y1={y(v)}
							y2={y(v)}
							stroke={v === 0 ? "#52525b" : "#27272a"}
							strokeWidth={1}
						/>
						<text
							x={M.left - 8}
							y={y(v)}
							dy="0.32em"
							textAnchor="end"
							className="fill-zinc-500 font-mono text-[11px]"
						>
							{v > 0 ? "+" : ""}
							{v.toFixed(Math.abs(hi - lo) < 4 ? 1 : 0)}%
						</text>
					</g>
				))}
				{sessions.map((s, k) => {
					// Drop a day label that would collide with the previous one.
					const gap = compact ? 48 : 86;
					const showLabel =
						(k === 0 || x(s.i) - x(sessions[k - 1].i) >= gap) &&
						x(s.i) <= W - M.right - gap * 0.7;
					return (
						<g key={s.i}>
							{k > 0 && (
								<line
									x1={x(s.i)}
									x2={x(s.i)}
									y1={M.top}
									y2={H - M.bottom}
									stroke="#27272a"
									strokeDasharray="2 3"
								/>
							)}
							{showLabel && (
								<>
									<text
										x={x(s.i) + 4}
										y={H - M.bottom + 16}
										className="fill-zinc-500 text-[11px]"
									>
										{s.label}
									</text>
									<text
										x={x(s.i) + 4}
										y={H - M.bottom + 29}
										className="fill-zinc-600 font-mono text-[10px]"
									>
										{fmtHour.format(new Date(ts[s.i] * 1000))}
									</text>
								</>
							)}
						</g>
					);
				})}
				<text
					x={W - M.right}
					y={H - 4}
					textAnchor="end"
					className="fill-zinc-600 text-[10px]"
				>
					Times in PT · trading hours only
				</text>

				{placed.map(({ m, i, at }) => (
					<line
						key={`ml-${i}`}
						x1={x(at)}
						x2={x(at)}
						y1={M.top - 10}
						y2={H - M.bottom}
						stroke={shownItems.includes(i) ? "#34d399" : "#3f3f46"}
						strokeWidth={shownItems.includes(i) ? 1.5 : 1}
						strokeDasharray={m.kind === "market" ? "1 3" : "4 3"}
					/>
				))}

				{pct.map((vals, li) => (
					<path
						key={lines[li].symbol}
						d={linePath(vals, x, y)}
						fill="none"
						stroke={lines[li].color}
						strokeWidth={2}
						strokeLinejoin="round"
						strokeLinecap="round"
					/>
				))}

				{hover != null && (
					<g pointerEvents="none">
						<line
							x1={hx}
							x2={hx}
							y1={M.top}
							y2={H - M.bottom}
							stroke="#71717a"
						/>
						{pct.map((vals, li) => {
							const v = valueAt(vals, hover);
							return v == null ? null : (
								<circle
									key={lines[li].symbol}
									cx={hx}
									cy={y(v)}
									r={4}
									fill={lines[li].color}
									stroke="#09090b"
									strokeWidth={2}
								/>
							);
						})}
					</g>
				)}

				<rect
					x={M.left}
					y={M.top}
					width={iw}
					height={ih}
					fill="transparent"
					onPointerMove={onMove}
					onPointerDown={onMove}
					onPointerLeave={() => setHover(null)}
				/>

				{groups.map(({ at, items }, i) => (
					// biome-ignore lint/a11y/useSemanticElements: SVG hit target
					<g
						key={`mk-${at}`}
						role="button"
						tabIndex={0}
						aria-label={items.map((k) => markers[k].headline).join("; ")}
						className="cursor-pointer outline-none"
						onPointerEnter={() => setActiveMarker(i)}
						onPointerLeave={() => setActiveMarker(null)}
						onFocus={() => setActiveMarker(i)}
						onBlur={() => setActiveMarker(null)}
						onClick={() => setPinned(pinned === i ? null : i)}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ")
								setPinned(pinned === i ? null : i);
						}}
					>
						<circle cx={x(at)} cy={M.top - 14} r={11} fill="transparent" />
						<circle
							cx={x(at)}
							cy={M.top - 14}
							r={5}
							fill={shown === i ? "#34d399" : "#a1a1aa"}
							stroke="#09090b"
							strokeWidth={2}
						/>
						{items.length > 1 && (
							<text
								x={x(at) > W - M.right - 20 ? x(at) - 8 : x(at) + 8}
								textAnchor={x(at) > W - M.right - 20 ? "end" : "start"}
								y={M.top - 14}
								dy="0.32em"
								className="pointer-events-none fill-zinc-400 font-mono text-[10px]"
							>
								×{items.length}
							</text>
						)}
					</g>
				))}
			</svg>

			{hover != null && shown == null && (
				<div
					className="pointer-events-none absolute top-8 z-10 rounded-lg border border-zinc-800 bg-zinc-950/95 px-3 py-2 text-xs shadow-lg"
					style={hx > W / 2 ? { right: W - hx + 12 } : { left: hx + 12 }}
				>
					<div className="mb-1 font-mono text-zinc-400">
						{formatPT(ts[hover] * 1000)}
					</div>
					{pct.map((vals, li) => {
						const v = valueAt(vals, hover);
						return (
							<div key={lines[li].symbol} className="flex items-center gap-2">
								<span
									className="h-2 w-2 rounded-full"
									style={{ background: lines[li].color }}
								/>
								<span className="text-zinc-300">{lines[li].symbol}</span>
								<span className="ml-auto pl-3 font-mono text-zinc-100">
									{v == null ? "—" : signedPct(v)}
								</span>
							</div>
						);
					})}
				</div>
			)}

			<div className="mt-3 min-h-16 rounded-lg border border-zinc-800 px-4 py-3 text-sm">
				{shownItems.length ? (
					<ul className="flex flex-col gap-3">
						{pinned === shown && (
							<li className="text-xs text-emerald-400">
								Pinned · tap the dot again to unpin
							</li>
						)}
						{shownItems.map((k) => (
							<li key={k}>
								<div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
									<span className="font-mono">
										{formatEventTime(markers[k].time)}
									</span>
									<span>· {markers[k].source}</span>
								</div>
								<a
									href={markers[k].url}
									target="_blank"
									rel="noreferrer"
									className="mt-1 block font-medium hover:text-emerald-300"
								>
									{markers[k].headline} ↗
								</a>
							</li>
						))}
					</ul>
				) : (
					<span className="text-zinc-500">
						Hover or tap a dot above the chart to see the news item. Markers sit
						at the first trading bar at or after publication.
					</span>
				)}
			</div>
		</div>
	);
}

export function signedPct(v: number) {
	return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function valueAt(vals: (number | null)[], i: number) {
	for (let k = i; k >= 0; k--) if (vals[k] != null) return vals[k];
	return null;
}

function linePath(
	vals: (number | null)[],
	x: (i: number) => number,
	y: (v: number) => number,
) {
	let d = "";
	let pen = false;
	vals.forEach((v, i) => {
		if (v == null) return;
		d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
		pen = true;
	});
	return d;
}

function niceTicks(lo: number, hi: number, n: number) {
	const raw = (hi - lo) / n;
	const mag = 10 ** Math.floor(Math.log10(raw));
	const step =
		[1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? raw;
	const out: number[] = [];
	for (let v = Math.ceil(lo / step) * step; v <= hi; v += step)
		out.push(Math.round(v * 1e6) / 1e6);
	return out;
}

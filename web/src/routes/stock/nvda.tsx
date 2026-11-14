import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import type {
	IChartApi,
	ISeriesApi,
	ISeriesMarkersPluginApi,
	Time,
	UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { timeline } from "#/data/jensen-huang-timeline";
import {
	type Bar,
	getBars,
	INTERVALS,
	type Interval,
	type Packed,
	unpack,
} from "#/server/stock";

const SYMBOL = "NVDA";

// The interval lives in the URL (?i=5m). The loader runs during SSR, so the first chart's bars
// arrive inside the HTML; other intervals are preloaded into the router cache after first paint.
// Bars change only when scripts/fetch_stock.py runs, so cached loads never go stale in a session.

export const Route = createFileRoute("/stock/nvda")({
	head: () => ({
		meta: [
			{ title: "NVDA candles and events · Ripple" },
			{
				name: "description",
				content:
					"Nvidia candlesticks from 1-minute to monthly bars, with the Jensen Huang resignation events marked on the chart.",
			},
		],
	}),
	validateSearch: (s: Record<string, unknown>): { i?: Interval } =>
		INTERVALS.includes(s.i as Interval) ? { i: s.i as Interval } : {},
	loaderDeps: ({ search }) => ({ i: search.i ?? "1m" }),
	loader: async ({ deps }) =>
		JSON.parse(
			await getBars({ data: { symbol: SYMBOL, interval: deps.i } }),
		) as Packed,
	staleTime: Number.POSITIVE_INFINITY,
	preloadStaleTime: Number.POSITIVE_INFINITY,
	gcTime: 60 * 60 * 1000,
	component: NvdaPage,
});

// Start downloading the chart library as soon as this module loads in the browser.
const lcModule =
	typeof window === "undefined" ? null : import("lightweight-charts");

/* ------------------------------------------------------------------ data */

const TZ = "America/New_York";

const intervals: { id: Interval; label: string; span: string }[] = [
	{ id: "1m", label: "1m", span: "last ~30 days" },
	{ id: "2m", label: "2m", span: "last 60 days" },
	{ id: "5m", label: "5m", span: "last 60 days" },
	{ id: "15m", label: "15m", span: "last 60 days" },
	{ id: "30m", label: "30m", span: "last 60 days" },
	{ id: "1h", label: "1h", span: "last 2 years" },
	{ id: "1d", label: "1D", span: "since 1999" },
	{ id: "1wk", label: "1W", span: "since 1999" },
	{ id: "1mo", label: "1M", span: "since 1999" },
];
const intraday = (i: Interval) => !["1d", "1wk", "1mo"].includes(i);

type Marker = { at: number; label: string; detail: string };

// Exact-time reactions read off the 1-minute bars (ET in labels).
const minuteEvents: Marker[] = [
	{
		at: Date.parse("2026-11-11T21:55:00Z") / 1000,
		label: "Nov 11 16:55 · after-hours drop",
		detail:
			"−3.8% in 4 minutes, −8.9% by 18:10. No matching news in our timeline yet.",
	},
	{
		at: Date.parse("2026-11-12T13:49:00Z") / 1000,
		label: "Nov 12 08:49 · pre-market drop",
		detail: "159 → 154.66 in 5 minutes as the CEO transition goes out.",
	},
	{
		at: Date.parse("2026-11-12T13:52:29Z") / 1000,
		label: "Nov 12 08:52 · first social post",
		detail: "Resignation posts start on X and Xiaohongshu, ~3 min after price.",
	},
	{
		at: Date.parse("2026-11-12T14:30:00Z") / 1000,
		label: "Nov 12 09:30 · open at 149.27",
		detail: "−14.1% vs. prior close, then +9% rebound in 28 minutes.",
	},
];

// Day-level events from the event timeline; anchored at midnight ET.
const dayEvents: Marker[] = timeline.map((e) => ({
	at: Date.parse(`${e.date}T05:00:00Z`) / 1000,
	label: `${e.when} · ${e.title}`,
	detail: e.detail,
}));

const fmt = (opts: Intl.DateTimeFormatOptions) =>
	new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, ...opts });
const fmtFull = fmt({
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});
const fmtDay = fmt({ year: "numeric", month: "short", day: "numeric" });
const fmtTime = fmt({ hour: "2-digit", minute: "2-digit" });
const fmtMonthDay = fmt({ month: "short", day: "numeric" });
const fmtMonth = fmt({ month: "short", year: "2-digit" });
const fmtYear = fmt({ year: "numeric" });

// Last bar that starts at or before t (markers snap onto a bar).
function snap(bars: Bar[], t: number): number | null {
	let lo = 0;
	let hi = bars.length - 1;
	if (hi < 0 || t < bars[0].time) return null;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (bars[mid].time <= t) lo = mid;
		else hi = mid - 1;
	}
	return bars[lo].time;
}

// Center the chart on time `at` (0 = latest), with a window sized to the interval.
function focusChart(
	c: IChartApi | null,
	bars: Bar[],
	interval: Interval,
	at: number,
) {
	if (!c || !bars.length) return;
	const last = bars[bars.length - 1].time;
	const span =
		interval === "1m"
			? 86400 * 1.2
			: interval === "2m" || interval === "5m"
				? 86400 * 3
				: intraday(interval)
					? 86400 * 14
					: interval === "1d"
						? 86400 * 365
						: 86400 * 365 * 6;
	const from = at ? at - span / 3 : last - span;
	const to = at ? Math.min(at + (span * 2) / 3, last) : last;
	c.timeScale().setVisibleRange({
		from: from as UTCTimestamp,
		to: to as UTCTimestamp,
	});
}

/* ------------------------------------------------------------------ page */

function NvdaPage() {
	const [tab, setTab] = useState<"ours" | "tv">("ours");
	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
			<div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
				<p className="text-sm text-emerald-400">Stock · NASDAQ</p>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
					Nvidia (NVDA)
				</h1>
				<p className="mt-2 max-w-3xl text-sm text-zinc-400">
					Candles from our local Yahoo Finance download, drawn with
					TradingView's open-source Lightweight Charts. Times are New York (ET).
					Amber arrows mark the resignation events.
				</p>

				<div className="mt-6 flex gap-1 border-b border-zinc-800 text-sm">
					{(
						[
							["ours", "Our data + events"],
							["tv", "TradingView"],
						] as const
					).map(([id, label]) => (
						<button
							key={id}
							type="button"
							onClick={() => setTab(id)}
							className={`-mb-px border-b-2 px-3 py-2 ${tab === id ? "border-emerald-400 text-zinc-100" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}
						>
							{label}
						</button>
					))}
				</div>

				{tab === "ours" ? <OurChart /> : <TradingViewWidget />}
			</div>
		</main>
	);
}

function OurChart() {
	const box = useRef<HTMLDivElement>(null);
	const chart = useRef<IChartApi | null>(null);
	const candles = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const volume = useRef<ISeriesApi<"Histogram"> | null>(null);
	const markersApi = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
	const router = useRouter();
	const { i: interval } = Route.useLoaderDeps();
	const packed = Route.useLoaderData();
	const bars = useMemo(() => unpack(packed), [packed]);
	const [hover, setHover] = useState<Bar | null>(null);
	const [ready, setReady] = useState(false);

	// Create the chart once (client only; the library touches the DOM).
	useEffect(() => {
		let disposed = false;
		let cleanup = () => {};
		lcModule?.then((lc) => {
			if (disposed || !box.current) return;
			const timeLabel = (t: number) => fmtFull.format(t * 1000);
			const c = lc.createChart(box.current, {
				autoSize: true,
				layout: {
					background: { color: "#09090b" },
					textColor: "#a1a1aa",
					panes: { separatorColor: "#27272a" },
				},
				grid: {
					vertLines: { color: "#18181b" },
					horzLines: { color: "#18181b" },
				},
				rightPriceScale: { borderColor: "#27272a" },
				timeScale: {
					borderColor: "#27272a",
					timeVisible: true,
					secondsVisible: false,
					tickMarkFormatter: (t: number, type: number) => {
						const ms = t * 1000;
						// TickMarkType: 0 year, 1 month, 2 day, 3 time, 4 time with seconds
						if (type === 0) return fmtYear.format(ms);
						if (type === 1) return fmtMonth.format(ms);
						if (type === 2) return fmtMonthDay.format(ms);
						return fmtTime.format(ms);
					},
				},
				localization: {
					timeFormatter: (t: number) => timeLabel(t),
				},
				crosshair: { mode: lc.CrosshairMode.Normal },
			});
			const cs = c.addSeries(lc.CandlestickSeries, {
				upColor: "#10b981",
				downColor: "#ef4444",
				borderVisible: false,
				wickUpColor: "#10b981",
				wickDownColor: "#ef4444",
			});
			const vs = c.addSeries(
				lc.HistogramSeries,
				{ priceFormat: { type: "volume" }, priceLineVisible: false },
				1,
			);
			c.panes()[1]?.setHeight(110);
			markersApi.current = lc.createSeriesMarkers(cs, []);
			c.subscribeCrosshairMove((p) => {
				const d = p.seriesData.get(cs) as (Bar & { time: number }) | undefined;
				setHover(d ? { ...d, v: 0 } : null);
			});
			chart.current = c;
			candles.current = cs;
			volume.current = vs;
			setReady(true);
			cleanup = () => c.remove();
		});
		return () => {
			disposed = true;
			cleanup();
		};
	}, []);

	// Once the first chart is drawn, pull every other interval into the router cache, one at a
	// time, so switching intervals never waits on the network.
	useEffect(() => {
		if (!ready) return;
		let cancelled = false;
		(async () => {
			for (const i of INTERVALS) {
				if (cancelled) return;
				await router
					.preloadRoute({ to: "/stock/nvda", search: { i } })
					.catch(() => {});
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [ready, router]);

	// Push bars + markers into the chart.
	useEffect(() => {
		if (!ready || !bars.length || !chart.current) return;
		const t = (x: number) => x as UTCTimestamp;
		candles.current?.setData(
			bars.map((b) => ({
				time: t(b.time),
				open: b.open,
				high: b.high,
				low: b.low,
				close: b.close,
			})),
		);
		volume.current?.setData(
			bars.map((b) =>
				b.v > 0
					? {
							time: t(b.time),
							value: b.v,
							color: b.close >= b.open ? "#10b98166" : "#ef444466",
						}
					: { time: t(b.time) },
			),
		);
		const events = intraday(interval) ? minuteEvents : dayEvents;
		const marks = events
			.map((e) => ({ e, time: snap(bars, e.at) }))
			.filter(
				(m): m is { e: Marker; time: number } =>
					m.time !== null && m.e.at <= bars[bars.length - 1].time + 86400 * 31,
			)
			.map(({ time }) => ({
				time: t(time),
				position: "aboveBar" as const,
				color: "#f59e0b",
				shape: "arrowDown" as const,
			}));
		// Markers must be sorted and unique per time.
		const seen = new Set<number>();
		markersApi.current?.setMarkers(
			marks
				.sort((a, b) => a.time - b.time)
				.filter((m) => !seen.has(m.time) && seen.add(m.time)),
		);
		// Default view: the resignation window, or the last year on daily+.
		focusChart(
			chart.current,
			bars,
			interval,
			intraday(interval) ? Date.parse("2026-11-11T20:00:00Z") / 1000 : 0,
		);
	}, [bars, ready, interval]);

	const last = bars.at(-1);
	const prev = bars.at(-2);
	const shown = hover ?? last;
	const events = intraday(interval) ? minuteEvents : dayEvents;

	return (
		<section className="mt-4">
			<div className="flex flex-wrap items-center gap-1">
				{intervals.map((i) => (
					<Link
						key={i.id}
						to="/stock/nvda"
						search={i.id === "1m" ? {} : { i: i.id }}
						replace
						resetScroll={false}
						title={i.span}
						className={`rounded-md px-2.5 py-1 text-sm ${interval === i.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"}`}
					>
						{i.label}
					</Link>
				))}
				<span className="ml-2 text-xs text-zinc-500">
					{intervals.find((i) => i.id === interval)?.span} ·{" "}
					{bars.length.toLocaleString()} bars
				</span>
			</div>

			<div className="mt-3 flex min-h-6 flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-zinc-400">
				{shown && (
					<>
						<span className="text-zinc-200">
							{(intraday(interval) ? fmtFull : fmtDay).format(
								shown.time * 1000,
							)}
						</span>
						<span>O {shown.open.toFixed(2)}</span>
						<span>H {shown.high.toFixed(2)}</span>
						<span>L {shown.low.toFixed(2)}</span>
						<span>C {shown.close.toFixed(2)}</span>
						{!hover && prev && last && (
							<span
								className={
									last.close >= prev.close ? "text-emerald-400" : "text-red-400"
								}
							>
								{(((last.close - prev.close) / prev.close) * 100).toFixed(2)}%
								vs prev bar
							</span>
						)}
					</>
				)}
			</div>

			<div className="relative mt-2 h-[520px] overflow-hidden rounded-lg border border-zinc-800">
				<div ref={box} className="absolute inset-0" />
			</div>

			<p className="mt-2 text-xs text-zinc-500">
				Yahoo reports no volume before 09:30 or after 16:00 ET, so those bars
				have price only. Bars where Yahoo stored a running total instead of the
				bar's own volume are left out of the volume pane.
			</p>

			<h2 className="mt-8 text-lg font-semibold">
				{intraday(interval) ? "Minute-level reactions" : "Event timeline"}
			</h2>
			<p className="mt-1 text-sm text-zinc-400">
				Click an event to center the chart on it.
			</p>
			<ol className="mt-3 space-y-2">
				{events.map((e) => (
					<li key={e.label}>
						<button
							type="button"
							onClick={() => focusChart(chart.current, bars, interval, e.at)}
							className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-left hover:border-amber-500/60"
						>
							<span className="text-sm font-medium text-amber-400">
								{e.label}
							</span>
							<span className="mt-1 block text-sm text-zinc-400">
								{e.detail}
							</span>
						</button>
					</li>
				))}
			</ol>
		</section>
	);
}

// TradingView's free Advanced Chart widget: Cboe One delayed data, 1-minute bars at the finest.
function TradingViewWidget() {
	const box = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = box.current;
		if (!el) return;
		const s = document.createElement("script");
		s.src =
			"https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
		s.async = true;
		s.innerHTML = JSON.stringify({
			symbol: "NASDAQ:NVDA",
			interval: "1",
			timezone: TZ,
			theme: "dark",
			style: "1",
			locale: "en",
			autosize: true,
			allow_symbol_change: false,
			hide_side_toolbar: false,
		});
		el.appendChild(s);
		return () => {
			el.innerHTML = "";
		};
	}, []);
	return (
		<section className="mt-4">
			<div className="h-[600px] overflow-hidden rounded-lg border border-zinc-800">
				<div ref={box} className="tradingview-widget-container h-full" />
			</div>
			<p className="mt-2 text-xs text-zinc-500">
				TradingView's free embed: their drawing tools and indicators on Cboe One
				delayed data (one exchange group, not full-market volume). Its finest
				interval is 1 minute; seconds need a paid plan on tradingview.com. It
				cannot show our event markers.
			</p>
		</section>
	);
}

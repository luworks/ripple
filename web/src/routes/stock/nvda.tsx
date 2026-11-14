import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import type {
	IChartApi,
	ISeriesApi,
	Logical,
	UTCTimestamp,
} from "lightweight-charts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { timeline } from "#/data/jensen-huang-timeline";
import {
	type Bar,
	getBars,
	getPosts,
	INTERVALS,
	type Interval,
	type Packed,
	type Post,
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
					"Replay of Nvidia's minute bars around Jensen Huang's resignation, with every Telem post and what acting on it would have returned.",
			},
		],
	}),
	validateSearch: (s: Record<string, unknown>): { i?: Interval } =>
		INTERVALS.includes(s.i as Interval) ? { i: s.i as Interval } : {},
	loaderDeps: ({ search }) => ({ i: search.i ?? "1m" }),
	loader: async ({ deps }) => {
		const [packed, posts] = await Promise.all([
			getBars({ data: { symbol: SYMBOL, interval: deps.i } }),
			getPosts(),
		]);
		return { packed: JSON.parse(packed) as Packed, posts };
	},
	staleTime: Number.POSITIVE_INFINITY,
	preloadStaleTime: Number.POSITIVE_INFINITY,
	gcTime: 60 * 60 * 1000,
	component: NvdaPage,
});

// Start downloading the chart library as soon as this module loads in the browser.
const lcModule =
	typeof window === "undefined" ? null : import("lightweight-charts");

/* ------------------------------------------------------------------ event facts */

const TZ = "America/New_York";
const at = (iso: string) => Date.parse(iso) / 1000;

// Figures read off the 1-minute bars; prior close is Nov 11's regular-session close.
const PREV_CLOSE = 173.73;
const DAY_LOW = { t: at("2026-11-12T14:31:00Z"), price: 148.8 };
const DAY_CLOSE = 166.19;
const FIRST_ALERT = at("2026-11-12T13:52:29Z");
const ALERT_ZONE = [at("2026-11-12T13:52:00Z"), at("2026-11-12T14:30:00Z")];
const REBOUND_ZONE = [DAY_LOW.t, at("2026-11-12T14:58:00Z")];
// Shaded behind the candles on intraday charts.
const BANDS = [
	{ from: ALERT_ZONE[0], to: ALERT_ZONE[1], cls: "bg-red-500/15" },
	{ from: REBOUND_ZONE[0], to: REBOUND_ZONE[1], cls: "bg-emerald-500/15" },
];
const REPLAY_VIEW = [at("2026-11-12T13:30:00Z"), at("2026-11-12T15:35:00Z")];
const DAY2 = at("2026-11-12T09:00:00Z"); // 04:00 ET, pre-market open on Nov 12

type Pin = { t: number; n: string; title: string; detail: string };

const pricePins: Pin[] = [
	{
		t: at("2026-11-11T21:55:00Z"),
		n: "1",
		title: "After-hours drop",
		detail:
			"$174.58 to $168.26 in 4 minutes, $159.17 by 18:10 (−8.8%). Telem had no related post yet.",
	},
	{
		t: at("2026-11-12T13:49:00Z"),
		n: "2",
		title: "Second drop, pre-market",
		detail:
			"$159.00 to $154.66 in 5 minutes, 3 minutes before Telem's first post.",
	},
	{
		t: at("2026-11-12T14:30:00Z"),
		n: "3",
		title: "Open at $149.27",
		detail: "−14.1% vs. the $173.73 prior close.",
	},
	{
		t: DAY_LOW.t,
		n: "4",
		title: "Day low $148.80",
		detail:
			"One minute after the open, during the busiest stretch of Telem posts.",
	},
	{
		t: at("2026-11-12T14:58:00Z"),
		n: "5",
		title: "Rebound to $162.72",
		detail: "+9.4% in 27 minutes from the low.",
	},
];

// Day-level events from the event timeline; anchored at midnight ET.
const dayPins: Pin[] = timeline.map((e, i) => ({
	t: at(`${e.date}T05:00:00Z`),
	n: String(i + 1),
	title: `${e.when} · ${e.title}`,
	detail: e.detail,
}));

const insights = [
	{
		label: "Sell on Telem's first alert (8:52:29 ET; $155.21 at 8:53)",
		value: "4.1% loss avoided",
		note: "vs. the $148.80 low at 9:31; 3.8% vs. the $149.27 open",
		tone: "good",
	},
	{
		label: "Posts peaked 9:00–10:00 ET (14 posts) at the bottom",
		value: "+9.4% in 27 min",
		note: "From $148.80 at 9:31 to $162.72 at 9:58; +12.3% to the 11:12 high",
		tone: "good",
	},
	{
		label: "Missed: Nov 11 after-hours drop at 16:55 ET",
		value: "−8.8%",
		note: "$174.58 to $159.17 by 18:10, ~16 h before the first post. Needs SEC 8-K and newswire sources.",
		tone: "bad",
	},
] as const;

const leadLag = [
	[
		"After-hours drop −8.8%",
		"Nov 11 16:55",
		"Nov 12 08:52",
		"Price led by ~16 h",
	],
	[
		"Pre-market drop −2.9%",
		"Nov 12 08:49",
		"Nov 12 08:52:29",
		"Price led by 3 min",
	],
	[
		"Rebound +9.4%",
		"Nov 12 09:31",
		"Busiest posting 09:00–10:00",
		"In step: peak attention ≈ bottom",
	],
] as const;

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

/* ------------------------------------------------------------------ formatting */

const fmt = (opts: Intl.DateTimeFormatOptions, timeZone = TZ) =>
	new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, ...opts });
const fmtFull = fmt({
	month: "short",
	day: "numeric",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});
const fmtDay = fmt({ year: "numeric", month: "short", day: "numeric" });
const fmtTime = fmt({ hour: "2-digit", minute: "2-digit" });
const fmtSec = fmt({ hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtSecPT = fmt(
	{ hour: "2-digit", minute: "2-digit", second: "2-digit" },
	"America/Los_Angeles",
);
const fmtWeekday = fmt({ weekday: "short", month: "short", day: "numeric" });
const fmtMonthDay = fmt({ month: "short", day: "numeric" });
const fmtMonth = fmt({ month: "short" });
const fmtYear = fmt({ year: "numeric" });

const pct = (a: number, b: number) => (a / b - 1) * 100;

function Pct({ v }: { v: number }) {
	return (
		<span className={v >= 0 ? "text-emerald-400" : "text-red-400"}>
			{v >= 0 ? "+" : ""}
			{v.toFixed(1)}%
		</span>
	);
}

// Exact time for hover cards: seconds in ET, with PT alongside.
function Stamp({ t, dayOnly }: { t: number; dayOnly?: boolean }) {
	if (dayOnly)
		return (
			<div className="font-mono text-zinc-300">{fmtDay.format(t * 1000)}</div>
		);
	return (
		<div className="font-mono text-zinc-200">
			{fmtSec.format(t * 1000)} ET{" "}
			<span className="text-zinc-500">
				· {fmtSecPT.format(t * 1000)} PT · {fmtWeekday.format(t * 1000)}
			</span>
		</div>
	);
}

/* ------------------------------------------------------------------ chart helpers */

// Index of the last bar that starts at or before t; -1 if t precedes every bar.
function snapIndex(bars: Bar[], t: number): number {
	let lo = 0;
	let hi = bars.length - 1;
	if (hi < 0 || t < bars[0].time) return -1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (bars[mid].time <= t) lo = mid;
		else hi = mid - 1;
	}
	return lo;
}

function defaultView(c: IChartApi, bars: Bar[], interval: Interval) {
	const last = bars[bars.length - 1].time;
	if (intraday(interval) && bars[0].time < REPLAY_VIEW[0]) {
		const pad =
			interval === "1m" ? 0 : interval === "1h" ? 86400 * 3 : 86400 * 0.5;
		c.timeScale().setVisibleRange({
			from: (REPLAY_VIEW[0] - pad * 1.5) as UTCTimestamp,
			to: (REPLAY_VIEW[1] + pad) as UTCTimestamp,
		});
		return;
	}
	const span = interval === "1d" ? 86400 * 75 : 86400 * 365 * 6;
	c.timeScale().setVisibleRange({
		from: (last - span) as UTCTimestamp,
		to: last as UTCTimestamp,
	});
}

function centerOn(c: IChartApi | null, interval: Interval, t: number) {
	if (!c) return;
	const span =
		interval === "1m" ? 7200 : intraday(interval) ? 86400 * 2 : 86400 * 365;
	c.timeScale().setVisibleRange({
		from: (t - span / 2) as UTCTimestamp,
		to: (t + span / 2) as UTCTimestamp,
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
					Nvidia (NVDA): did Telem's alerts pay off?
				</h1>
				<p className="mt-2 max-w-3xl text-sm text-zinc-400">
					Minute bars around Jensen Huang's resignation, with every post Telem
					collected. Hover a post or a numbered marker for its exact time and
					what acting on it would have returned. Times are New York (ET).
				</p>

				<div className="mt-6 flex gap-1 border-b border-zinc-800 text-sm">
					{(
						[
							["ours", "Alert replay"],
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

				{tab === "ours" ? <AlertReplay /> : <TradingViewWidget />}
			</div>
		</main>
	);
}

const CARD =
	"pointer-events-none absolute z-20 hidden w-80 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-xs leading-relaxed text-zinc-100 shadow-xl shadow-black/60 group-hover:block";

function AlertReplay() {
	const box = useRef<HTMLDivElement>(null);
	const chart = useRef<IChartApi | null>(null);
	const candles = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const volume = useRef<ISeriesApi<"Histogram"> | null>(null);
	const pinEls = useRef<(HTMLDivElement | null)[]>([]);
	const dotEls = useRef<(HTMLDivElement | null)[]>([]);
	const bandEls = useRef<(HTMLDivElement | null)[]>([]);
	const router = useRouter();
	const { i: interval } = Route.useLoaderDeps();
	const { packed, posts } = Route.useLoaderData();
	const bars = useMemo(() => unpack(packed), [packed]);
	const [hover, setHover] = useState<Bar | null>(null);
	const [ready, setReady] = useState(false);

	const isIntraday = intraday(interval);
	const pins = isIntraday ? pricePins : dayPins;
	// Posts that fall in the same bar share one dot, so none hide under another.
	const rugGroups = useMemo(() => {
		const groups: { i: number; posts: Post[] }[] = [];
		if (!isIntraday) return groups;
		for (const p of posts) {
			const i = snapIndex(bars, p.t);
			if (i < 0) continue;
			const g = groups.at(-1);
			if (g?.i === i) g.posts.push(p);
			else groups.push({ i, posts: [p] });
		}
		return groups;
	}, [isIntraday, posts, bars]);

	// Move pins and post dots to their bars' screen positions; hide off-screen ones.
	const place = useCallback(() => {
		const c = chart.current;
		const s = candles.current;
		if (!c || !s || !bars.length) return;
		const w = box.current?.clientWidth ?? 0;
		// Bar index = logical index, which also maps bars scrolled off-screen.
		const ts = c.timeScale();
		const xOf = (t: number) => {
			const i = snapIndex(bars, t);
			return { i, x: i < 0 ? null : ts.logicalToCoordinate(i as Logical) };
		};
		// Keep hover cards inside the chart near its left and right edges.
		const edge = (el: HTMLElement, x: number) => {
			const card = el.lastElementChild as HTMLElement | null;
			if (!card) return;
			const right = x > w - 160;
			const left = x < 160;
			card.style.left = right ? "auto" : left ? "-8px" : "50%";
			card.style.right = right ? "-8px" : "auto";
			card.style.transform = right || left ? "none" : "translateX(-50%)";
		};
		const stack = new Map<number, number>(); // pins already on a bar, so the next sits above
		pins.forEach((p, k) => {
			const el = pinEls.current[k];
			if (!el) return;
			const { i, x } = xOf(p.t);
			const n = stack.get(i) ?? 0;
			stack.set(i, n + 1);
			const high = i < 0 ? null : s.priceToCoordinate(bars[i].high);
			const y = high === null ? null : high - n * 24;
			if (x === null || y === null || x < 0 || x > w - 70) {
				el.style.display = "none";
				return;
			}
			el.style.display = "block";
			el.style.left = `${x}px`;
			el.style.top = `${y - 4}px`;
			edge(el, x);
		});
		rugGroups.forEach((g, k) => {
			const el = dotEls.current[k];
			if (!el) return;
			const x = ts.logicalToCoordinate(g.i as Logical);
			if (x === null || x < 48 || x > w - 70) {
				el.style.display = "none";
				return;
			}
			el.style.display = "block";
			el.style.left = `${x}px`;
			edge(el, x);
		});
		const half = ts.options().barSpacing / 2;
		const paneH = c.panes()[0]?.getHeight() ?? 0;
		BANDS.forEach((b, k) => {
			const el = bandEls.current[k];
			if (!el) return;
			const a = xOf(b.from).x;
			const z = xOf(b.to).x;
			if (!isIntraday || a === null || z === null) {
				el.style.display = "none";
				return;
			}
			const left = Math.max(0, a - half);
			el.style.display = "block";
			el.style.left = `${left}px`;
			el.style.width = `${Math.max(0, Math.min(w - 60, z + half) - left)}px`;
			el.style.height = `${paneH}px`;
		});
	}, [bars, pins, rugGroups, isIntraday]);
	const placeRef = useRef(place);
	placeRef.current = place;

	// Create the chart once (client only; the library touches the DOM).
	useEffect(() => {
		let disposed = false;
		let cleanup = () => {};
		lcModule?.then((lc) => {
			if (disposed || !box.current) return;
			const c = lc.createChart(box.current, {
				autoSize: true,
				layout: {
					background: { color: "transparent" },
					textColor: "#a1a1aa",
					panes: { separatorColor: "#27272a" },
				},
				grid: {
					vertLines: { color: "#141416" },
					horzLines: { color: "#141416" },
				},
				rightPriceScale: { borderColor: "#27272a" },
				timeScale: {
					borderColor: "#27272a",
					timeVisible: true,
					secondsVisible: false,
					rightOffset: 2,
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
					timeFormatter: (t: number) => `${fmtFull.format(t * 1000)} ET`,
				},
				crosshair: { mode: lc.CrosshairMode.Normal },
			});
			const cs = c.addSeries(lc.CandlestickSeries, {
				upColor: "#10b981",
				downColor: "#ef4444",
				borderVisible: false,
				wickUpColor: "#10b981",
				wickDownColor: "#ef4444",
				priceLineVisible: false,
			});
			const vs = c.addSeries(
				lc.HistogramSeries,
				{ priceFormat: { type: "volume" }, priceLineVisible: false },
				1,
			);
			c.panes()[1]?.setHeight(90);
			c.subscribeCrosshairMove((p) => {
				const d = p.seriesData.get(cs) as
					| (Omit<Bar, "v"> & { time: number })
					| undefined;
				setHover(d?.open !== undefined ? { ...d, v: 0 } : null);
			});
			const move = () => requestAnimationFrame(() => placeRef.current());
			c.timeScale().subscribeVisibleLogicalRangeChange(move);
			const ro = new ResizeObserver(move);
			ro.observe(box.current);
			chart.current = c;
			candles.current = cs;
			volume.current = vs;
			setReady(true);
			cleanup = () => {
				ro.disconnect();
				c.remove();
			};
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

	// Push bars into the chart, then frame the default view.
	useEffect(() => {
		const c = chart.current;
		if (!ready || !bars.length || !c) return;
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
		defaultView(c, bars, interval);
		requestAnimationFrame(() => placeRef.current());
	}, [bars, ready, interval]);

	const last = bars.at(-1);
	const prev = bars.at(-2);
	const shown = hover ?? last;

	// "What if you acted here" lines for times on Nov 12. A post is acted on at the close of the
	// first full minute after it (8:52:29 → the 8:53 bar's close), not at a price seen before it.
	const outcome = (t: number, post = false) => {
		if (!isIntraday || t < DAY2) return null;
		const i = snapIndex(bars, t);
		const bar = bars[post ? i + 1 : i];
		if (!bar) return null;
		const p = bar.close;
		return (
			<div className="mt-1.5 border-t border-zinc-700 pt-1.5 text-zinc-300">
				{post ? "Next full minute" : "Close"} ({fmtTime.format(bar.time * 1000)}
				): ${p.toFixed(2)}, <Pct v={pct(p, PREV_CLOSE)} /> vs. prior close
				<br />
				Sell here: avoids{" "}
				<span className="text-emerald-400">
					{(((p - DAY_LOW.price) / p) * 100).toFixed(1)}%
				</span>{" "}
				of the drop to the 9:31 low
				<br />
				Buy here, hold to the ${DAY_CLOSE} close: <Pct v={pct(DAY_CLOSE, p)} />
			</div>
		);
	};

	return (
		<section className="mt-4">
			{isIntraday && (
				<div className="mb-4 grid gap-2 sm:grid-cols-3">
					{insights.map((s) => (
						<div
							key={s.label}
							className={`rounded-lg border bg-zinc-900/40 px-3 py-2.5 ${s.tone === "bad" ? "border-red-500/30" : "border-zinc-800"}`}
						>
							<div className="text-xs text-zinc-400">{s.label}</div>
							<div
								className={`mt-0.5 text-xl font-semibold ${s.tone === "bad" ? "text-red-400" : "text-emerald-400"}`}
							>
								{s.value}
							</div>
							<div className="text-xs text-zinc-500">{s.note}</div>
						</div>
					))}
				</div>
			)}

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
							{(isIntraday ? fmtFull : fmtDay).format(shown.time * 1000)}
							{isIntraday && " ET"}
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

			{isIntraday && (
				<div className="relative z-30 mt-2 h-8 rounded-t-lg border border-b-0 border-zinc-800 bg-zinc-900/60">
					<span className="absolute left-2 top-1.5 text-[11px] text-sky-400">
						Telem
					</span>
					{rugGroups.map((g, k) => (
						<PostDot
							key={`${g.i}-${g.posts[0].url}`}
							ref={(el) => {
								dotEls.current[k] = el;
							}}
							posts={g.posts}
							outcome={outcome(g.posts[0].t, true)}
						/>
					))}
				</div>
			)}
			<div
				className={`relative h-[520px] border border-zinc-800 bg-zinc-950 ${isIntraday ? "rounded-b-lg" : "mt-2 rounded-lg"}`}
			>
				{BANDS.map((b, k) => (
					<div
						key={b.from}
						ref={(el) => {
							bandEls.current[k] = el;
						}}
						className={`absolute top-0 hidden ${b.cls}`}
					/>
				))}
				<div ref={box} className="absolute inset-0 overflow-hidden" />
				<div className="pointer-events-none absolute inset-0 z-10">
					{pins.map((p, k) => (
						<div
							key={p.t + p.title}
							ref={(el) => {
								pinEls.current[k] = el;
							}}
							className="group pointer-events-auto absolute hidden -translate-x-1/2 hover:z-30 -translate-y-full text-amber-500"
						>
							<button
								type="button"
								onClick={() => centerOn(chart.current, interval, p.t)}
								className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-semibold text-zinc-950 ring-2 ring-zinc-950"
							>
								{p.n}
							</button>
							<div className="mx-auto h-2.5 w-px bg-current opacity-70" />
							<div className={`${CARD} bottom-[calc(100%+6px)]`}>
								<div className="font-semibold">{p.title}</div>
								<Stamp t={p.t} dayOnly={!isIntraday} />
								<div className="text-zinc-300">{p.detail}</div>
								{outcome(p.t)}
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
				{isIntraday && (
					<>
						<span>
							<i className="mr-1.5 inline-block size-2.5 rounded-full bg-sky-400" />
							Telem post (large = first)
						</span>
						<span>
							<i className="mr-1.5 inline-block h-2.5 w-3.5 rounded-sm bg-red-500/25" />
							First alert to open: loss you could avoid
						</span>
						<span>
							<i className="mr-1.5 inline-block h-2.5 w-3.5 rounded-sm bg-emerald-500/25" />
							Low to rebound: buy-the-dip window
						</span>
					</>
				)}
				<span>
					<i className="mr-1.5 inline-block size-2.5 rounded-full bg-amber-500" />
					{isIntraday ? "Price event" : "Timeline event"} (click to center)
				</span>
			</div>
			{isIntraday && (
				<p className="mt-2 text-xs text-zinc-500">
					Pre-market trading is thin with wide spreads, so "loss avoided" uses
					1-minute closes and is an upper bound. Yahoo reports no volume before
					09:30 or after 16:00 ET; bars where it stored a running total are left
					out of the volume pane.
				</p>
			)}

			{isIntraday ? (
				<>
					<h2 className="mt-8 text-lg font-semibold">Who moved first</h2>
					<div className="mt-3 overflow-x-auto">
						<table className="w-full min-w-[560px] text-left text-sm">
							<thead className="text-zinc-400">
								<tr className="border-b border-zinc-800">
									<th className="py-2 pr-4 font-medium">Price move</th>
									<th className="py-2 pr-4 font-medium">Price moved (ET)</th>
									<th className="py-2 pr-4 font-medium">
										First Telem post (ET)
									</th>
									<th className="py-2 font-medium">Gap</th>
								</tr>
							</thead>
							<tbody>
								{leadLag.map(([move, price, post, gap], k) => (
									<tr key={move} className="border-b border-zinc-900">
										<td className="py-2 pr-4">{move}</td>
										<td className="py-2 pr-4 font-mono text-zinc-300">
											{price}
										</td>
										<td className="py-2 pr-4 font-mono text-zinc-300">
											{post}
										</td>
										<td
											className={`py-2 ${k === 2 ? "text-emerald-400" : "text-red-400"}`}
										>
											{gap}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			) : (
				<>
					<h2 className="mt-8 text-lg font-semibold">Event timeline</h2>
					<p className="mt-1 text-sm text-zinc-400">
						Click an event to center the chart on it.
					</p>
					<ol className="mt-3 space-y-2">
						{dayPins.map((e) => (
							<li key={e.t + e.title}>
								<button
									type="button"
									onClick={() => centerOn(chart.current, interval, e.t)}
									className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-left hover:border-amber-500/60"
								>
									<span className="text-sm font-medium text-amber-400">
										{e.n} · {e.title}
									</span>
									<span className="mt-1 block text-sm text-zinc-400">
										{e.detail}
									</span>
								</button>
							</li>
						))}
					</ol>
				</>
			)}
		</section>
	);
}

function PostDot({
	ref,
	posts,
	outcome,
}: {
	ref: (el: HTMLDivElement | null) => void;
	posts: Post[];
	outcome: React.ReactNode;
}) {
	const first = posts[0].t === FIRST_ALERT;
	const big = first || posts.length > 1;
	return (
		<div
			ref={ref}
			className="group absolute top-0 hidden h-8 w-3 -translate-x-1/2 hover:z-30"
		>
			<a
				href={posts[0].url}
				target="_blank"
				rel="noreferrer"
				className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[9px] font-semibold text-zinc-950 ring-2 ring-zinc-900 ${big ? "size-4" : "size-2.5"} ${first ? "bg-sky-300" : "bg-sky-400"}`}
			>
				{posts.length > 1 ? posts.length : ""}
				<span className="sr-only">{posts[0].title}</span>
			</a>
			<div className={`${CARD} top-[calc(100%+6px)]`}>
				{first && (
					<div className="font-semibold text-sky-300">Telem's first alert</div>
				)}
				{posts.slice(0, 4).map((p) => (
					<div key={p.url} className="mt-1 first:mt-0">
						<Stamp t={p.t} />
						<div className="text-zinc-300">
							<span className="font-semibold text-zinc-100">{p.platform}</span>{" "}
							· {p.title}
						</div>
					</div>
				))}
				{posts.length > 4 && (
					<div className="mt-1 text-zinc-500">
						+{posts.length - 4} more posts
					</div>
				)}
				{outcome}
			</div>
		</div>
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

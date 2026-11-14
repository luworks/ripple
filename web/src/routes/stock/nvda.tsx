import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import type {
	IChartApi,
	ISeriesApi,
	Logical,
	UTCTimestamp,
} from "lightweight-charts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { timeline } from "#/data/jensen-huang-timeline";
import sourcesData from "#/data/nvda-sources.json";
import {
	type Bar,
	getBars,
	getSecondBars,
	INTERVALS,
	type Interval,
	type Packed,
	type SecondSlice,
	unpack,
} from "#/server/stock";

const SYMBOL = "NVDA";

// "1s" is served in time windows (getSecondBars), so it is a view here, not a file interval.
type View = Interval | "1s";
// The second NVIDIA's CEO-transition release went out; 1s views measure everything from here.
const T0 = Date.parse("2026-11-12T13:48:12Z") / 1000;
// A 1s load covers [t - BEFORE, t + AFTER): ~30 min of bars, well under the server's 2 h cap.
const SEC_BEFORE = 600;
const SEC_AFTER = 1200;
const parseT = (v: unknown): number | undefined => {
	if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
	if (typeof v !== "string" || !v) return undefined;
	const n = /^\d+$/.test(v) ? Number(v) : Date.parse(v) / 1000;
	return Number.isFinite(n) ? Math.floor(n) : undefined;
};

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
					"Replay of Nvidia's minute bars around Jensen Huang's resignation, with every Telem and Tavily hit, which source found it first, and what acting on it would have returned.",
			},
		],
	}),
	validateSearch: (s: Record<string, unknown>): { i?: View; t?: number } => {
		const out: { i?: View; t?: number } = {};
		if (s.i === "1s" || INTERVALS.includes(s.i as Interval))
			out.i = s.i as View;
		const t = parseT(s.t);
		if (out.i === "1s" && t !== undefined) out.t = t;
		return out;
	},
	loaderDeps: ({ search }) => ({
		i: (search.i ?? "1m") as View,
		t: search.i === "1s" ? (search.t ?? T0) : T0,
	}),
	loader: async ({ deps }) => {
		if (deps.i === "1s") {
			const slice = JSON.parse(
				await getSecondBars({
					data: {
						symbol: SYMBOL,
						from: deps.t - SEC_BEFORE,
						to: deps.t + SEC_AFTER,
					},
				}),
			) as SecondSlice;
			// No 1s file on this deploy (or nothing in that window): fall back to minute bars.
			if (slice.start === null || !slice.packed.t.length)
				throw redirect({ to: "/stock/nvda", search: {}, replace: true });
			return { packed: slice.packed, center: deps.t };
		}
		const packed = await getBars({
			data: { symbol: SYMBOL, interval: deps.i },
		});
		return { packed: JSON.parse(packed) as Packed, center: null };
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

// Figures read off the 1-minute bars.
const DAY_LOW = { t: at("2026-11-12T14:31:00Z"), price: 148.8 };
const DAY_CLOSE = 166.19;
const ALERT_ZONE = [at("2026-11-12T13:52:00Z"), at("2026-11-12T14:30:00Z")];
const REBOUND_ZONE = [DAY_LOW.t, at("2026-11-12T14:58:00Z")];
// Shaded behind the candles on intraday charts.
const BANDS = [
	{ from: ALERT_ZONE[0], to: ALERT_ZONE[1], cls: "bg-red-500/15" },
	{ from: REBOUND_ZONE[0], to: REBOUND_ZONE[1], cls: "bg-emerald-500/15" },
];
const REPLAY_VIEW = [at("2026-11-12T13:30:00Z"), at("2026-11-12T15:35:00Z")];
// Hover cards show "what if you acted here" for times in this window (the scandal week up to
// Nov 12's close), measured against Nov 12's low and close.
const OUTCOME_WINDOW = [at("2026-11-08T00:00:00Z"), at("2026-11-12T21:00:00Z")];

// One dot on a source row: something Telem or Tavily found. Day-precision items are pinned to
// noon ET so they snap to their own daily bar; they only show on daily-and-above charts.
type Precision = "second" | "minute" | "day";
type Item = {
	t: number;
	precision: Precision;
	via: string;
	provider: string;
	platform: string;
	title: string;
	url: string;
	move: string | null;
	row: string; // "Platform · provider"
};

const items: Item[] = sourcesData.items
	.map((s) => {
		const precision = s.precision as Precision;
		return {
			t: precision === "day" ? at(`${s.t.slice(0, 10)}T17:00:00Z`) : at(s.t),
			precision,
			via: s.via,
			provider: s.provider,
			platform: s.platform,
			title: s.title,
			url: s.url,
			move: s.move as string | null,
			row: `${s.platform} · ${s.provider}`,
		};
	})
	.sort((a, b) => a.t - b.t);

// Search stats per row, for the label tooltip.
const providerStats = new Map(
	sourcesData.providers.map((p) => [`${p.platform} · ${p.provider}`, p]),
);

// One colour per pipeline; the row label carries the platform and provider.
const VIA: Record<string, { dot: string; first: string; text: string }> = {
	telem: { dot: "bg-sky-400", first: "bg-sky-300", text: "text-sky-300" },
	tavily: {
		dot: "bg-orange-400",
		first: "bg-orange-300",
		text: "text-orange-300",
	},
};
const viaOf = (via: string) =>
	VIA[via] ?? {
		dot: "bg-zinc-400",
		first: "bg-zinc-300",
		text: "text-zinc-300",
	};

// Intraday moves from the move scan (/tmp/nvda-news/moves.json); start = when price began moving.
const MOVES = [
	{
		id: "I-1109-1103",
		move: "Intraday −2.0%",
		start: at("2026-11-09T16:03:00Z"),
	},
	{
		id: "I-1111-1655",
		move: "After-hours −3.6%",
		start: at("2026-11-11T21:55:00Z"),
	},
	{
		id: "I-1111-1728",
		move: "After-hours −5.3%",
		start: at("2026-11-11T22:28:00Z"),
	},
	{
		id: "I-1112-0848",
		move: "Pre-market −2.9%",
		start: at("2026-11-12T13:48:00Z"),
	},
	{
		id: "I-1113-0930",
		move: "Intraday −2.1%",
		start: at("2026-11-13T14:30:00Z"),
	},
];
const LEAD = 15 * 60; // a hit this long before the move still counts as warning
const HORIZON = 24 * 3600; // later than this, the sources missed it

// Earliest item tagged with the move, or the earliest timed item from LEAD before it to HORIZON after.
function firstHit(id: string, start: number): Item | undefined {
	return items.find(
		(i) =>
			i.move === id ||
			(i.precision !== "day" && i.t >= start - LEAD && i.t <= start + HORIZON),
	);
}

const alertMove = MOVES[3];
const FIRST_ALERT = firstHit(alertMove.id, alertMove.start);

const leadLag = MOVES.map((m) => ({ ...m, hit: firstHit(m.id, m.start) }));

function duration(s: number) {
	const a = Math.round(Math.abs(s));
	const h = Math.floor(a / 3600);
	const m = Math.floor((a % 3600) / 60);
	if (h) return `${h} h ${m} m`;
	return m ? `${m} m ${a % 60} s` : `${a} s`;
}

type Pin = { t: number; n: string; title: string; detail: string };

const pricePins: Pin[] = [
	{
		t: at("2026-11-11T21:55:00Z"),
		n: "1",
		title: "NYT story, first after-hours drop",
		detail:
			"The New York Times publishes at 16:55:36 ET; $174.58 to $168.26 by 16:59 (−3.6%).",
	},
	{
		t: at("2026-11-11T22:28:00Z"),
		n: "2",
		title: "WSJ scoop, after-hours low",
		detail:
			"WSJ: the board is preparing to oust Huang (17:28 ET). $165.27 to $156.46 in one minute (−5.3%), −10.4% from 16:54.",
	},
	{
		t: at("2026-11-12T13:48:00Z"),
		n: "3",
		title: "Resignation announced, pre-market",
		detail:
			"$159.00 to $154.66 by 08:54. First wire post on X at 08:49:33; 8-K accepted 08:52:41.",
	},
	{
		t: at("2026-11-12T14:30:00Z"),
		n: "4",
		title: "Open at $149.27",
		detail: "−14.1% vs. the $173.73 prior close.",
	},
	{
		t: DAY_LOW.t,
		n: "5",
		title: "Day low $148.80",
		detail:
			"One minute after the open, during the busiest stretch of Telem posts.",
	},
	{
		t: at("2026-11-12T14:58:00Z"),
		n: "6",
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

const intervals: { id: View; label: string; span: string }[] = [
	{ id: "1s", label: "1s", span: "Oct 16 – Nov 13, 30 min at a time" },
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
const BAR_MIN: Partial<Record<Interval, number>> = {
	"1m": 1,
	"2m": 2,
	"5m": 5,
	"15m": 15,
	"30m": 30,
	"1h": 60,
};
const intraday = (i: View) => !["1d", "1wk", "1mo"].includes(i);

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
const fmtTimePT = fmt(
	{ hour: "2-digit", minute: "2-digit" },
	"America/Los_Angeles",
);
const fmtWeekday = fmt({ weekday: "short", month: "short", day: "numeric" });
const fmtMonthDay = fmt({ month: "short", day: "numeric" });
const fmtMonth = fmt({ month: "short" });
const fmtYear = fmt({ year: "numeric" });
const fmtDayMin = fmt({
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});
const fmtDaySec = fmt({
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
});
// An item's time at the precision its source gave.
const when = (it: Item) =>
	(it.precision === "day"
		? fmtDay
		: it.precision === "minute"
			? fmtDayMin
			: fmtDaySec
	).format(it.t * 1000);

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
function Stamp({
	t,
	dayOnly,
	minute,
}: {
	t: number;
	dayOnly?: boolean;
	minute?: boolean;
}) {
	if (dayOnly)
		return (
			<div className="font-mono text-zinc-300">{fmtDay.format(t * 1000)}</div>
		);
	return (
		<div className="font-mono text-zinc-200">
			{(minute ? fmtTime : fmtSec).format(t * 1000)} ET{" "}
			<span className="text-zinc-500">
				· {(minute ? fmtTimePT : fmtSecPT).format(t * 1000)} PT ·{" "}
				{fmtWeekday.format(t * 1000)}
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

// First index in time-sorted items whose t is at or after t.
function lowerBound(list: Item[], t: number): number {
	let lo = 0;
	let hi = list.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (list[mid].t < t) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

function defaultView(
	c: IChartApi,
	bars: Bar[],
	interval: View,
	center: number | null,
) {
	if (interval === "1s" && center !== null) {
		c.timeScale().setVisibleRange({
			from: (center - 180) as UTCTimestamp,
			to: (center + 420) as UTCTimestamp,
		});
		return;
	}
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

function centerOn(c: IChartApi | null, interval: View, t: number) {
	if (!c) return;
	const span =
		interval === "1s"
			? 600
			: interval === "1m"
				? 7200
				: intraday(interval)
					? 86400 * 2
					: 86400 * 365;
	c.timeScale().setVisibleRange({
		from: (t - span / 2) as UTCTimestamp,
		to: (t + span / 2) as UTCTimestamp,
	});
}

/* ------------------------------------------------------------------ page */

function NvdaPage() {
	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
			<div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
				<p className="text-sm text-emerald-400">Stock · NASDAQ</p>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
					Nvidia (NVDA): did Telem's alerts pay off?
				</h1>
				<p className="mt-2 max-w-3xl text-sm text-zinc-400">
					Minute bars around Jensen Huang's resignation, with one row per
					platform and search provider for everything Telem and Tavily found, so
					you can see which source surfaced it first. Press Play to walk the
					timeline. Hover a dot or a numbered marker for its exact time and what
					acting on it would have returned. Times are New York (ET).
				</p>
				<AlertReplay />
			</div>
		</main>
	);
}

const CARD =
	"absolute z-20 hidden w-80 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-xs leading-relaxed text-zinc-100 shadow-xl shadow-black/60 group-hover:block";
const LABEL_W = "grid-cols-[176px_minmax(0,1fr)]";
const TOP_ROWS = 10;
const SPEEDS = [1, 5, 30]; // minutes of bars per second (seconds of bars per second on 1s)

// "T+33s" / "T−2m05s" from the announcement second.
function fromT0(t: number) {
	const d = Math.round(t - T0);
	const a = Math.abs(d);
	const m = Math.floor(a / 60);
	const r = a % 60;
	return `T${d < 0 ? "−" : "+"}${m ? `${m}m${String(r).padStart(2, "0")}s` : `${r}s`}`;
}

function AlertReplay() {
	const box = useRef<HTMLDivElement>(null);
	const chart = useRef<IChartApi | null>(null);
	const candles = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const volume = useRef<ISeriesApi<"Histogram"> | null>(null);
	const pinEls = useRef<(HTMLDivElement | null)[]>([]);
	const dotEls = useRef<Record<string, (HTMLDivElement | null)[]>>({});
	const bandEls = useRef<(HTMLDivElement | null)[]>([]);
	const maskEl = useRef<HTMLDivElement>(null);
	const router = useRouter();
	const { i: interval } = Route.useLoaderDeps();
	const { packed, center } = Route.useLoaderData();
	const isSec = interval === "1s";
	const bars = useMemo(() => unpack(packed), [packed]);
	const [hover, setHover] = useState<Bar | null>(null);
	const [ready, setReady] = useState(false);
	const [showAll, setShowAll] = useState(false);
	// [first, last) indexes into `eligible` of the items inside the visible time range.
	const [inView, setInView] = useState<[number, number]>([0, 0]);

	// Play mode: cursor = index of the last bar shown; feed starts at bar `start`.
	const [playing, setPlaying] = useState(false);
	const [speed, setSpeed] = useState(5);
	const [cursor, setCursor] = useState<number | null>(null);
	const [start, setStart] = useState(0);
	const pos = useRef(0);
	const end = useRef(0);
	const cursorRef = useRef(cursor);
	cursorRef.current = cursor;

	const isIntraday = intraday(interval);
	const pins = isIntraday ? pricePins : dayPins;
	const eligible = useMemo(
		() =>
			isSec
				? items.filter((i) => i.precision === "second")
				: isIntraday
					? items.filter((i) => i.precision !== "day")
					: items,
		[isIntraday, isSec],
	);
	// Close of the 1s bar at T0, the base for every "% vs T0" on the 1s view.
	const t0Close = useMemo(() => {
		if (!isSec) return null;
		const i = snapIndex(bars, T0);
		return i < 0 ? null : bars[i].close;
	}, [isSec, bars]);
	const barOf = useMemo(
		() => eligible.map((it) => snapIndex(bars, it.t)),
		[eligible, bars],
	);

	// One row per platform · provider, fastest source (earliest item in view) on top.
	const rows = useMemo(() => {
		const map = new Map<
			string,
			{ key: string; via: string; all: number[]; count: number; first?: Item }
		>();
		eligible.forEach((it, k) => {
			let r = map.get(it.row);
			if (!r) {
				r = { key: it.row, via: it.via, all: [], count: 0 };
				map.set(it.row, r);
			}
			r.all.push(k);
			if (k >= inView[0] && k < inView[1]) {
				r.count++;
				r.first ??= it;
			}
		});
		return [...map.values()]
			.map((r) => {
				// Items that fall in the same bar share one dot, so none hide under another.
				const groups: { i: number; items: Item[] }[] = [];
				for (const k of r.all) {
					const i = barOf[k];
					if (i < 0) continue;
					const g = groups.at(-1);
					if (g?.i === i) g.items.push(eligible[k]);
					else groups.push({ i, items: [eligible[k]] });
				}
				return { ...r, groups, earliest: eligible[r.all[0]].t };
			})
			.sort(
				(a, b) =>
					(a.first?.t ?? Number.POSITIVE_INFINITY) -
						(b.first?.t ?? Number.POSITIVE_INFINITY) || a.earliest - b.earliest,
			);
	}, [eligible, barOf, inView]);
	const shownRows = showAll ? rows : rows.slice(0, TOP_ROWS);

	// Recount the items in view only when one enters or leaves, not on every scroll frame.
	const countInView = useCallback(() => {
		const r = chart.current?.timeScale().getVisibleRange();
		if (!r) return;
		const lo = lowerBound(eligible, r.from as number);
		const hi = lowerBound(eligible, (r.to as number) + 1);
		setInView((v) => (v[0] === lo && v[1] === hi ? v : [lo, hi]));
	}, [eligible]);
	const countRef = useRef(countInView);
	countRef.current = countInView;

	// Move pins, dots, bands and the play mask to their bars' screen positions.
	const place = useCallback(() => {
		const c = chart.current;
		const s = candles.current;
		if (!c || !s || !bars.length) return;
		const w = box.current?.clientWidth ?? 0;
		const cur = cursorRef.current;
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
			if (
				x === null ||
				y === null ||
				x < 0 ||
				x > w - 70 ||
				(cur !== null && i > cur)
			) {
				el.style.display = "none";
				return;
			}
			el.style.display = "block";
			el.style.left = `${x}px`;
			el.style.top = `${y - 4}px`;
			edge(el, x);
		});
		for (const row of shownRows)
			row.groups.forEach((g, k) => {
				const el = dotEls.current[row.key]?.[k];
				if (!el) return;
				const x = ts.logicalToCoordinate(g.i as Logical);
				if (x === null || x < 4 || x > w - 70 || (cur !== null && g.i > cur)) {
					el.style.display = "none";
					return;
				}
				el.style.display = "block";
				el.style.left = `${x}px`;
				edge(el, x);
			});
		const half = ts.options().barSpacing / 2;
		const plotW = w - c.priceScale("right").width();
		const plotH = (box.current?.clientHeight ?? 0) - ts.height();
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
			el.style.width = `${Math.max(0, Math.min(plotW, z + half) - left)}px`;
			el.style.height = `${paneH}px`;
		});
		// Play mode hides every bar after the cursor behind an opaque mask.
		const mask = maskEl.current;
		if (mask) {
			const x = cur === null ? null : ts.logicalToCoordinate(cur as Logical);
			if (x === null) mask.style.display = "none";
			else {
				const left = Math.max(0, Math.min(plotW, x + half));
				mask.style.display = "block";
				mask.style.left = `${left}px`;
				mask.style.width = `${plotW - left}px`;
				mask.style.height = `${plotH}px`;
			}
		}
	}, [bars, pins, shownRows, isIntraday]);
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
				rightPriceScale: { borderColor: "#27272a", minimumWidth: 64 },
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
						return (type === 4 ? fmtSec : fmtTime).format(ms);
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
			const move = () =>
				requestAnimationFrame(() => {
					placeRef.current();
					countRef.current();
				});
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
				// 1s is never preloaded: it is loaded by time window on demand.
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

	// Push bars into the chart, then frame the default view. New bars end any replay.
	useEffect(() => {
		const c = chart.current;
		setPlaying(false);
		setCursor(null);
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
		const sec = interval === "1s";
		c.applyOptions({
			timeScale: { secondsVisible: sec },
			localization: {
				timeFormatter: (x: number) =>
					`${(sec ? fmtDaySec : fmtFull).format(x * 1000)} ET`,
			},
		});
		defaultView(c, bars, interval, center);
		requestAnimationFrame(() => {
			placeRef.current();
			countRef.current();
		});
	}, [bars, ready, interval, center]);

	// The last-value label would reveal the final price during a replay.
	const replaying = cursor !== null;
	useEffect(() => {
		if (!ready) return;
		candles.current?.applyOptions({ lastValueVisible: !replaying });
		volume.current?.applyOptions({ lastValueVisible: !replaying });
	}, [ready, replaying]);

	// Re-place after any render that may have changed rows, the cursor or the dots.
	useEffect(() => {
		placeRef.current();
	});

	/* ---------------------------------------------------------------- play mode */

	// Keep the cursor in view: once it nears the right edge, scroll it back to 70% across.
	const follow = useCallback((i: number) => {
		const ts = chart.current?.timeScale();
		const r = ts?.getVisibleLogicalRange();
		if (!ts || !r) return;
		const len = r.to - r.from;
		if (i > r.to - len * 0.1 || i < r.from)
			ts.setVisibleLogicalRange({ from: i - len * 0.7, to: i + len * 0.3 });
	}, []);

	const jump = useCallback(
		(i: number) => {
			if (i < start) setStart(i);
			end.current = Math.max(end.current, i);
			pos.current = i;
			setCursor(i);
			follow(i);
		},
		[start, follow],
	);

	const play = () => {
		if (cursor === null || pos.current >= end.current) {
			const r = chart.current?.timeScale().getVisibleLogicalRange();
			const s = Math.max(
				0,
				Math.min(bars.length - 1, Math.ceil((r?.from as number) ?? 0)),
			);
			end.current =
				bars[s].time < REPLAY_VIEW[1]
					? snapIndex(bars, REPLAY_VIEW[1])
					: bars.length - 1;
			pos.current = s;
			setStart(s);
			setCursor(s);
		}
		setPlaying(true);
	};

	const reset = () => {
		setPlaying(false);
		setCursor(null);
	};

	// Advance by `speed` minutes of bars per second; overnight gaps are skipped, not waited out.
	useEffect(() => {
		if (!playing) return;
		// On 1s a bar is 1/60 minute, so `speed` reads as seconds of bars per second.
		const perBar = interval === "1s" ? 1 : (BAR_MIN[interval as Interval] ?? 1);
		let last = performance.now();
		let id = 0;
		const step = (now: number) => {
			const dt = Math.min(0.1, (now - last) / 1000);
			last = now;
			pos.current = Math.min(end.current, pos.current + (speed * dt) / perBar);
			const i = Math.floor(pos.current);
			if (i !== cursorRef.current) {
				cursorRef.current = i;
				setCursor(i);
				follow(i);
			}
			if (pos.current >= end.current) {
				setPlaying(false);
				return;
			}
			id = requestAnimationFrame(step);
		};
		id = requestAnimationFrame(step);
		return () => cancelAnimationFrame(id);
	}, [playing, speed, interval, follow]);

	useEffect(() => {
		const pause = () => document.hidden && setPlaying(false);
		document.addEventListener("visibilitychange", pause);
		return () => document.removeEventListener("visibilitychange", pause);
	}, []);

	// Items the cursor has passed since the replay started, newest first.
	const feed = useMemo(() => {
		if (cursor === null) return [];
		const out: { it: Item; i: number }[] = [];
		eligible.forEach((it, k) => {
			const i = barOf[k];
			if (i >= start && i <= cursor) out.push({ it, i });
		});
		return out.reverse();
	}, [cursor, start, eligible, barOf]);
	const newest = feed[0]?.it.url;

	const last = bars.at(-1);
	const prev = bars.at(-2);
	const shown = hover ?? last;
	const cursorBar = cursor === null ? undefined : bars[cursor];

	// "What if you acted here" for the scandal week. An item is acted on at the close of the first
	// full bar after it (8:52:29 → the 8:53 bar's close), never at an earlier price.
	const outcome = (t: number, item = false) => {
		if (isSec) {
			const i = snapIndex(bars, t);
			if (i < 0 || t0Close === null) return null;
			const p = bars[i].close;
			return (
				<div className="mt-1.5 border-t border-zinc-700 pt-1.5 font-mono text-zinc-300">
					{fromT0(t)} · ${p.toFixed(2)} at {fmtSec.format(bars[i].time * 1000)}{" "}
					ET · <Pct v={pct(p, t0Close)} /> vs T0
				</div>
			);
		}
		if (!isIntraday || t < OUTCOME_WINDOW[0] || t > OUTCOME_WINDOW[1])
			return null;
		const i = snapIndex(bars, t);
		const bar = bars[item ? i + 1 : i];
		if (!bar) return null;
		const p = bar.close;
		return (
			<div className="mt-1.5 border-t border-zinc-700 pt-1.5 text-zinc-300">
				{item ? "Next full minute" : "Close"} ({fmtTime.format(bar.time * 1000)}
				): ${p.toFixed(2)}
				{bar.time < DAY_LOW.t && p > DAY_LOW.price && (
					<>
						<br />
						Sell here: avoids{" "}
						<span className="text-emerald-400">
							{(((p - DAY_LOW.price) / p) * 100).toFixed(1)}%
						</span>{" "}
						of the drop to the Nov 12 9:31 low
					</>
				)}
				<br />
				Buy here, hold to the Nov 12 ${DAY_CLOSE} close:{" "}
				<Pct v={pct(DAY_CLOSE, p)} />
			</div>
		);
	};

	// Tiles cite item times from the data; a claim with no matching item is left out.
	const insights = useMemo(() => {
		const out: {
			label: string;
			value: string;
			note: string;
			tone: "good" | "bad";
		}[] = [];
		const a = FIRST_ALERT;
		const next = a ? bars[snapIndex(bars, a.t) + 1] : undefined;
		if (a && next && next.close > DAY_LOW.price) {
			const p = next.close;
			out.push({
				label: `Sell on the first hit about the resignation (${fmtSec.format(a.t * 1000)} ET, ${a.row}; $${p.toFixed(2)} at ${fmtTime.format(next.time * 1000)})`,
				value: `${(((p - DAY_LOW.price) / p) * 100).toFixed(1)}% loss avoided`,
				note: `vs. the $${DAY_LOW.price.toFixed(2)} low at 9:31`,
				tone: "good",
			});
		} else
			out.push({
				label: "Sell at the 8:48 pre-market drop ($159.00)",
				value: `${(((159 - DAY_LOW.price) / 159) * 100).toFixed(1)}% loss avoided`,
				note: "No Telem or Tavily hit came before the open",
				tone: "good",
			});
		const peak = items.filter(
			(i) =>
				i.precision !== "day" &&
				i.t >= at("2026-11-12T14:00:00Z") &&
				i.t < at("2026-11-12T15:00:00Z"),
		).length;
		out.push({
			label: peak
				? `${peak} hits 9:00–10:00 ET, at the bottom`
				: "Bottom at 9:31 ET",
			value: "+9.4% in 27 min",
			note: "From $148.80 at 9:31 to $162.72 at 9:58; +12.3% to the 11:12 high",
			tone: "good",
		});
		const nyt = leadLag[1].hit;
		out.push({
			label: "Missed: the after-hours drop at 16:55 ET, Nov 11",
			value: "13.1% left on the table",
			note: `Selling at $171.14 (16:56) vs. the Nov 12 low. Price fell 10.4% by 17:28${nyt ? `; the first hit (${nyt.row}) came at ${fmtDaySec.format(nyt.t * 1000)}` : ""}.`,
			tone: "bad",
		});
		return out;
	}, [bars]);

	return (
		<section className="mt-6">
			{isIntraday && (
				<div className="mb-4 grid gap-2 sm:grid-cols-3">
					{insights.map((s) => (
						<div
							key={s.value}
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
				{isIntraday && (
					<div className="ml-auto flex flex-wrap items-center gap-1 text-sm">
						<button
							type="button"
							onClick={() => (playing ? setPlaying(false) : play())}
							className="rounded-md bg-emerald-500 px-3 py-1 font-medium text-zinc-950 hover:bg-emerald-400"
						>
							{playing ? "Pause" : cursor === null ? "Play" : "Resume"}
						</button>
						<div className="flex rounded-md border border-zinc-800">
							{SPEEDS.map((v) => (
								<button
									key={v}
									type="button"
									onClick={() => setSpeed(v)}
									aria-pressed={speed === v}
									className={`px-2 py-1 text-xs ${speed === v ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
								>
									{v}
									{isSec ? "×" : " min/s"}
								</button>
							))}
						</div>
						<button
							type="button"
							onClick={reset}
							disabled={cursor === null}
							className="rounded-md px-2.5 py-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-40"
						>
							Reset
						</button>
					</div>
				)}
			</div>

			<div className="mt-3 flex min-h-6 flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-zinc-400">
				{cursorBar && (
					<span className="rounded bg-zinc-800 px-1.5 text-zinc-100">
						Replay at{" "}
						{(isSec ? fmtDaySec : fmtFull).format(cursorBar.time * 1000)} ET · $
						{cursorBar.close.toFixed(2)}
					</span>
				)}
				{shown && (
					<>
						<span className="text-zinc-200">
							{isSec ? (
								<>
									{fmtDaySec.format(shown.time * 1000)} ET ·{" "}
									{fmtSecPT.format(shown.time * 1000)} PT · {fromT0(shown.time)}
								</>
							) : (
								<>
									{(isIntraday ? fmtFull : fmtDay).format(shown.time * 1000)}
									{isIntraday && " ET"}
								</>
							)}
						</span>
						{t0Close !== null && (
							<span>
								<Pct v={pct(shown.close, t0Close)} /> vs T0
							</span>
						)}
						<span>O {shown.open.toFixed(2)}</span>
						<span>H {shown.high.toFixed(2)}</span>
						<span>L {shown.low.toFixed(2)}</span>
						<span>C {shown.close.toFixed(2)}</span>
						{!hover && !cursorBar && prev && last && (
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

			<div className="relative z-30 mt-2 rounded-t-lg border border-b-0 border-zinc-800 bg-zinc-900/60">
				{shownRows.map((row) => {
					const st = providerStats.get(row.key);
					return (
						<div
							key={row.key}
							className={`grid ${LABEL_W} border-b border-zinc-800/60`}
						>
							<div
								className="flex h-8 min-w-0 flex-col justify-center border-r border-zinc-800 px-2 leading-tight"
								title={
									st
										? `${row.via} · ${st.queries} queries · ${st.results} results · ${st.dated} dated`
										: row.via
								}
							>
								<span className="flex items-center gap-1.5 truncate text-[11px] text-zinc-200">
									<i
										className={`inline-block size-2 shrink-0 rounded-full ${viaOf(row.via).dot}`}
									/>
									<span className="truncate">{row.key}</span>
								</span>
								<span className="truncate font-mono text-[10px] text-zinc-500">
									{row.first
										? `${row.count} · ${when(row.first)}`
										: `0 in view · ${row.all.length} total`}
								</span>
							</div>
							<div className="relative h-8">
								{row.groups.map((g, k) => (
									<Dot
										key={`${g.i}-${g.items[0].url}`}
										ref={(el) => {
											dotEls.current[row.key] ??= [];
											dotEls.current[row.key][k] = el;
										}}
										items={g.items}
										pulse={g.items.some((it) => it.url === newest)}
										onJump={cursor === null ? undefined : () => jump(g.i)}
										outcome={outcome(g.items[0].t, true)}
									/>
								))}
							</div>
						</div>
					);
				})}
				{rows.length > TOP_ROWS && (
					<button
						type="button"
						onClick={() => setShowAll((v) => !v)}
						className="w-full border-b border-zinc-800/60 px-2 py-1 text-left text-xs text-zinc-400 hover:text-zinc-200"
					>
						{showAll
							? `Show top ${TOP_ROWS}`
							: `Show all ${rows.length} sources`}
					</button>
				)}
				{!rows.length && (
					<div className="px-2 py-1.5 text-xs text-zinc-500">
						No Telem or Tavily items for this interval.
					</div>
				)}
			</div>
			<div
				className={`grid ${LABEL_W} rounded-b-lg border border-zinc-800 bg-zinc-950`}
			>
				<div className="space-y-2 border-r border-zinc-800 p-2 text-[11px] leading-snug text-zinc-400">
					<p className="text-zinc-500">
						Rows: platform · provider, earliest in view on top. Count and first
						time are for the visible range.
					</p>
					{isIntraday && (
						<>
							<p>
								<i className="mr-1.5 inline-block size-2.5 rounded-full bg-sky-400" />
								Telem (number = items that bar)
							</p>
							<p>
								<i className="mr-1.5 inline-block size-2.5 rounded-full bg-orange-400" />
								Tavily
							</p>
							<p>
								<i className="mr-1.5 inline-block h-2.5 w-3.5 rounded-sm bg-red-500/25" />
								First alert to open: loss you could avoid
							</p>
							<p>
								<i className="mr-1.5 inline-block h-2.5 w-3.5 rounded-sm bg-emerald-500/25" />
								Low to rebound: buy-the-dip window
							</p>
						</>
					)}
					<p>
						<i className="mr-1.5 inline-block size-2.5 rounded-full bg-amber-500" />
						{isIntraday ? "Price event" : "Timeline event"} (click to center)
					</p>
				</div>
				<div className="relative h-[520px]">
					{BANDS.map((b, k) => (
						<div
							key={b.from}
							ref={(el) => {
								bandEls.current[k] = el;
							}}
							className={`absolute top-0 hidden ${b.cls}`}
						/>
					))}
					{/* z-0: the chart's canvases set z-index; keep them under the mask and pins. */}
					<div ref={box} className="absolute inset-0 z-0 overflow-hidden" />
					<div
						ref={maskEl}
						className="pointer-events-none absolute top-0 z-[5] hidden border-l border-dashed border-zinc-400 bg-zinc-950"
					/>
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
								<div
									className={`${CARD} pointer-events-none bottom-[calc(100%+6px)]`}
								>
									<div className="font-semibold">{p.title}</div>
									<Stamp t={p.t} dayOnly={!isIntraday} />
									<div className="text-zinc-300">{p.detail}</div>
									{outcome(p.t)}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			{isIntraday && (
				<Feed
					feed={feed}
					bars={bars}
					cursor={cursor}
					playing={playing}
					onJump={jump}
				/>
			)}
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
					<p className="mt-1 text-sm text-zinc-400">
						Price vs. the first Telem or Tavily hit (tagged with the move, or
						the earliest from 15 min before it to 24 h after). Click a row to
						center the chart on it.
					</p>
					<div className="mt-3 overflow-x-auto">
						<table className="w-full min-w-[720px] text-left text-sm">
							<thead className="text-zinc-400">
								<tr className="border-b border-zinc-800">
									<th className="py-2 pr-4 font-medium">Price move</th>
									<th className="py-2 pr-4 font-medium">Price moved (ET)</th>
									<th className="py-2 pr-4 font-medium">
										First hit (source, ET)
									</th>
									<th className="py-2 font-medium">Gap</th>
								</tr>
							</thead>
							<tbody>
								{leadLag.map((r) => {
									const gap = r.hit ? r.hit.t - r.start : null;
									return (
										<tr
											key={r.id}
											onClick={() => centerOn(chart.current, interval, r.start)}
											className="cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/60"
										>
											<td className="py-2 pr-4">{r.move}</td>
											<td className="py-2 pr-4 font-mono text-zinc-300">
												{fmtDayMin.format(r.start * 1000)}
											</td>
											<td className="py-2 pr-4">
												{r.hit ? (
													<>
														<span className="font-mono text-zinc-200">
															{when(r.hit)}
														</span>{" "}
														<span className={viaOf(r.hit.via).text}>
															{r.hit.row}
														</span>
													</>
												) : (
													<span className="text-zinc-500">None</span>
												)}
											</td>
											<td
												className={`py-2 ${gap !== null && gap <= 60 ? "text-emerald-400" : "text-red-400"}`}
											>
												{gap === null
													? "Missed: nothing within 24 h"
													: Math.abs(gap) < 60
														? "Same minute as the move"
														: gap < 0
															? `${duration(gap)} before the move`
															: `${duration(gap)} after the move`}
											</td>
										</tr>
									);
								})}
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

// Play-mode feed: items in the order the cursor reached them, each with the price move since.
function Feed({
	feed,
	bars,
	cursor,
	playing,
	onJump,
}: {
	feed: { it: Item; i: number }[];
	bars: Bar[];
	cursor: number | null;
	playing: boolean;
	onJump: (i: number) => void;
}) {
	const now = cursor === null ? undefined : bars[cursor];
	return (
		<div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40">
			<div className="flex items-baseline justify-between border-b border-zinc-800 px-3 py-2 text-xs">
				<span className="font-medium text-zinc-200">Replay feed</span>
				<span className="text-zinc-500">
					{cursor === null
						? "Press Play to walk the timeline from the left edge of the chart"
						: `${feed.length} item${feed.length === 1 ? "" : "s"} so far${playing ? "" : " · paused"} · click one to jump`}
				</span>
			</div>
			{feed.length > 0 && (
				<ol className="max-h-72 overflow-y-auto">
					{feed.slice(0, 200).map(({ it, i }, k) => {
						// Acted on at the close of the next full bar, measured to the cursor bar.
						const entry =
							cursor !== null && i + 1 <= cursor ? bars[i + 1] : null;
						return (
							<li key={`${it.url}-${it.t}-${it.provider}`}>
								<button
									type="button"
									onClick={() => onJump(i)}
									className={`grid w-full grid-cols-[150px_minmax(0,1fr)_230px] items-baseline gap-3 border-b border-zinc-800/60 px-3 py-1.5 text-left text-xs hover:bg-zinc-800/50 ${k === 0 ? "bg-zinc-800/70 ring-1 ring-inset ring-emerald-500/50" : ""}`}
								>
									<span className="font-mono text-zinc-300">{when(it)} ET</span>
									<span className="min-w-0 truncate text-zinc-300">
										<i
											className={`mr-1.5 inline-block size-2 rounded-full ${viaOf(it.via).dot}`}
										/>
										<span className="font-semibold text-zinc-100">
											{it.row}
										</span>{" "}
										· {it.title}
									</span>
									<span className="text-right font-mono">
										{entry && now ? (
											<>
												<Pct v={pct(now.close, entry.close)} />{" "}
												<span className="text-zinc-500">
													since ${entry.close.toFixed(2)} (
													{fmtTime.format(entry.time * 1000)})
												</span>
											</>
										) : (
											<span className="text-zinc-500">next bar pending</span>
										)}
									</span>
								</button>
							</li>
						);
					})}
				</ol>
			)}
		</div>
	);
}

function Dot({
	ref,
	items,
	pulse,
	onJump,
	outcome,
}: {
	ref: (el: HTMLDivElement | null) => void;
	items: Item[];
	pulse: boolean;
	onJump?: () => void;
	outcome: React.ReactNode;
}) {
	const first = FIRST_ALERT !== undefined && items.includes(FIRST_ALERT);
	const big = first || items.length > 1;
	const c = viaOf(items[0].via);
	const fill = first ? c.first : c.dot;
	return (
		<div
			ref={ref}
			className="group absolute top-0 hidden h-8 w-3 -translate-x-1/2 hover:z-30"
		>
			{pulse && (
				<span
					key={items.at(-1)?.url}
					className={`pointer-events-none absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full [animation-iteration-count:3] ${c.dot}`}
				/>
			)}
			<a
				href={items[0].url}
				target="_blank"
				rel="noreferrer"
				onClick={(e) => {
					if (!onJump) return;
					e.preventDefault();
					onJump();
				}}
				className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[9px] font-semibold text-zinc-950 ring-2 ${pulse ? "ring-zinc-100" : "ring-zinc-900"} ${big ? "size-4" : "size-2.5"} ${fill}`}
			>
				{items.length > 1 ? items.length : ""}
				<span className="sr-only">{items[0].title}</span>
			</a>
			{/* Hoverable (not pointer-events-none) so its links work; ::before bridges the gap. */}
			<div
				className={`${CARD} pointer-events-auto top-[calc(100%+6px)] before:absolute before:inset-x-0 before:-top-2 before:h-2 before:content-['']`}
			>
				{first && (
					<div className={`font-semibold ${c.text}`}>
						First hit on the resignation
					</div>
				)}
				{items.slice(0, 4).map((it) => (
					<div key={it.url} className="mt-1 first:mt-0">
						<Stamp
							t={it.t}
							minute={it.precision === "minute"}
							dayOnly={it.precision === "day"}
						/>
						<div className="text-zinc-300">
							<span className="font-semibold text-zinc-100">{it.row}</span> ·{" "}
							{it.title}{" "}
							<a
								href={it.url}
								target="_blank"
								rel="noreferrer"
								className="text-sky-400 underline hover:text-sky-300"
							>
								Open
							</a>
						</div>
					</div>
				))}
				{items.length > 4 && (
					<div className="mt-1 text-zinc-500">+{items.length - 4} more</div>
				)}
				{outcome}
			</div>
		</div>
	);
}

import type { RippleEvent, RippleStory, Stance } from "#/server/ripple";

export const STANCE_COLOR: Record<Stance, string> = {
	supportive: "#34d399",
	critical: "#fb7185",
	speculative: "#fbbf24",
	neutral: "#38bdf8",
};

const TZ = "America/New_York";
const fmt = (o: Intl.DateTimeFormatOptions) =>
	new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...o });
export const etClock = fmt({
	weekday: "short",
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
});
export const etTime = fmt({ hour: "numeric", minute: "2-digit" });
export const etShort = fmt({
	weekday: "short",
	hour: "numeric",
	minute: "2-digit",
});
export const etDayLong = fmt({
	weekday: "long",
	month: "short",
	day: "numeric",
});
export const etWeekday = fmt({ weekday: "short" });
export const etMonthDay = fmt({ month: "short", day: "numeric" });

export function fmtPct(p: number) {
	return `${p >= 0 ? "+" : "−"}${Math.abs(p).toFixed(2)}%`;
}

export type Bar = { t: number; c: number }; // t = unix ms

export type Model = {
	story: RippleStory;
	/** Minute closes, led by a synthetic print at the window start holding the baseline close. */
	bars: Bar[];
	/** 1 where the bar belongs to a regular session. */
	regular: Uint8Array;
	lo: number;
	hi: number;
	low: Bar;
	platforms: string[];
	lane: number[]; // lane index per post
	eventsByDay: RippleEvent[][];
	/** Regular closes inside the window with the change on the day. */
	closes: { t: number; price: number; pct: number; label: string }[];
	/** Clock time -> 0..1 along the stretched axis, and back. */
	toP(t: number): number;
	toT(p: number): number;
	barAt(t: number): number;
	dayAt(t: number): number;
	shownAt(t: number): number;
	marketState(t: number): string;
};

const BUCKET = 30 * 60_000;
const GAP = 20 * 60_000;
export const isGap = (a: Bar, b: Bar) => b.t - a.t > GAP;

// The axis is not linear: every half hour gets a small base width plus extra for each post
// published in it and for any NVDA move beyond 0.8% of the baseline. Quiet nights shrink,
// the hours where the story and the price actually moved get the room.
function buildWarp(story: RippleStory, bars: Bar[]) {
	const { start, end, baseline } = story;
	const n = Math.ceil((end - start) / BUCKET);
	const at = (t: number) =>
		Math.min(n - 1, Math.max(0, Math.floor((t - start) / BUCKET)));
	const posts = new Array<number>(n).fill(0);
	const lo = new Array<number>(n).fill(Number.POSITIVE_INFINITY);
	const hi = new Array<number>(n).fill(0);
	for (const p of story.posts) posts[at(p.t)]++;
	for (const b of bars) {
		const i = at(b.t);
		lo[i] = Math.min(lo[i], b.c);
		hi[i] = Math.max(hi[i], b.c);
	}
	let w = posts.map((c, i) => {
		const range = hi[i] > 0 ? ((hi[i] - lo[i]) / baseline) * 100 : 0;
		return 0.2 + Math.min(c, 5) + 0.4 * Math.min(Math.max(0, range - 0.8), 4);
	});
	for (let pass = 0; pass < 2; pass++)
		w = w.map(
			(v, i) => (w[Math.max(0, i - 1)] + 2 * v + w[Math.min(n - 1, i + 1)]) / 4,
		);
	const cum = new Float64Array(n + 1);
	for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + w[i];
	const total = cum[n];
	return {
		toP(t: number) {
			const f = Math.min(n, Math.max(0, (t - start) / BUCKET));
			const i = Math.min(n - 1, Math.floor(f));
			return (cum[i] + (f - i) * w[i]) / total;
		},
		toT(p: number) {
			const target = Math.min(1, Math.max(0, p)) * total;
			let a = 0;
			let b = n - 1;
			while (a < b) {
				const mid = (a + b) >> 1;
				if (cum[mid + 1] < target) a = mid + 1;
				else b = mid;
			}
			return Math.min(end, start + (a + (target - cum[a]) / w[a]) * BUCKET);
		},
	};
}

export function buildModel(story: RippleStory): Model {
	const flat = JSON.parse(story.bars) as number[];
	const bars: Bar[] = [{ t: story.start, c: story.baseline }];
	for (let i = 0; i < flat.length; i += 2)
		bars.push({ t: flat[i] * 1000, c: flat[i + 1] });
	const sessions = story.days.flatMap((d) => (d.session ? [d.session] : []));
	const regular = Uint8Array.from(bars, (b) =>
		sessions.some(([a, z]) => b.t >= a && b.t < z) ? 1 : 0,
	);
	let low = bars[0];
	let hi = story.baseline;
	for (const b of bars) {
		if (b.c < low.c) low = b;
		if (b.c > hi) hi = b.c;
	}

	const counts = new Map<string, number>();
	for (const p of story.posts)
		counts.set(p.platform, (counts.get(p.platform) ?? 0) + 1);
	const platforms = [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([name]) => name);

	const barAt = (t: number) => {
		let a = 0;
		let b = bars.length - 1;
		while (a < b) {
			const mid = (a + b + 1) >> 1;
			if (bars[mid].t <= t) a = mid;
			else b = mid - 1;
		}
		return a;
	};
	const dayAt = (t: number) => {
		let i = 0;
		while (i + 1 < story.days.length && story.days[i + 1].start <= t) i++;
		return i;
	};

	return {
		story,
		bars,
		regular,
		lo: low.c,
		hi,
		low,
		platforms,
		lane: story.posts.map((p) => platforms.indexOf(p.platform)),
		eventsByDay: story.days.map((d) =>
			story.events.filter((e) => e.date === d.date),
		),
		closes: story.days.flatMap((d) =>
			d.session && d.close != null && d.prevClose != null
				? [
						{
							t: d.session[1],
							price: d.close,
							pct: (d.close / d.prevClose - 1) * 100,
							label: etWeekday.format(d.start),
						},
					]
				: [],
		),
		...buildWarp(story, bars),
		barAt,
		dayAt,
		shownAt(t) {
			let n = 0;
			while (n < story.posts.length && story.posts[n].t <= t) n++;
			return n;
		},
		marketState(t) {
			const d = story.days[dayAt(t)];
			if (!d.session) return "Market closed";
			const h = (t - d.start) / 3600_000; // hours since midnight Eastern
			if (h < 4) return "Market closed";
			if (t < d.session[0]) return "Pre-market";
			if (t < d.session[1]) return "Market open";
			return h < 20 ? "After hours" : "Market closed";
		},
	};
}

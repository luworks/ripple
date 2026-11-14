import type { PriceSeries } from "#/server/research-types";
import type { RippleReplay, Stance } from "#/server/ripple";

export const STANCE_COLOR: Record<Stance, string> = {
	supportive: "#34d399",
	critical: "#fb7185",
	speculative: "#fbbf24",
	neutral: "#38bdf8",
};

// Last close at or before t (ms); null before the first print.
export function priceAt(s: PriceSeries, t: number): number | null {
	const pts = s.points;
	const sec = t / 1000;
	let lo = 0;
	let hi = pts.length - 1;
	let ans = -1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (pts[mid].t <= sec) {
			ans = mid;
			lo = mid + 1;
		} else hi = mid - 1;
	}
	return ans < 0 ? null : pts[ans].c;
}

// % change vs the baseline close, held flat while the market is shut.
export function changeAt(s: PriceSeries, baseline: number, t: number) {
	const base = priceAt(s, baseline);
	const now = priceAt(s, Math.max(t, baseline));
	if (base == null || now == null) return null;
	return { price: now, pct: ((now - base) / base) * 100 };
}

export function platformsOf(r: RippleReplay) {
	const counts = new Map<string, number>();
	for (const p of r.posts)
		counts.set(p.platform, (counts.get(p.platform) ?? 0) + 1);
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([name]) => name);
}

export function fmtPct(p: number) {
	return `${p >= 0 ? "+" : "−"}${Math.abs(p).toFixed(2)}%`;
}

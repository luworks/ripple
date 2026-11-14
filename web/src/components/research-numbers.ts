// One source for every % change on research pages: the run's market window, Yahoo closes.
// The agent's own numbers (change_pct, figures in prose) come from other windows and are never shown.
import type { PriceSeries, ResearchResult } from "#/server/research-types";

export function seriesChange(s: PriceSeries | undefined) {
	const p = s?.points;
	return p && p.length > 1 ? (p[p.length - 1].c / p[0].c - 1) * 100 : null;
}

export function changeOf(prices: PriceSeries[], symbol: string | null) {
	if (!symbol) return null;
	const sym = symbol.toUpperCase();
	return seriesChange(prices.find((p) => p.symbol === sym));
}

export function windowRequest(r: ResearchResult, symbols: string[]) {
	return {
		symbols,
		start: r.market.window_start,
		end: r.market.window_end,
		interval: r.market.interval,
	};
}

// The headline pair: first direct ticker (else first ticker) vs SPY (else first benchmark).
export function leadAndBench(r: ResearchResult) {
	const lead = (
		r.tickers.find((t) => t.relation === "direct") ?? r.tickers[0]
	)?.symbol.toUpperCase();
	const bench = (
		r.market.benchmarks.find((b) => b.toUpperCase() === "SPY") ??
		r.market.benchmarks[0] ??
		"SPY"
	).toUpperCase();
	return { lead: lead && lead !== bench ? lead : null, bench };
}

export function keyNumbers(r: ResearchResult, prices: PriceSeries[]) {
	const { lead, bench } = leadAndBench(r);
	const leadPct = changeOf(prices, lead);
	const benchPct = changeOf(prices, bench);
	return {
		lead,
		leadPct,
		bench,
		benchPct,
		excess: leadPct != null && benchPct != null ? leadPct - benchPct : null,
	};
}

// A clause quoting a move: "9.3%", "-0.5 %", "7.6 percentage points", "10.5 个百分点".
const MOVE = /\d\s*%|％|percentage points?|\d\s*(?:pts?|points?)\b|百分点/i;

// Drop sentences/clauses that quote a move; keep the qualitative prose around them.
export function stripMoves(text: string) {
	// Sentence breaks need a capital next, so "Oct. 10" stays whole.
	const segs = text
		.split(/(?<=[.!?])\s+(?=[A-Z"“(])|(?<=[;:])\s+|(?<=[。；：！？])/)
		.filter((p) => p.trim());
	const keep = segs.map((p) => !MOVE.test(p));
	const parts: string[] = [];
	segs.forEach((p, i) => {
		if (!keep[i]) return;
		// After a dropped clause, start a new sentence.
		const t =
			i > 0 && !keep[i - 1]
				? p.trim().replace(/^[a-z]/, (c) => c.toUpperCase())
				: p.trim();
		// A clause that introduced a dropped clause now ends the sentence.
		parts.push(
			keep[i + 1] ? t : t.replace(/[;:,]$/, ".").replace(/[；：，]$/, "。"),
		);
	});
	const cjk = /[　-鿿]/.test(text);
	return parts.join(cjk ? "" : " ").trim();
}

// Date-only items are stored as midnight UTC; show the calendar date, not a fake time.
export const isDateOnly = (time: string) => /T00:00(:00(\.0+)?)?Z$/.test(time);
const fmtDate = new Intl.DateTimeFormat("en-US", {
	timeZone: "UTC",
	month: "short",
	day: "numeric",
});
const fmtTime = new Intl.DateTimeFormat("en-US", {
	timeZone: "America/Los_Angeles",
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
});
export function formatEventTime(time: string) {
	return isDateOnly(time)
		? `${fmtDate.format(new Date(time))} · date only`
		: `${fmtTime.format(new Date(time))} PT`;
}

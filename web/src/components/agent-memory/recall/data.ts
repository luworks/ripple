import {
	getRecallChart,
	OTHER,
	type RecallChart,
	type RecallSearch,
	searchAgentMemory,
} from "#/server/agent-memory/recall";

// Promise caches read with React 19 `use()`, so the same code renders on the server
// (inside Suspense) and on the client. The snapshot is static, so caching is safe.

let chart: Promise<RecallChart> | undefined;
export function chartPromise() {
	chart ??= getRecallChart().catch((err) => {
		chart = undefined;
		throw err;
	});
	return chart;
}

const searches = new Map<string, Promise<RecallSearch>>();
export function searchPromise(q: string): Promise<RecallSearch> {
	const hit = searches.get(q);
	if (hit) return hit;
	if (searches.size >= 50) searches.clear();
	const p = searchAgentMemory({ data: { q } }).catch((err: unknown) => {
		searches.delete(q);
		throw err;
	});
	searches.set(q, p);
	return p;
}

// Dark-mode categorical order (validated: dataviz validate_palette.js --mode dark, all pass).
const PALETTE = ["#3987e5", "#d95926", "#199e70", "#c98500", "#8a6fd1"];
export const OTHER_COLOR = "#52525b";

export function colorFor(series: RecallChart["series"], key: string) {
	if (key === OTHER) return OTHER_COLOR;
	const i = series.findIndex((s) => s.key === key);
	return PALETTE[i] ?? OTHER_COLOR;
}

const dayFmt = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});
const longFmt = new Intl.DateTimeFormat("en-US", {
	weekday: "short",
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});
const asDate = (day: string) => new Date(`${day}T12:00:00Z`);
export const shortDay = (day: string) => dayFmt.format(asDate(day));
export const longDay = (day: string) => longFmt.format(asDate(day));

export const fmt = new Intl.NumberFormat("en-US");
export function abbrev(n: number) {
	if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
	return String(Math.round(n));
}
export const pct = (n: number, of: number) =>
	of ? `${((n / of) * 100).toFixed(1)}%` : "0%";

export { OTHER };

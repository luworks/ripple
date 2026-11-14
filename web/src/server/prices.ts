// Yahoo Finance chart API. The chart only ever uses these prices, never numbers from agent text.
import type { PriceSeries } from "./research-types";

const INTERVALS = ["1m", "5m", "15m", "1h", "1d"] as const;
export type Interval = (typeof INTERVALS)[number];
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: PriceSeries }>();

// Yahoo rate-limits full browser UA strings from our host; the bare token works.
const UA = "Mozilla/5.0";

async function fetchChart(
	symbol: string,
	p1: number,
	p2: number,
	interval: Interval,
): Promise<PriceSeries | null> {
	const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&period1=${p1}&period2=${p2}&includePrePost=false`;
	const res = await fetch(url, {
		headers: { "User-Agent": UA },
		signal: AbortSignal.timeout(8000),
	});
	if (!res.ok) return null;
	const json = (await res.json()) as {
		chart?: {
			result?: {
				meta?: { currency?: string };
				timestamp?: number[];
				indicators?: { quote?: { close?: (number | null)[] }[] };
			}[];
		};
	};
	const r = json.chart?.result?.[0];
	const ts = r?.timestamp ?? [];
	const closes = r?.indicators?.quote?.[0]?.close ?? [];
	const points: PriceSeries["points"] = [];
	for (let i = 0; i < ts.length; i++) {
		const c = closes[i];
		if (typeof c === "number" && Number.isFinite(c))
			points.push({ t: ts[i], c });
	}
	if (!points.length) return null;
	return { symbol, currency: r?.meta?.currency ?? null, points };
}

async function fetchWithFallback(
	symbol: string,
	p1: number,
	p2: number,
	interval: Interval,
): Promise<PriceSeries> {
	const key = `${symbol}|${p1}|${p2}|${interval}`;
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
	let value: PriceSeries = { symbol, currency: null, points: [] };
	for (const iv of INTERVALS.slice(INTERVALS.indexOf(interval))) {
		try {
			const s = await fetchChart(symbol, p1, p2, iv);
			if (s) {
				value = s;
				break;
			}
		} catch {
			// try the next coarser interval
		}
	}
	cache.set(key, { at: Date.now(), value });
	return value;
}

export async function getPriceSeries(
	symbols: string[],
	start: string,
	end: string,
	interval: string,
): Promise<PriceSeries[]> {
	const iv = (INTERVALS as readonly string[]).includes(interval)
		? (interval as Interval)
		: "5m";
	const p1 = Math.floor(Date.parse(start) / 1000);
	let p2 = Math.floor(Date.parse(end) / 1000);
	if (!Number.isFinite(p1) || !Number.isFinite(p2) || p2 <= p1)
		throw new Error("Invalid price window");
	p2 = Math.min(p2, Math.floor(Date.now() / 1000));
	const uniq = [
		...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
	].slice(0, 12);
	return Promise.all(uniq.map((s) => fetchWithFallback(s, p1, p2, iv)));
}

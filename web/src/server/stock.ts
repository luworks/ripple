import { createServerFn } from "@tanstack/react-start";

// Bars written by scripts/fetch_stock.py: <MARKET_DATA_DIR>/<SYMBOL>/<interval>.parquet.
export const INTERVALS = [
	"1m",
	"2m",
	"5m",
	"15m",
	"30m",
	"1h",
	"1d",
	"1wk",
	"1mo",
] as const;
export type Interval = (typeof INTERVALS)[number];

// time = UTC seconds (Lightweight Charts' UTCTimestamp); v = volume, -1 when Yahoo's value is bad.
export type Bar = {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	v: number;
};

// Columnar, delta-encoded integers so 18k one-minute bars ship as ~0.4 MB instead of 3.6 MB:
// t = seconds since previous bar, c = close change in 1/10000 dollars,
// o/h/l = offset from the same bar's close, v = raw volume (-1 = bad).
export type Packed = {
	t: number[];
	c: number[];
	o: number[];
	h: number[];
	l: number[];
	v: number[];
};

export function unpack(p: Packed): Bar[] {
	const bars: Bar[] = new Array(p.t.length);
	let t = 0;
	let c = 0;
	for (let i = 0; i < p.t.length; i++) {
		t += p.t[i];
		c += p.c[i];
		bars[i] = {
			time: t,
			open: (c + p.o[i]) / 1e4,
			high: (c + p.h[i]) / 1e4,
			low: (c + p.l[i]) / 1e4,
			close: c / 1e4,
			v: p.v[i],
		};
	}
	return bars;
}

type Row = {
	ts: Date;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: bigint;
	volume_suspect?: boolean;
};

function pack(rows: Row[]): Packed {
	const p: Packed = { t: [], c: [], o: [], h: [], l: [], v: [] };
	let t = 0;
	let c = 0;
	for (const r of rows) {
		const time = Math.floor(r.ts.getTime() / 1000);
		const close = Math.round(r.close * 1e4);
		p.t.push(time - t);
		p.c.push(close - c);
		p.o.push(Math.round(r.open * 1e4) - close);
		p.h.push(Math.round(r.high * 1e4) - close);
		p.l.push(Math.round(r.low * 1e4) - close);
		p.v.push(r.volume_suspect ? -1 : Number(r.volume));
		t = time;
		c = close;
	}
	return p;
}

// Parsed files, reused until the parquet file's mtime changes (the fetcher rewrites it).
const cache = new Map<string, { mtimeMs: number; packed: Packed }>();

async function load(symbol: string, interval: Interval): Promise<Packed> {
	const { resolve } = await import("node:path");
	const { stat } = await import("node:fs/promises");
	const dir = process.env.MARKET_DATA_DIR ?? resolve("../data/market");
	const path = resolve(dir, symbol, `${interval}.parquet`);
	const { mtimeMs } = await stat(path);
	const hit = cache.get(path);
	if (hit?.mtimeMs === mtimeMs) return hit.packed;

	const { asyncBufferFromFile, parquetReadObjects } = await import("hyparquet");
	const packed = pack(
		(await parquetReadObjects({
			file: await asyncBufferFromFile(path),
		})) as Row[],
	);
	cache.set(path, { mtimeMs, packed });
	return packed;
}

// 1s bars kept as typed arrays (~30 MB for a million rows instead of ~460 MB of row objects).
type Seconds = {
	mtimeMs: number;
	ts: Int32Array; // UTC seconds
	c: Int32Array; // prices in 1/10000 dollars
	o: Int32Array;
	h: Int32Array;
	l: Int32Array;
	v: Float64Array;
};
const secondsCache = new Map<string, Seconds>();

async function readSeconds(symbol: string): Promise<Seconds | null> {
	const { resolve } = await import("node:path");
	const { stat } = await import("node:fs/promises");
	const dir = process.env.MARKET_DATA_DIR ?? resolve("../data/market");
	const path = resolve(dir, symbol, "1s.parquet");
	// 1s bars exist only where the Alpaca export was copied in; elsewhere the page hides 1s.
	const st = await stat(path).catch(() => null);
	if (!st) return null;
	const hit = secondsCache.get(path);
	if (hit?.mtimeMs === st.mtimeMs) return hit;

	const { asyncBufferFromFile, parquetReadObjects } = await import("hyparquet");
	const rows = (await parquetReadObjects({
		file: await asyncBufferFromFile(path),
	})) as Row[];
	const n = rows.length;
	const s: Seconds = {
		mtimeMs: st.mtimeMs,
		ts: new Int32Array(n),
		c: new Int32Array(n),
		o: new Int32Array(n),
		h: new Int32Array(n),
		l: new Int32Array(n),
		v: new Float64Array(n),
	};
	for (let i = 0; i < n; i++) {
		const r = rows[i];
		s.ts[i] = Math.floor(r.ts.getTime() / 1000);
		s.c[i] = Math.round(r.close * 1e4);
		s.o[i] = Math.round(r.open * 1e4);
		s.h[i] = Math.round(r.high * 1e4);
		s.l[i] = Math.round(r.low * 1e4);
		s.v[i] = r.volume_suspect ? -1 : Number(r.volume);
	}
	secondsCache.set(path, s);
	return s;
}

// First index whose time is >= t; ts is sorted.
function lowerBound(ts: Int32Array, t: number): number {
	let lo = 0;
	let hi = ts.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (ts[mid] < t) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

// A 1s request covers at most this many seconds: 2 hours is 7,200 bars, ~180 KB of JSON.
export const MAX_SECOND_SPAN = 2 * 3600;

// 1s bars in [from, to) plus the file's full time range, so the page knows where 1s exists.
export type SecondSlice = {
	packed: Packed;
	start: number | null;
	end: number | null;
};

async function loadSeconds(
	symbol: string,
	from: number,
	to: number,
): Promise<SecondSlice> {
	const s = await readSeconds(symbol);
	const p: Packed = { t: [], c: [], o: [], h: [], l: [], v: [] };
	if (!s?.ts.length) return { packed: p, start: null, end: null };
	let t = 0;
	let c = 0;
	for (let i = lowerBound(s.ts, from), j = lowerBound(s.ts, to); i < j; i++) {
		p.t.push(s.ts[i] - t);
		p.c.push(s.c[i] - c);
		p.o.push(s.o[i] - s.c[i]);
		p.h.push(s.h[i] - s.c[i]);
		p.l.push(s.l[i] - s.c[i]);
		p.v.push(s.v[i]);
		t = s.ts[i];
		c = s.c[i];
	}
	return { packed: p, start: s.ts[0], end: s.ts[s.ts.length - 1] };
}

export const getBars = createServerFn({ method: "GET" })
	.validator((d: { symbol: string; interval: Interval }) => {
		if (!/^[A-Z.]{1,10}$/.test(d.symbol)) throw new Error("bad symbol");
		if (!INTERVALS.includes(d.interval)) throw new Error("bad interval");
		return d;
	})
	// A JSON string, not the object: the server-function wire format wraps every number in its
	// own object, which made the payload 3x larger.
	.handler(async ({ data }) =>
		JSON.stringify(await load(data.symbol, data.interval)),
	);

export const getSecondBars = createServerFn({ method: "GET" })
	.validator((d: { symbol: string; from: number; to: number }) => {
		if (!/^[A-Z.]{1,10}$/.test(d.symbol)) throw new Error("bad symbol");
		if (!Number.isFinite(d.from) || !Number.isFinite(d.to) || d.to <= d.from)
			throw new Error("bad range");
		if (d.to - d.from > MAX_SECOND_SPAN) throw new Error("range too long");
		return d;
	})
	.handler(async ({ data }) =>
		JSON.stringify(await loadSeconds(data.symbol, data.from, data.to)),
	);

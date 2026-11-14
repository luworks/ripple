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
	const rows = (await parquetReadObjects({
		file: await asyncBufferFromFile(path),
	})) as Row[];
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
	cache.set(path, { mtimeMs, packed: p });
	return p;
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

// Telem posts about the event, slimmed for the chart's post strip: t = UTC seconds.
export type Post = { t: number; platform: string; title: string; url: string };

export const getPosts = createServerFn({ method: "GET" }).handler(
	async (): Promise<Post[]> => {
		const { default: data } = await import("#/data/jensen-huang-posts.json");
		return data.posts
			.filter((p) => p.relevant && p.date)
			.map((p) => ({
				t: Math.floor(Date.parse(p.date as string) / 1000),
				platform: p.platform,
				title: p.title_en || p.title || "Untitled post",
				url: p.url,
			}))
			.sort((a, b) => a.t - b.t);
	},
);

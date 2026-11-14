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
export type BarsResult = { symbol: string; interval: Interval; bars: Bar[] };

type Row = {
	ts: Date;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: bigint;
	volume_suspect?: boolean;
};

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

export const getBars = createServerFn({ method: "GET" })
	.validator((d: { symbol: string; interval: Interval }) => {
		if (!/^[A-Z.]{1,10}$/.test(d.symbol)) throw new Error("bad symbol");
		if (!INTERVALS.includes(d.interval)) throw new Error("bad interval");
		return d;
	})
	.handler(async ({ data }): Promise<BarsResult> => {
		const { resolve } = await import("node:path");
		const { asyncBufferFromFile, parquetReadObjects } = await import(
			"hyparquet"
		);
		const dir = process.env.MARKET_DATA_DIR ?? resolve("../data/market");
		const file = await asyncBufferFromFile(
			resolve(dir, data.symbol, `${data.interval}.parquet`),
		);
		const rows = (await parquetReadObjects({ file })) as Row[];
		const bars = rows.map((r) => ({
			time: Math.floor(r.ts.getTime() / 1000),
			open: r4(r.open),
			high: r4(r.high),
			low: r4(r.low),
			close: r4(r.close),
			v: r.volume_suspect ? -1 : Number(r.volume),
		}));
		return { symbol: data.symbol, interval: data.interval, bars };
	});

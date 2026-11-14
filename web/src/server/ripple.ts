import { createServerFn } from "@tanstack/react-start";
import type { PriceSeries } from "./research-types";

// Replay data for the home-page ripple: real timestamped posts plus real 5-minute prices,
// both on one clock. Baseline = Nov 11 close, the last print before the resignation news.
const START = "2026-11-11T21:00:00Z";
const END = "2026-11-14T20:00:00Z";
export const RIPPLE_TICKERS = ["NVDA", "TSM", "AMD", "AVGO", "MRVL", "SMH"];
export const RIPPLE_PEOPLE = ["Jensen Huang", "Colette Kress", "Harvey Jones"];

export type Stance = "supportive" | "critical" | "speculative" | "neutral";
export type RipplePost = {
	t: number; // unix ms
	platform: string;
	stance: Stance;
	title: string;
	url: string;
};
export type RippleBeat = { date: string; title: string }; // date = US/Eastern YYYY-MM-DD
export type RippleReplay = {
	start: number;
	end: number;
	baseline: number;
	posts: RipplePost[];
	totalPosts: number;
	beats: RippleBeat[];
	prices: PriceSeries[];
};

export const getRippleReplay = createServerFn({ method: "GET" }).handler(
	async (): Promise<RippleReplay> => {
		const [{ default: data }, { timeline }, { getPriceSeries }] =
			await Promise.all([
				import("#/data/jensen-huang-posts.json"),
				import("#/data/jensen-huang-timeline"),
				import("./prices"),
			]);
		const start = Date.parse(START);
		const end = Date.parse(END);
		const relevant = data.posts.filter((p) => p.relevant);
		const posts = relevant
			.map((p) => ({
				t: p.date ? Date.parse(p.date) : Number.NaN,
				platform: p.platform,
				stance: p.stance as Stance,
				title: p.title_en || p.title,
				url: p.url,
			}))
			.filter((p) => p.t >= start && p.t <= end)
			.sort((a, b) => a.t - b.t);
		const beats = timeline
			.filter((e) => e.date >= "2026-11-11" && e.date <= "2026-11-14")
			.map((e) => ({ date: e.date, title: e.title }));
		// Pull from the morning of Nov 11 so the baseline close is inside the series.
		const prices = await getPriceSeries(
			RIPPLE_TICKERS,
			"2026-11-11T14:00:00Z",
			END,
			"5m",
		);
		return {
			start,
			end,
			baseline: start,
			posts,
			totalPosts: relevant.length,
			beats,
			prices,
		};
	},
);

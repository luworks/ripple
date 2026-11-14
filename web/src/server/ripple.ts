import { createServerFn } from "@tanstack/react-start";
import type { Source } from "#/data/jensen-huang-timeline";
import type { Stance, TelemCredit } from "#/data/jensen-huang-view";

// Story data for the home-page replay: one week of NVDA minute bars, the dated events of the
// Jensen Huang case study and every timestamped social post, all on one clock.
const START = "2026-11-08T05:00:00Z"; // Sun Nov 8, 00:00 US Eastern
const END = "2026-11-14T20:00:00Z";
const DATES = [8, 9, 10, 11, 12, 13, 14].map(
	(d) => `2026-11-${d < 10 ? "0" : ""}${d}`,
);
// November is EST (UTC−5): midnight = 05:00Z, regular session = 14:30Z to 21:00Z.
const dayStart = (date: string) => Date.parse(`${date}T05:00:00Z`);
const BASELINE_DATE = "2026-11-06"; // last regular close before the window
// One-minute bars are kept whole here; elsewhere one close per five minutes is enough.
const HOT = [
	Date.parse("2026-11-11T21:00:00Z"),
	Date.parse("2026-11-12T21:00:00Z"),
];

export type { Stance };
export type RipplePost = {
	t: number; // unix ms
	platform: string;
	stance: Stance;
	title: string;
	url: string;
	image: string | null;
	credits: TelemCredit[];
};
export type RippleEvent = {
	id: string; // anchor on /events/jensen-huang
	date: string; // US Eastern YYYY-MM-DD; the sources give no time of day
	title: string;
	detail: string;
	image: { src: string; from: string } | null;
	sources: Source[];
	credits: TelemCredit[];
};
export type RippleDay = {
	date: string;
	start: number; // midnight US Eastern, unix ms
	session: [number, number] | null; // regular session, unix ms
	close: number | null; // regular-session close
	prevClose: number | null; // previous regular-session close
};
export type RippleStory = {
	start: number;
	end: number;
	baseline: number; // Nov 6 regular close
	bars: string; // JSON [t, close, t, close, …], t in unix seconds
	days: RippleDay[];
	events: RippleEvent[];
	posts: RipplePost[];
	totalPosts: number;
};

let memo: { at: number; value: RippleStory } | null = null;

export const getRippleStory = createServerFn({ method: "GET" }).handler(
	async (): Promise<RippleStory> => {
		if (memo && Date.now() - memo.at < 10 * 60_000) return memo.value;
		const [view, stock] = await Promise.all([
			import("#/data/jensen-huang-view"),
			import("./stock"),
		]);
		const start = Date.parse(START);
		const end = Date.parse(END);

		const all = stock.unpack(
			JSON.parse(
				await stock.getBars({ data: { symbol: "NVDA", interval: "1m" } }),
			),
		);
		// Last print of a day's regular session.
		const closeOf = (date: string) => {
			const open = Date.parse(`${date}T14:30:00Z`) / 1000;
			const shut = Date.parse(`${date}T21:00:00Z`) / 1000;
			let c: number | null = null;
			for (const b of all) {
				if (b.time >= shut) break;
				if (b.time >= open) c = b.close;
			}
			return c;
		};
		const baseline = closeOf(BASELINE_DATE);
		if (baseline == null)
			throw new Error("No NVDA bars for the baseline close");

		const flat: number[] = [];
		for (let i = 0; i < all.length; i++) {
			const ms = all[i].time * 1000;
			if (ms < start || ms > end) continue;
			const next = all[i + 1]?.time;
			const hot = ms >= HOT[0] && ms <= HOT[1];
			const lastOfFive =
				next === undefined ||
				Math.floor(next / 300) !== Math.floor(all[i].time / 300);
			if (hot || lastOfFive)
				flat.push(all[i].time, Math.round(all[i].close * 100) / 100);
		}

		let prev: number | null = baseline;
		const days = DATES.map((date): RippleDay => {
			const close = closeOf(date);
			const day: RippleDay = {
				date,
				start: dayStart(date),
				session:
					close == null
						? null
						: [
								Date.parse(`${date}T14:30:00Z`),
								Date.parse(`${date}T21:00:00Z`),
							],
				close,
				prevClose: prev,
			};
			if (close != null) prev = close;
			return day;
		});

		const events = view.events
			.filter((e) => DATES.includes(e.date))
			.sort(
				(a, b) =>
					a.date.localeCompare(b.date) ||
					Number(a.id.slice(6)) - Number(b.id.slice(6)),
			)
			.map((e) => ({
				id: e.id,
				date: e.date,
				title: e.title,
				detail: e.detail,
				image: e.image,
				sources: e.sources,
				credits: e.credits,
			}));

		const posts = view.socialPosts
			.map((p) => ({
				t: p.date ? Date.parse(p.date) : Number.NaN,
				platform: p.platform,
				stance: p.stance,
				title: p.title_en || p.title || "Untitled post",
				url: p.url,
				image: p.image,
				credits: p.credits,
			}))
			.filter((p) => p.t >= start && p.t <= end)
			.sort((a, b) => a.t - b.t);

		const value: RippleStory = {
			start,
			end,
			baseline,
			bars: JSON.stringify(flat),
			days,
			events,
			posts,
			totalPosts: view.socialPosts.length,
		};
		memo = { at: Date.now(), value };
		return value;
	},
);

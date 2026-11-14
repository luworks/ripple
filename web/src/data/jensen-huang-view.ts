// View model shared by the Jensen Huang event page designs: timeline (newest first),
// social posts and per-item Telem attribution (which Telem feature and provider found it).
import media from "#/data/jensen-huang-media.json";
import data from "#/data/jensen-huang-posts.json";
import { type TimelineEvent, timeline } from "#/data/jensen-huang-timeline";

export type Category = "china" | "global" | "places" | "commerce" | "ads";
export type Stance = "supportive" | "critical" | "neutral" | "speculative";

export type Post = {
	id: string;
	platform: string;
	category: Category;
	providers: string[];
	query: string;
	url: string;
	title: string;
	text: string;
	date: string | null;
	title_en: string;
	summary_en: string;
	language: "zh" | "en" | "other";
	stance: Stance;
	relevant: boolean;
};

export type Run = {
	platform: string;
	category: string;
	provider: string;
	query: string;
	status: string;
	results: number;
	seconds: number;
};

/** One line of "how Telem got this": feature (Search / Fetch), provider(s) and the query if any. */
export type TelemCredit = {
	feature: "Search" | "Fetch";
	providers: string[];
	query?: string;
	what: string;
};

type MediaEntry = { image: string | null; provider: string | null };
const sourceMedia = media.sources as Record<string, MediaEntry>;
const postMedia = media.posts as Record<string, MediaEntry>;
const foundBy = media.foundBy as Record<string, string[]>;

export type EventView = TimelineEvent & {
	id: string;
	/** Short date tag shown next to major ticks on the scroll rail, e.g. "Nov 12". */
	tag: string;
	major: boolean;
	image: { src: string; from: string } | null;
	credits: TelemCredit[];
	posts: PostView[];
};

export type PostView = Post & {
	image: string | null;
	credits: TelemCredit[];
};

export const posts = data.posts as Post[];
export const runs = data.runs as Run[];

function postCredits(p: Post, imageProvider: string | null): TelemCredit[] {
	const c: TelemCredit[] = [
		{
			feature: "Search",
			providers: p.providers,
			query: p.query,
			what: `${p.platform} search`,
		},
	];
	if (imageProvider)
		c.push({
			feature: "Fetch",
			providers: [imageProvider],
			what: "post image",
		});
	return c;
}

export const postViews: PostView[] = posts.map((p) => {
	const m = postMedia[p.id];
	return {
		...p,
		image: m?.image ?? null,
		credits: postCredits(p, m?.image ? m.provider : null),
	};
});

export const socialPosts = postViews.filter(
	(p) => (p.category === "china" || p.category === "global") && p.relevant,
);
export const beyondPosts = postViews.filter(
	(p) => p.category !== "china" && p.category !== "global",
);

const MAJOR = new Set([
	"2026-10-29",
	"2026-11-08",
	"2026-11-11",
	"2026-11-12",
	"2026-11-14",
]);

function eventCredits(e: TimelineEvent, imageFrom: string | null) {
	const search = new Set<string>();
	for (const s of e.sources)
		for (const p of foundBy[s.url] ?? []) search.add(p);
	const c: TelemCredit[] = [
		{
			feature: "Search",
			providers: [...search],
			query: "Jensen Huang resignation news",
			what: `${e.sources.length} news source${e.sources.length > 1 ? "s" : ""}`,
		},
	];
	if (imageFrom) {
		const prov = Object.entries(sourceMedia).find(
			([, m]) => m.image === imageFrom,
		)?.[1].provider;
		if (prov)
			c.push({ feature: "Fetch", providers: [prov], what: "lead image" });
	}
	return c;
}

/** Newest first: the latest big development is what readers should see first. */
export const events: EventView[] = [...timeline]
	.map((e, i) => {
		const withImage = e.sources.find((s) => sourceMedia[s.url]?.image);
		const src = withImage ? sourceMedia[withImage.url].image : null;
		const day = e.date;
		return {
			...e,
			id: `event-${i}`,
			tag: new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				timeZone: "UTC",
			}),
			major: MAJOR.has(day) && e.phase !== "background",
			image: src && withImage ? { src, from: withImage.label } : null,
			credits: eventCredits(e, src),
			posts: socialPosts.filter((p) => p.date?.slice(0, 10) === day),
		};
	})
	.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

export const platformCount = new Set(posts.map((p) => p.platform)).size;

export const STANCE: Record<
	Stance,
	{ label: string; dot: string; badge: string }
> = {
	supportive: {
		label: "Supportive",
		dot: "bg-emerald-400",
		badge: "border-emerald-500/40 text-emerald-300",
	},
	critical: {
		label: "Critical",
		dot: "bg-rose-400",
		badge: "border-rose-500/40 text-rose-300",
	},
	speculative: {
		label: "Speculative",
		dot: "bg-amber-400",
		badge: "border-amber-500/40 text-amber-300",
	},
	neutral: {
		label: "Neutral / news",
		dot: "bg-sky-400",
		badge: "border-sky-500/40 text-sky-300",
	},
};
export const STANCES = Object.keys(STANCE) as Stance[];

export const PHASE: Record<TimelineEvent["phase"], string> = {
	background: "Background",
	scandal: "Scandal breaks",
	resignation: "Resignation",
	aftermath: "Aftermath",
	upcoming: "What's next",
};

export const telemTotals = {
	searchRuns: runs.length,
	fetchedPages: Object.keys(sourceMedia).length + Object.keys(postMedia).length,
	images:
		Object.values(sourceMedia).filter((m) => m.image).length +
		Object.values(postMedia).filter((m) => m.image).length,
};

import { createFileRoute } from "@tanstack/react-router";
import { BRAND } from "#/brand";
import { GalleryPitch, type Pitch } from "#/components/GalleryPitch";

export const Route = createFileRoute("/tavily/")({
	head: () => ({
		meta: [
			{ title: `Tavily in one scroll · ${BRAND}` },
			{
				name: "description",
				content:
					"Tavily is one API that searches, reads and crawls the live web for AI agents. Which verb to use when, and what a credit buys.",
			},
		],
	}),
	component: () => <GalleryPitch pitch={pitch} />,
});

// Numbers from tavily.com and docs.tavily.com/documentation/api-credits,
// read Nov 14, 2026. Palette follows Tavily's own cream and sage green.
const pitch: Pitch = {
	kicker: "Tavily · the web access layer for agents",
	title: (
		<>
			The live web, <em>ready</em> for your agent.
		</>
	),
	lede: "One API, five verbs. Tavily searches, reads and crawls the web, then hands back clean, ranked text your model can use directly instead of raw HTML.",
	facts: [
		{ value: "180 ms", label: "search p50", note: "as published by Tavily" },
		{ value: "1,000", label: "free credits", note: "every month, no card" },
		{ value: "3M+", label: "developers", note: "already building on it" },
	],
	cta: { label: "Start for free", href: "https://app.tavily.com/" },
	setup: {
		label: "Copy MCP setup",
		command:
			"claude mcp add tavily --transport http https://mcp.tavily.com/mcp/",
	},
	painting: {
		src: "/art/tavily/hero.webp",
		alt: "Impressionist painting of a writing desk beside an open window that looks onto a sunlit meadow and river.",
		title: "The Open Window",
		caption: "A desk, and the whole view. AI-painted for this page, 2026.",
	},
	verbsTitle: "Five verbs, by what you already know",
	verbs: [
		{
			name: "Search",
			src: "/art/tavily/search.webp",
			alt: "A woman in a straw hat shading her eyes and looking across a meadow.",
			line: "Ranked results with the passages that answer the question.",
			when: "you don't know the URL.",
			cost: "1 credit per search",
		},
		{
			name: "Extract",
			src: "/art/tavily/extract.webp",
			alt: "A gardener picking pears into a wicker basket.",
			line: "URLs in, clean markdown out. Failed URLs are free.",
			when: "you already have the URL.",
			cost: "1 credit per 5 URLs",
		},
		{
			name: "Map",
			src: "/art/tavily/map.webp",
			alt: "A surveyor on a hilltop sketching the village and roads below.",
			line: "Lists every page a site has, without reading them.",
			when: "you need a site's structure.",
			cost: "1 credit per 10 pages",
		},
		{
			name: "Crawl",
			src: "/art/tavily/crawl.webp",
			alt: "A footpath winding past every doorway of a hillside village.",
			line: "Walks a site link by link and reads each page.",
			when: "the answer is spread across one site.",
			cost: "3 credits per 10 pages",
		},
		{
			name: "Research",
			src: "/art/tavily/research.webp",
			alt: "A scholar writing at a desk surrounded by open books.",
			line: "An agent searches, reads and writes a cited report.",
			when: "you want an answer, not links.",
			cost: "4 – 110 credits (mini)",
		},
	],
	price: {
		title: "One credit is one search.",
		body: "Everything is billed in credits. The free plan refills 1,000 every month with no card, so you can build first and pay later.",
		rows: [
			{ label: "Free", value: "1,000 credits / mo · $0" },
			{ label: "Pay as you go", value: "$0.008 / credit" },
			{ label: "Project", value: "4,000 credits · $30 / mo" },
			{
				label: "Growth",
				value: "100,000 credits · $500 / mo",
				note: "$0.005 per credit. Two more plans sit in between.",
			},
		],
		foot: "1,000 searches cost $0 on the free plan, $8 pay-as-you-go, or $5 on Growth. Advanced search is 2 credits. Students use it free.",
	},
	credit: `An independent guide by ${BRAND}, built on Tavily for this hackathon. Not affiliated with Tavily.`,
	sources: [
		{ label: "tavily.com", href: "https://www.tavily.com/" },
		{
			label: "docs.tavily.com/api-credits",
			href: "https://docs.tavily.com/documentation/api-credits",
		},
	],
	guide: "/tavily/guide",
	next: { label: "Next room: Telem", to: "/telem" },
	theme: {
		paper: "#fbf8f1",
		wall: "#f3eee2",
		ink: "#2a2926",
		muted: "#6e6b62",
		rule: "#ded7c7",
		accent: "#2f7f6c",
	},
};

import { createFileRoute } from "@tanstack/react-router";
import { BRAND } from "#/brand";
import { GalleryPitch, type Pitch } from "#/components/GalleryPitch";
import { platformGroups } from "#/data/telem-platforms";

export const Route = createFileRoute("/telem/")({
	head: () => ({
		meta: [
			{ title: `Telem in one scroll · ${BRAND}` },
			{
				name: "description",
				content:
					"Telem is one API key in front of 11 search engines, 8 page readers and 37 platforms, billed at provider price. What it does and what it costs.",
			},
		],
	}),
	component: () => <GalleryPitch pitch={pitch} />,
});

// Numbers from telem.ai and docs.telem.ai/pricing, read Nov 14, 2026.
// Verb colors follow Telem's own four-color wordmark, darkened for text.
const pitch: Pitch = {
	kicker: "Telem · web infrastructure for AI agents",
	title: (
		<>
			One key. <em>Every</em> search engine.
		</>
	),
	lede: "Your agent calls Telem once. Telem routes the request across 11 search engines, 8 page readers and 37 platforms, returns one result shape, and bills each provider at its own price.",
	facts: [
		{
			value: "37",
			label: "platforms",
			note: "小红书, 知乎, X, YouTube…",
			detail: {
				title: "All 37 platforms",
				groups: platformGroups.map((g) => ({
					title: g.title,
					items: g.items.map((p) => (p.zh ? `${p.zh} ${p.name}` : p.name)),
				})),
			},
		},
		{ value: "0%", label: "markup", note: "provider price, passed through" },
		{ value: "$20", label: "free credit", note: "added at first sign-in" },
	],
	cta: { label: "Get a free API key", href: "https://telem.ai/" },
	setup: {
		label: "Copy MCP setup",
		command:
			'claude mcp add --transport http telem https://mcp.telem.ai/mcp --header "Authorization: Bearer $TELEM_API_KEY"',
	},
	painting: {
		src: "/art/telem/hero.webp",
		alt: "Impressionist painting of many small streams joining into one river at dawn, with a single sailboat.",
		title: "The Confluence",
		caption: "Many streams, one river. AI-painted for this page, 2026.",
	},
	verbsTitle: "Four things it does",
	verbs: [
		{
			name: "Search",
			src: "/art/telem/search.webp",
			alt: "A traveler on a hilltop looking through a spyglass over a valley.",
			line: "One question goes to many engines at once and comes back in one shape.",
			when: "you don't know the URL yet.",
			cost: "free – $0.006 per call",
			color: "#1f78cf",
		},
		{
			name: "Fetch",
			src: "/art/telem/fetch.webp",
			alt: "A fisherman hauling a full net into a rowing boat at sunrise.",
			line: "Any URL becomes clean markdown. If one reader fails, the next one tries.",
			when: "you have the URL and need the content.",
			cost: "free – $0.005 per URL",
			color: "#cf5234",
		},
		{
			name: "Monitor",
			src: "/art/telem/monitor.webp",
			alt: "A lighthouse with its lamp lit at dusk above a calm sea.",
			line: "Describe an event in one sentence. An agent checks on a schedule and reports only what changed.",
			when: "you want to be told when it happens.",
			cost: "$0.003 – $0.015 per run",
			color: "#24808a",
		},
		{
			name: "Observe",
			src: "/art/telem/observe.webp",
			alt: "An open ledger, a magnifying glass and a pocket watch on a table under an olive tree.",
			line: "Every call is traced: which engine answered, how fast, and what it cost.",
			when: "you need to see where time and money went.",
			cost: "built in · app.telem.ai",
			color: "#587a2a",
		},
	],
	price: {
		title: "No plan. No platform fee.",
		body: "You pay each provider's own published price and nothing on top. Signing up adds $20 of credit, and failed calls are free.",
		rows: [
			{
				label: "Search",
				value: "$0 – $0.006 / call",
				note: "Most engines are $0.005. One engine is free.",
			},
			{ label: "Fetch", value: "$0 – $0.005 / URL" },
			{
				label: "Monitor",
				value: "$0.003 – $0.015 / run",
				note: "Hourly for 30 days is about $2 – $11.",
			},
			{ label: "Platform fee", value: "$0" },
		],
		foot: "1,000 searches on one engine cost about $5. Ask two engines and you pay both.",
	},
	credit: `An independent guide by ${BRAND}, built on Telem for this hackathon. Not affiliated with Telem AI.`,
	sources: [
		{ label: "telem.ai", href: "https://telem.ai/" },
		{ label: "docs.telem.ai/pricing", href: "https://docs.telem.ai/pricing" },
	],
	guide: "/telem/guide",
	next: { label: "Next room: Tavily", to: "/tavily" },
	theme: {
		paper: "#f8f4ec",
		wall: "#f1ebdf",
		ink: "#1d2330",
		muted: "#687082",
		rule: "#dcd4c4",
		accent: "#1f78cf",
	},
};

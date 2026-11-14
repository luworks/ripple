import { BRAND } from "#/brand";
import type { Pitch } from "#/components/GalleryPitch";
import { platformGroups } from "#/data/telem-platforms";

// Numbers from telem.ai and docs.telem.ai/pricing, read Nov 14, 2026.
// Verb colors follow Telem's own four-color wordmark, darkened for text.
export const telem: Pitch = {
	kicker: "Telem · web infrastructure for AI agents",
	title: (
		<>
			One key. <em>Every</em>
			<br />
			search engine.
		</>
	),
	lede: "One call reaches 11 search engines, 8 page readers and 37 platforms. Telem returns one result shape and bills each provider at its own price.",
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
		{ value: "0%", label: "markup", note: "at provider price" },
		{ value: "$20", label: "free credit", note: "on first sign-in" },
	],
	cta: { label: "Get a free key", href: "https://telem.ai/" },
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
			line: "Describe an event. An agent checks on a schedule and reports what changed.",
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
		title: (
			<>
				No plan.
				<br />
				No platform fee.
			</>
		),
		body: "You pay each provider's own published price, and Telem adds nothing on top. Signing up puts $20 of credit in your account.",
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
		foot: "1,000 searches on one engine cost about $5. Ask two engines and you pay both. Failed calls are free.",
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

// Numbers from tavily.com and docs.tavily.com/documentation/api-credits,
// read Nov 14, 2026. Palette follows Tavily's own cream and sage green.
export const tavily: Pitch = {
	kicker: "Tavily · the web access layer for agents",
	title: (
		<>
			The live web,
			<br />
			<em>ready</em> for agents.
		</>
	),
	lede: "One API, five verbs. Tavily searches, reads and crawls the web, then hands back clean, ranked text your model can use directly instead of raw HTML.",
	facts: [
		{ value: "180 ms", label: "search p50", note: "Tavily's own figure" },
		{ value: "1,000", label: "free credits", note: "every month, no card" },
		{ value: "3M+", label: "developers", note: "building on it" },
	],
	cta: { label: "Get a free key", href: "https://app.tavily.com/" },
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
	verbsTitle: "Five things it does",
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
		title: (
			<>
				One credit
				<br />
				is one search.
			</>
		),
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

/* Every gallery page. Each page lays out the others' text invisibly behind
   its own, so a block is the same size in every room (see GalleryPitch). */
export const rooms = [telem, tavily];

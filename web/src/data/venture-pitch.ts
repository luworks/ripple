// Investor screen data. Every competitor and market number has a public source
// in SOURCES (checked Nov 14, 2026). "not public" = no published figure found.

// Cost of one fresh run, measured on our own runs (Nov 14, 2026):
// - Model: one metered gpt-5.4-mini run used 341,065 input tokens (296,448
//   cached) + 5,514 output = $0.08 at OpenAI list price with 5 searches. The
//   average run does 7.2 searches, so ~$0.11.
// - Telem: across 43 finished runs, 7.2 searches a run got hits from providers
//   12.9 times (~$0.07 at Telem list price); empty answers are billed too, and
//   3.6 page fetches add ~$0.01. Call it $0.09.
// - +10% for retries and failed runs. Total ~$0.22. Cached briefs cost ~$0.
export const RUN_COST = 0.22;
// Run count and timing: every finished real run in research_runs, measured Nov 14, 2026 14:30 PT:
//   select count(*), percentile_disc(0.5) within group (order by duration_ms),
//     percentile_disc(0.9) within group (order by duration_ms) from research_runs
//   where status = 'done' and events @> '[{"text": "Starting agent container"}]';
//   -> 89 runs, median 40.8 s, p90 83.1 s. Cache hits are not runs and are not counted.
export const RUN_COUNT = 89;
export const RUN_SECONDS = 41;
export const RUN_P90_SECONDS = 83;
// Price = cost / (1 - 60% margin), after card fees (2.9% + $0.30).
export const RUN_PRICE = 0.55;
export const PRO_MO = 49;
export const DESK_MO = 199;

// Plans differ only in how many fresh runs they include.
export const PLANS = [
	{
		name: "Free",
		tag: "Try it on today's headlines",
		price: "$0",
		note: "Free forever",
		runs: 5,
		cta: "Start free",
	},
	{
		name: "Pro",
		tag: "For one analyst",
		price: `$${PRO_MO}`,
		note: "Per seat / month",
		runs: 80,
		cta: "Get Pro",
	},
	{
		name: "Desk",
		tag: "For all-day event trading",
		price: `$${DESK_MO}`,
		note: "Per seat / month",
		runs: 330,
		cta: "Get Desk",
	},
];

export const EVERY_PLAN = [
	"The full research agent, no feature gates",
	"Unlimited cached briefs",
	"37 platforms through Telem, 8 of them Chinese",
	"Minute-level prices for every exposed ticker",
	"A source URL and UTC time on every line",
	"HTTP API: POST /api/research, live events over SSE",
];

// "yes" = documented capability; "—" = not advertised on their public pages.
export const PRODUCTS = [
	"Ripple",
	"Bloomberg Terminal",
	"Dataminr",
	"AlphaSense",
	"Benzinga Pro",
];

export const MATRIX: { label: string; cells: string[] }[] = [
	{
		label: "Price per seat",
		cells: [
			`$0 – $${DESK_MO} / mo`,
			"$2,665 / mo",
			"Quote",
			"Quote",
			"$37 – $197 / mo",
		],
	},
	{
		label: "Sign up and cancel monthly",
		cells: ["yes", "2-year contract", "Quote", "Quote", "yes"],
	},
	{
		label: "Type a headline, get a sourced brief in under a minute",
		cells: [`${RUN_SECONDS} s median`, "—", "—", "—", "—"],
	},
	{
		label: "Chinese social: Xiaohongshu, Douyin, Weibo, Zhihu",
		cells: ["yes", "X/Twitter only", "—", "—", "—"],
	},
	{
		label: "Social posts on the same minute clock as the price",
		cells: ["yes", "—", "—", "—", "—"],
	},
	{
		label: "Every line linked to a source URL and UTC time",
		cells: ["yes", "—", "—", "Document citations", "—"],
	},
	{
		label: "Every capability on every plan",
		cells: ["yes", "—", "—", "—", "Gated by tier"],
	},
	{
		label: "The same API our own app uses, included",
		cells: ["yes", "—", "—", "—", "—"],
	},
];

// The home page's short comparison: four MATRIX rows under shorter labels.
export const COMPARE = [
	[
		"Chinese social: Xiaohongshu, Douyin, Weibo, Zhihu",
		"Chinese social signal",
	],
	[
		"Social posts on the same minute clock as the price",
		"Posts and price on one minute clock",
	],
	["Every line linked to a source URL and UTC time", "A source on every claim"],
	["Price per seat", "Price per seat"],
].map(([full, label]) => ({
	label,
	cells: (MATRIX.find((r) => r.label === full) as (typeof MATRIX)[number])
		.cells,
}));
export const PRODUCT_SHORT = [
	"Ripple",
	"Bloomberg",
	"Dataminr",
	"AlphaSense",
	"Benzinga Pro",
];

export const SOURCES = [
	{
		label: "Bloomberg price (NeuGroup, 2024)",
		href: "https://connect.neugroup.com/public/blogs/bloomberg-terminals-how-much-more-youll-pay-next-year",
	},
	{
		label: "Bloomberg terminals (Wikipedia)",
		href: "https://en.wikipedia.org/wiki/Bloomberg_Terminal",
	},
	{
		label: "Bloomberg social sentiment",
		href: "https://www.bloomberg.com/company/press/trending-on-twitter-social-sentiment-analytics",
	},
	{
		label: "Dataminr (2025)",
		href: "https://www.dataminr.com/press/announcement/dataminr-announces-100m-investment-from-fortress/",
	},
	{
		label: "AlphaSense contracts (Vendr)",
		href: "https://www.vendr.com/marketplace/alphasense",
	},
	{
		label: "Benzinga Pro prices",
		href: "https://www.liberatedstocktrader.com/benzinga-discount-coupon-code/",
	},
	{
		label: "Market-data spend (Burton-Taylor via FOW)",
		href: "https://www.fow.com/insights/market-data-spend-hits-usd49-2bn-as-ai-volatility-and-algos-drive-growth",
	},
	{ label: "Telem pricing", href: "https://docs.telem.ai/pricing" },
	{
		label: "GPT-5.4 mini pricing",
		href: "https://openai.com/index/introducing-gpt-5-4-mini-and-nano/",
	},
];

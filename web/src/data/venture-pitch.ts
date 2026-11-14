// Investor screen data. Every competitor and market number has a public source
// in SOURCES (checked Nov 14, 2026). "not public" = no published figure found.

// Our price: $99 per seat per month, 300 fresh runs included, cached runs free.
export const PRICE_MO = 99;
export const RUNS_INCLUDED = 300;

// One live run ("Jensen Huang resigns as Nvidia CEO", Nov 14, 2026, gpt-5.4-mini):
// 341,065 input tokens (296,448 cached) + 5,514 output = ~$0.08 at OpenAI list
// price; 5 Telem searches + 1 fetch = ~$0.03 at Telem list price. 84 s end to end.
export const RUN_COST = 0.11;
export const RUN_SECONDS = 84;

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
			`$${PRICE_MO} / mo`,
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
		label: "Type a headline, get a sourced brief in about a minute",
		cells: [`${RUN_SECONDS} s, measured`, "—", "—", "—", "—"],
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
		label: "Every capability in every seat, no tiers",
		cells: ["yes", "—", "—", "—", "3 tiers"],
	},
	{
		label: "The same API our own app uses, included",
		cells: ["yes", "—", "—", "—", "—"],
	},
];

// Why a desk picks us, one line each, as a direct contrast.
export const REASONS = [
	{
		t: "Answers, not feeds.",
		b: `Terminals and news feeds hand you headlines to read. Ripple reads them for you: people, tickers, timeline and posts in about ${RUN_SECONDS} seconds.`,
	},
	{
		t: "The signal they don't carry.",
		b: "Xiaohongshu, Douyin, Weibo and Zhihu posts, placed on the same minute clock as the price. The incumbents advertise X/Twitter at most.",
	},
	{
		t: "Nothing held back.",
		b: "Every seat gets the full agent, every source and the same HTTP API our own app uses, so a team can wire it into its own agents and dashboards.",
	},
];

export const INCLUDED = [
	"The research agent, unlimited cached briefs",
	`${RUNS_INCLUDED} fresh runs a month, then $0.25 a run`,
	"37 platforms through Telem, 8 of them Chinese",
	"Minute-level prices for every exposed ticker",
	"A source URL and UTC time on every line",
	"HTTP API: POST /api/research, live events over SSE",
];

const SEATS = 325_000;
export const SIZING = [
	{
		label: "Professional terminal seats",
		note: "Bloomberg Terminal subscribers, a proxy for paid market-data users",
		value: "325,000",
	},
	{
		label: "× Price per seat per year",
		note: `$${PRICE_MO} a month, sold as the second screen next to the Terminal`,
		value: `$${(PRICE_MO * 12).toLocaleString("en-US")}`,
	},
	{
		label: "= Seat market",
		note: "Before metered API revenue from quant and risk teams",
		value: `$${Math.round((SEATS * PRICE_MO * 12) / 1e6)}M / yr`,
	},
	{
		label: "Market-data spend, 2025",
		note: "Burton-Taylor, global, +6.5% a year",
		value: "$49.2B",
	},
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

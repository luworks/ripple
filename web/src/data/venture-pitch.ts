// Investor screen data. Every competitor and market number has a public source
// in SOURCES (checked Nov 14, 2026). "not public" = no published figure found.

export const TABLE = {
	cols: [
		"Ripple",
		"Bloomberg Terminal",
		"Dataminr",
		"AlphaSense",
		"Benzinga Pro",
	],
	rows: [
		{
			label: "What it is",
			cells: [
				"Headline → people, tickers, posts and minute prices",
				"Data, news, analytics, trading",
				"Real-time event alerts for security, government, newsrooms",
				"AI search over filings, transcripts, expert calls",
				"Real-time news feed and audio squawk for traders",
			],
		},
		{
			label: "Price",
			cells: [
				"$500 / seat / mo (planned)",
				"$31,980 / seat / yr (single seat)",
				"not public",
				"not public (median contract $18,750 / yr, Vendr)",
				"$37 – $197 / mo",
			],
		},
		{
			label: "Chinese social (Weibo, Xiaohongshu…)",
			cells: [
				"yes",
				"Not advertised (X/Twitter only)",
				"Not advertised",
				"Not advertised",
				"Not advertised",
			],
		},
		{
			label: "Posts and price on one minute timeline",
			cells: [
				"yes",
				"Not advertised",
				"Not advertised",
				"Not advertised",
				"Not advertised",
			],
		},
		{
			label: "Every line linked to source + UTC time",
			cells: [
				"yes",
				"not public",
				"not public",
				"Cites documents",
				"not public",
			],
		},
		{
			label: "Public scale",
			cells: [
				"Hackathon prototype",
				"~325,000 terminals",
				"~$200M ARR (2025)",
				"$500M ARR, 6,500+ customers (2025)",
				"not public",
			],
		},
	],
};

const SEATS = 325_000;
const PRICE_YR = 6_000; // $500 / month
export const SIZING = {
	headline: "~$2B a year in seats",
	short: `${SEATS.toLocaleString("en-US")} terminal seats × $6,000 a year. A slice of the $49.2B spent on market data in 2025.`,
	steps: [
		{
			label: "Professional terminal seats",
			note: "Bloomberg Terminal subscribers, a proxy for paid market-data users",
			value: "325,000",
		},
		{
			label: "× Price per seat per year",
			note: "Our planned $500/month, about 1/5 of a $31,980 Terminal seat",
			value: "$6,000",
		},
		{
			label: "= Seat market",
			note: "Before API revenue from quant and risk teams",
			value: `$${((SEATS * PRICE_YR) / 1e9).toFixed(2)}B`,
		},
		{
			label: "Share of 2025 market-data spend",
			note: "Burton-Taylor: $49.2B global, +6.5% a year",
			value: `${((SEATS * PRICE_YR * 100) / 49.2e9).toFixed(0)}%`,
		},
		{
			label: "Beachhead: 1% of those seats",
			note: "3,250 event-driven seats; an illustration, not a forecast",
			value: `$${((SEATS * 0.01 * PRICE_YR) / 1e6).toFixed(1)}M ARR`,
		},
	],
};

// One live run ("Jensen Huang resigns as Nvidia CEO", Nov 14, 2026, gpt-5.4-mini):
// 341,065 input tokens (296,448 cached) + 5,514 output = ~$0.08 at OpenAI list
// price; 5 Telem searches + 1 fetch = ~$0.03 at Telem list price. 84 s end to end.
export const RUN = {
	line: "One measured run: 84 seconds, 6 Telem calls, about $0.11 in model and search fees. A seat running 1,000 queries a month costs ~$110 against a $500 price.",
};

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
		label: "Dataminr ARR (2025)",
		href: "https://www.dataminr.com/press/announcement/dataminr-announces-100m-investment-from-fortress/",
	},
	{
		label: "AlphaSense ARR (2025)",
		href: "https://www.prnewswire.com/news-releases/alphasense-surpasses-500m-in-arr-as-adoption-of-applied-ai-workflows-surges-302576369.html",
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

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

export const COMPARE: {
	name: string;
	price: string;
	line: string;
	us?: boolean;
}[] = [
	{
		name: "Ripple",
		price: `$${PRICE_MO} / seat / mo`,
		line: `Headline to people, tickers, social posts and minute prices, each line sourced. ${RUNS_INCLUDED} fresh runs included; cached runs free.`,
		us: true,
	},
	{
		name: "Bloomberg Terminal",
		price: "$2,665 / seat / mo",
		line: "Data, news, analytics and trading. $31,980 a year for one seat. Social signal advertised for X/Twitter only.",
	},
	{
		name: "AlphaSense",
		price: "not public",
		line: "AI search over filings, transcripts and expert calls. Median contract $18,750 a year (Vendr).",
	},
	{
		name: "Dataminr",
		price: "not public",
		line: "Real-time event alerts from public data, sold to security teams, governments and newsrooms.",
	},
	{
		name: "Benzinga Pro",
		price: "$37 – $197 / mo",
		line: "Real-time news feed and audio squawk for traders. Chinese social not advertised.",
	},
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

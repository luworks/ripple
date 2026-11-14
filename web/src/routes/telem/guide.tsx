import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/telem/guide")({
	head: () => ({
		meta: [
			{ title: "Telem field notes · Ripple" },
			{
				name: "description",
				content:
					"What Telem does (search, fetch, 37 platforms, monitors), how to call it, what it costs, and what we measured in live tests.",
			},
		],
	}),
	component: TelemPage,
});

/* ------------------------------------------------------------------ data */
// Facts from docs.telem.ai (read Nov 14, 2026) and our own live tests the same day.

const stats = [
	{ value: "11", label: "search engines", note: "behind one endpoint" },
	{ value: "8", label: "page readers", note: "tried in a fallback chain" },
	{ value: "37", label: "platforms", note: "incl. 8 Chinese ones" },
	{ value: "0%", label: "markup", note: "you pay provider prices" },
];

const verbs = [
	{
		id: "search",
		name: "Search",
		endpoint: "POST /v1/search",
		job: "Ask a question, get links from many engines at once.",
		when: "You don't know the URL yet.",
		measured: "≈450 ms for 2 engines",
	},
	{
		id: "fetch",
		name: "Fetch",
		endpoint: "POST /v1/fetch",
		job: "Give URLs, get clean markdown back. Retries other readers if one fails.",
		when: "You have the URL and need the content.",
		measured: "YouTube video → 72k-char transcript",
	},
	{
		id: "platforms",
		name: "Platforms",
		endpoint: "providers.include",
		job: "Search and read walled gardens: 小红书, 知乎, 公众号, X, LinkedIn, YouTube…",
		when: "The answer lives inside a social app, not the open web.",
		measured: "小红书 search in 4.2 s",
	},
	{
		id: "monitors",
		name: "Monitors",
		endpoint: "POST /v1/monitors",
		job: "Describe an event in plain English; an agent checks on a schedule and reports changes.",
		when: "You want to be told when something happens.",
		measured: "First run found 7 items in 66 s",
	},
];

const engines = [
	"exa",
	"tavily",
	"brave",
	"perplexity",
	"parallel",
	"you",
	"linkup",
	"ceramic",
	"seltz",
	"serpapi",
	"tinyfish",
];

type Tier = "minimalist" | "default" | "extended" | "max";
const tiers: Record<
	Tier,
	{ adds: string[]; latency: string; use: string; caveat?: string }
> = {
	minimalist: {
		adds: ["url", "title", "rank"],
		latency: "≈ 450 ms",
		use: "Just need links to pick from.",
	},
	default: {
		adds: ["summary"],
		latency: "≈ 450 ms",
		use: "Most agent calls. A snippet per link is enough to decide.",
	},
	extended: {
		adds: ["excerpt", "publish_date", "full_content", "usage"],
		latency: "up to 3.4 s",
		use: "Need dates or the page text in the same call.",
		caveat: "Some engines charge more here (tavily $0.010, parallel $0.005).",
	},
	max: {
		adds: [
			"answer",
			"entities",
			"related",
			"enrichments",
			"thumbnail",
			"favicon",
			"source",
		],
		latency: "can wait up to 90 s",
		use: "Rich cards, a direct answer, likes/views on social posts.",
		caveat: "MCP clients time out at about 60 s, so avoid max there.",
	},
};

// Price per search call, USD. Source: docs.telem.ai/pricing.
const prices = [
	{ name: "tinyfish", usd: 0, note: "free" },
	{ name: "ceramic", usd: 0.00005, note: "≈90 ms in our test" },
	{ name: "parallel", usd: 0.001, note: "$0.005 at extended" },
	{ name: "brave", usd: 0.005 },
	{ name: "perplexity", usd: 0.005 },
	{ name: "seltz", usd: 0.005 },
	{ name: "linkup", usd: 0.005, note: "deep mode $0.05" },
	{ name: "you", usd: 0.005, note: "+$0.001 per live-crawled page" },
	{ name: "tavily", usd: 0.005, note: "$0.010 at extended/max" },
	{ name: "serpapi", usd: 0.006, note: "Google results" },
];
const maxPrice = 0.006;

const knobs = [
	["Batch", "Up to 32 queries in one call (queries × results ≤ 160)."],
	["Pick engines", "providers.include / exclude, or let auto-routing pick."],
	["Auto-routing", 'auto_routing: "accuracy" picks engines per query.'],
	["Date window", "published_after / published_before."],
	["Domains", "include_domains: up to 20 sites."],
	["Full text", "include_full_content returns the page body inline."],
	["Count", "num_results 1–20 per engine (default 5)."],
	["Lineage", "session_id + metadata tie calls into one agent trace."],
];

const fetchChain = [
	"tinyfish",
	"tavily",
	"exa",
	"firecrawl",
	"jina",
	"parallel",
	"you",
	"linkup",
];

type Mode = "both" | "fetch" | "search";
type Platform = { name: string; zh?: string; mode: Mode };
const platformGroups: { title: string; items: Platform[] }[] = [
	{
		title: "China",
		items: [
			{ name: "Xiaohongshu", zh: "小红书", mode: "both" },
			{ name: "Zhihu", zh: "知乎", mode: "both" },
			{ name: "WeChat articles", zh: "公众号", mode: "both" },
			{ name: "Weibo", zh: "微博", mode: "both" },
			{ name: "Douyin", zh: "抖音", mode: "both" },
			{ name: "Bilibili", zh: "B站", mode: "both" },
			{ name: "Kuaishou", zh: "快手", mode: "both" },
			{ name: "Toutiao", zh: "头条", mode: "both" },
		],
	},
	{
		title: "Social & video",
		items: [
			{ name: "X", mode: "both" },
			{ name: "YouTube", mode: "both" },
			{ name: "LinkedIn", mode: "both" },
			{ name: "TikTok", mode: "both" },
			{ name: "Instagram", mode: "both" },
			{ name: "Telegram", mode: "both" },
			{ name: "Substack", mode: "both" },
			{ name: "Pinterest", mode: "both" },
			{ name: "Lemon8", mode: "both" },
			{ name: "Facebook", mode: "fetch" },
			{ name: "Twitch", mode: "fetch" },
			{ name: "VK", mode: "fetch" },
			{ name: "Snapchat", mode: "fetch" },
			{ name: "Quora", mode: "search" },
		],
	},
	{
		title: "Places & reviews",
		items: [
			{ name: "Google Maps", mode: "both" },
			{ name: "Google Reviews", mode: "both" },
			{ name: "TripAdvisor", mode: "both" },
			{ name: "Trustpilot", mode: "both" },
			{ name: "Airbnb", mode: "both" },
			{ name: "Yelp", mode: "fetch" },
			{ name: "Booking.com", mode: "fetch" },
			{ name: "Glassdoor", mode: "fetch" },
		],
	},
	{
		title: "Shopping & apps",
		items: [
			{ name: "Amazon", mode: "both" },
			{ name: "Product Hunt", mode: "both" },
			{ name: "Google Play", mode: "both" },
			{ name: "App Store", mode: "fetch" },
			{ name: "G2", mode: "fetch" },
		],
	},
	{
		title: "Ad libraries",
		items: [
			{ name: "LinkedIn Ad Library", mode: "both" },
			{ name: "Facebook Ad Library", mode: "both" },
		],
	},
];

type Verdict = "works" | "partial" | "broken";
const platformTests: {
	platform: string;
	search: string;
	fetch: string;
	verdict: Verdict;
	note: string;
}[] = [
	{
		platform: "小红书 Xiaohongshu",
		search: "3 providers, all returned posts · 4.2–15 s",
		fetch: "Note text via 3 providers · 0.2–5 s",
		verdict: "works",
		note: "tikhub_xhs is the fastest.",
	},
	{
		platform: "知乎 Zhihu",
		search: "Questions & articles · 1.3–3 s",
		fetch: "Articles and answers · 0.3–1.7 s",
		verdict: "partial",
		note: "One failed fetch was still logged as billed.",
	},
	{
		platform: "公众号 WeChat",
		search: "Articles found · 2.3 s",
		fetch: "Full article when pinned · 3.5 s",
		verdict: "partial",
		note: "Pin socialdatax_wechat; auto-routing fell back to exa.",
	},
	{
		platform: "X",
		search: "Posts found · 4–6 s",
		fetch: "Post text · 2.6–6.4 s",
		verdict: "partial",
		note: "Search results come back with empty titles.",
	},
	{
		platform: "LinkedIn",
		search: "Posts found · 3.5–6.5 s",
		fetch: "Company page OK; job pages fail on brightdata",
		verdict: "partial",
		note: "Job pages worked through the default chain (tinyfish).",
	},
	{
		platform: "YouTube",
		search: "Videos found · 3.5 s",
		fetch: "Full timestamped transcript, 52–72k chars",
		verdict: "works",
		note: "Transcript arrives in content; the transcript field is empty.",
	},
];

const monitorSteps = [
	{
		t: "0 s",
		title: "You describe it",
		body: '"Anthropic or OpenAI announces a new AI model release"',
	},
	{
		t: "61 s",
		title: "Agent writes a plan",
		body: "Turns the sentence into a spec: what counts, what to track, how to verify.",
	},
	{
		t: "+66 s",
		title: "First check runs",
		body: "Searches, reads sources, and judges each candidate with quoted evidence.",
	},
	{
		t: "result",
		title: "7 candidates found",
		body: "3 qualified (Claude Fable 5.2 & Mythos 5.2, GPT-6 Cyber, Images 2.6), 2 rejected, 2 unclear.",
	},
];

const changeKinds = [
	["entity_added", "A new thing that matches (a new model, a new filing)"],
	["value_changed", "A tracked attribute changed (price, date, status)"],
	[
		"fact_status_changed",
		"A claim moved from unclear to confirmed or rejected",
	],
	["alert", "Something the plan marked as important"],
	["run", "A check finished"],
	["plan_changed", "The agent revised its own plan"],
];

const snippets: Record<string, { label: string; code: string }> = {
	curl: {
		label: "curl",
		code: `curl https://router.telem.ai/v1/search \\
  -H "Authorization: Bearer $TELEM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_input": { "query": "LangGraph latest release" },
    "search": { "providers": { "include": ["brave", "exa"] }, "num_results": 3 }
  }'`,
	},
	platform: {
		label: "小红书 search",
		code: `curl https://router.telem.ai/v1/search \\
  -H "Authorization: Bearer $TELEM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_input": { "query": "AI agent 求职" },
    "search": { "providers": { "include": ["tikhub_xhs"] } }
  }'`,
	},
	python: {
		label: "Python",
		code: `# uv pip install telem-sdk
from telem import Telem

client = Telem()  # reads TELEM_API_KEY
hits = client.search("best python http client")
page = client.fetch(["https://www.youtube.com/watch?v=..."])

monitor = client.monitors.create(
    "Nvidia files a new 8-K with the SEC", frequency="1h", ttl="30d")
for change in client.monitors.iter_changes(monitor.id, cursor=0):
    print(change.seq, change.kind, change.subject.name)`,
	},
	mcp: {
		label: "Claude Code (MCP)",
		code: `claude mcp add --transport http telem https://mcp.telem.ai/mcp \\
  --header "Authorization: Bearer $TELEM_API_KEY" \\
  --header "X-Telem-Auto-Routing: accuracy"

# 12 tools: telem_search, telem_fetch, telem_providers,
# telem_session_history, monitor_create / list / get / agent /
# changes / pause / resume / delete`,
	},
	js: {
		label: "TypeScript",
		code: `// npm install @telemai/sdk
import Telem from "@telemai/sdk"

const telem = new Telem()  // reads TELEM_API_KEY
const res = await telem.search("Claude Code release notes")`,
	},
};

const caveats: { title: string; body: string }[] = [
	{
		title: "Monitors cost more than the pricing page says",
		body: "Pricing lists $0.003–0.015 per run. We measured $0.095 to compile the plan and $0.088 per check.",
	},
	{
		title: "A failed call can still be billed",
		body: 'A Zhihu fetch that failed upstream returned "recorded and billed". The docs say failed calls are free. Reported.',
	},
	{
		title: "Some providers are missing keys",
		body: "tavily fetch returned MissingApiKey on every call; socialdatax_wechat did too under auto-routing.",
	},
	{
		title: "No shared relevance score",
		body: "Each engine ranks its own results. Merge by URL yourself if you query several.",
	},
	{
		title: "Batch fetch can drop a URL",
		body: "When one of several URLs fails, it may be missing from the response instead of marked failed.",
	},
	{
		title: "Cache flag not always honored",
		body: "Pages are cached for a day; no_cache did not always force a fresh read in our tests.",
	},
];

/* ------------------------------------------------------------------ page */

function TelemPage() {
	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
			<div className="mx-auto flex max-w-5xl flex-col gap-24 px-4 py-16 sm:px-6 sm:py-20">
				<Hero />
				<HowItWorks />
				<SearchSection />
				<FetchSection />
				<PlatformsSection />
				<MonitorsSection />
				<CodeSection />
				<PricingSection />
				<CaveatsSection />
				<footer className="text-xs text-zinc-600">
					Ripple · sources: docs.telem.ai and our own API calls on Nov 14, 2026
					·{" "}
					<Link to="/telem" className="hover:text-zinc-400">
						back to the Telem overview
					</Link>
				</footer>
			</div>
		</main>
	);
}

function Hero() {
	return (
		<header className="flex flex-col gap-10">
			<div className="flex flex-col gap-5">
				<span className="w-fit rounded-full border border-zinc-800 px-3 py-1 text-xs tracking-wide text-zinc-400">
					Tool explainer · tested Nov 14, 2026
				</span>
				<h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
					Telem: one API key for{" "}
					<span className="text-emerald-400">every search engine</span>, page
					reader and social platform.
				</h1>
				<p className="max-w-3xl text-lg leading-relaxed text-zinc-400">
					Instead of signing up for Exa, Tavily, Brave, Firecrawl and a dozen
					scrapers, your agent calls Telem. It fans the request out, returns
					every result in the same shape, and bills each provider at cost.
				</p>
			</div>
			<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{stats.map((s) => (
					<div key={s.label} className="rounded-xl border border-zinc-800 p-5">
						<dd className="text-3xl font-semibold tabular-nums text-emerald-400">
							{s.value}
						</dd>
						<dt className="mt-1 text-sm font-medium">{s.label}</dt>
						<div className="text-xs text-zinc-500">{s.note}</div>
					</div>
				))}
			</dl>
			<nav className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{verbs.map((v, i) => (
					<a
						key={v.id}
						href={`#${v.id}`}
						className="group flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition-colors hover:border-emerald-400/50"
					>
						<div className="flex items-baseline justify-between">
							<span className="text-lg font-medium">
								<span className="mr-2 text-zinc-600">{i + 1}</span>
								{v.name}
							</span>
							<span className="text-zinc-600 group-hover:text-emerald-400">
								↓
							</span>
						</div>
						<p className="text-sm leading-relaxed text-zinc-300">{v.job}</p>
						<p className="text-xs text-zinc-500">Use when: {v.when}</p>
						<p className="mt-auto pt-2 font-mono text-xs text-emerald-300/80">
							{v.measured}
						</p>
					</a>
				))}
			</nav>
		</header>
	);
}

function SectionTitle({
	id,
	kicker,
	title,
	children,
}: {
	id?: string;
	kicker: string;
	title: string;
	children?: React.ReactNode;
}) {
	return (
		<div id={id} className="flex scroll-mt-24 flex-col gap-3">
			<span className="text-xs font-medium uppercase tracking-wider text-emerald-400">
				{kicker}
			</span>
			<h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
				{title}
			</h2>
			{children && (
				<p className="max-w-3xl leading-relaxed text-zinc-400">{children}</p>
			)}
		</div>
	);
}

function HowItWorks() {
	return (
		<section className="flex flex-col gap-8">
			<SectionTitle kicker="The idea" title="A router in front of the web">
				One request goes in. Telem sends it to the engines you choose (or picks
				them for you), waits for all of them, and hands back one normalized list
				per engine.
			</SectionTitle>
			<div className="grid grid-cols-1 items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 md:grid-cols-[1fr_auto_1.2fr_auto_2fr]">
				<FlowBox title="Your agent" sub="one HTTP call, one key" />
				<Arrow />
				<FlowBox
					title="Telem router"
					sub="auto-routing · cache · billing · session trace"
					accent
				/>
				<Arrow />
				<div className="flex flex-wrap gap-2">
					{engines.map((e) => (
						<span
							key={e}
							className="rounded-md border border-zinc-700 px-2 py-1 font-mono text-xs text-zinc-300"
						>
							{e}
						</span>
					))}
					<span className="rounded-md border border-dashed border-zinc-700 px-2 py-1 text-xs text-zinc-500">
						+ 37 platform providers
					</span>
				</div>
			</div>
		</section>
	);
}

function FlowBox({
	title,
	sub,
	accent,
}: {
	title: string;
	sub: string;
	accent?: boolean;
}) {
	return (
		<div
			className={`rounded-xl border p-4 ${accent ? "border-emerald-500/50 bg-emerald-500/5" : "border-zinc-700"}`}
		>
			<div className="font-medium">{title}</div>
			<div className="mt-1 text-xs text-zinc-500">{sub}</div>
		</div>
	);
}

function Arrow() {
	return (
		<div className="text-center text-xl text-zinc-600" aria-hidden>
			<span className="hidden md:inline">→</span>
			<span className="md:hidden">↓</span>
		</div>
	);
}

function SearchSection() {
	const [tier, setTier] = useState<Tier>("default");
	const order = Object.keys(tiers) as Tier[];
	const cumulative = order
		.slice(0, order.indexOf(tier) + 1)
		.flatMap((t) => tiers[t].adds.map((f) => ({ f, isNew: t === tier })));
	const info = tiers[tier];

	return (
		<section className="flex flex-col gap-8">
			<SectionTitle
				id="search"
				kicker="1 · Search"
				title="Ask many engines at once"
			>
				Pick engines yourself, or set auto-routing and let Telem choose. The{" "}
				<code className="text-zinc-300">tier</code> decides how much each result
				carries. Click a tier:
			</SectionTitle>

			<div className="rounded-2xl border border-zinc-800 p-6">
				<div className="flex flex-wrap gap-2" role="tablist">
					{order.map((t) => (
						<button
							key={t}
							type="button"
							role="tab"
							aria-selected={t === tier}
							onClick={() => setTier(t)}
							className={`rounded-lg px-4 py-2 font-mono text-sm transition-colors ${t === tier ? "bg-emerald-400 text-zinc-950" : "border border-zinc-800 text-zinc-400 hover:text-zinc-100"}`}
						>
							{t}
						</button>
					))}
				</div>
				<div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[2fr_1fr]">
					<div>
						<div className="text-xs uppercase tracking-wider text-zinc-500">
							Fields in each result
						</div>
						<div className="mt-3 flex flex-wrap gap-2">
							{cumulative.map(({ f, isNew }) => (
								<span
									key={f}
									className={`rounded-md px-2 py-1 font-mono text-xs ${isNew ? "border border-emerald-500/50 text-emerald-300" : "border border-zinc-800 text-zinc-400"}`}
								>
									{f}
								</span>
							))}
						</div>
						<p className="mt-4 text-sm text-zinc-300">{info.use}</p>
						{info.caveat && (
							<p className="mt-2 text-sm text-amber-300/90">{info.caveat}</p>
						)}
					</div>
					<div className="rounded-xl bg-zinc-900/60 p-4">
						<div className="text-xs uppercase tracking-wider text-zinc-500">
							Measured latency
						</div>
						<div className="mt-1 text-2xl font-semibold tabular-nums">
							{info.latency}
						</div>
						<div className="mt-1 text-xs text-zinc-500">
							brave + exa, 2 results each
						</div>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{knobs.map(([k, v]) => (
					<div key={k} className="rounded-xl border border-zinc-800 p-4">
						<div className="text-sm font-medium">{k}</div>
						<div className="mt-1 text-xs leading-relaxed text-zinc-500">
							{v}
						</div>
					</div>
				))}
			</div>
			<p className="text-sm text-zinc-500">
				Every response also carries <code>warnings</code>, so the agent knows
				when an engine ignored a filter, clamped the count or fell back:{" "}
				<span className="font-mono text-zinc-400">
					capability_gap · count_clamped · outside_window · routing_fallback ·
					paid_knob_engaged
				</span>
				.
			</p>
		</section>
	);
}

function FetchSection() {
	return (
		<section className="flex flex-col gap-8">
			<SectionTitle
				id="fetch"
				kicker="2 · Fetch"
				title="Read any URL, with automatic fallback"
			>
				Send up to 5 URLs. Telem tries readers in order until one succeeds,
				reorders the chain by URL type (a YouTube link goes to a video reader
				first), and caches pages for a day.
			</SectionTitle>
			<div className="rounded-2xl border border-zinc-800 p-6">
				<div className="text-xs uppercase tracking-wider text-zinc-500">
					Default reader chain
				</div>
				<ol className="mt-4 flex flex-wrap items-center gap-2">
					{fetchChain.map((p, i) => (
						<li key={p} className="flex items-center gap-2">
							<span
								className={`rounded-md border px-3 py-1.5 font-mono text-xs ${i === 0 ? "border-emerald-500/50 text-emerald-300" : "border-zinc-700 text-zinc-300"}`}
							>
								{p}
							</span>
							{i < fetchChain.length - 1 && (
								<span className="text-zinc-600">→</span>
							)}
						</li>
					))}
				</ol>
				<p className="mt-4 text-sm text-zinc-500">
					Fails over on error. Pin one with{" "}
					<code className="text-zinc-300">options.providers</code>.{" "}
					<code className="text-zinc-300">brightdata</code> (LinkedIn) is
					pin-only.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<ResultCard
					label="YouTube video"
					value="72k chars"
					body="Full timestamped transcript as markdown, in 7.9 s."
				/>
				<ResultCard
					label="GitHub releases page"
					value="extended tier"
					body="Adds links, images, raw HTML, screenshot and the provider chain that ran."
				/>
				<ResultCard
					label="LinkedIn job page"
					value="fallback saved it"
					body="Pinned brightdata failed; the default chain read it via tinyfish (6.9k chars)."
				/>
			</div>
		</section>
	);
}

function ResultCard({
	label,
	value,
	body,
}: {
	label: string;
	value: string;
	body: string;
}) {
	return (
		<div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
			<div className="text-xs uppercase tracking-wider text-zinc-500">
				{label}
			</div>
			<div className="mt-2 text-xl font-semibold text-emerald-400">{value}</div>
			<p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
		</div>
	);
}

const MODE: Record<Mode, { label: string; cls: string }> = {
	both: { label: "search + fetch", cls: "border-zinc-700 text-zinc-200" },
	fetch: { label: "fetch only", cls: "border-sky-500/40 text-sky-200" },
	search: { label: "search only", cls: "border-violet-500/40 text-violet-200" },
};

const VERDICT: Record<Verdict, { label: string; cls: string }> = {
	works: { label: "Works", cls: "border-emerald-500/40 text-emerald-300" },
	partial: {
		label: "Works, with a catch",
		cls: "border-amber-500/40 text-amber-300",
	},
	broken: { label: "Broken", cls: "border-rose-500/40 text-rose-300" },
};

function PlatformsSection() {
	return (
		<section className="flex flex-col gap-8">
			<SectionTitle
				id="platforms"
				kicker="3 · Platforms"
				title="37 places most search APIs can't reach"
			>
				Name the platform provider and Telem searches or reads inside it. These
				are never chosen automatically for search; you opt in per call.
			</SectionTitle>
			<div className="flex flex-wrap gap-4 text-xs text-zinc-500">
				{(Object.keys(MODE) as Mode[]).map((m) => (
					<span key={m} className="flex items-center gap-2">
						<span className={`rounded border px-2 py-0.5 ${MODE[m].cls}`}>
							Aa
						</span>
						{MODE[m].label}
					</span>
				))}
			</div>
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
				{platformGroups.map((g) => (
					<div key={g.title} className="rounded-2xl border border-zinc-800 p-5">
						<div className="flex items-baseline justify-between">
							<h3 className="font-medium">{g.title}</h3>
							<span className="text-xs text-zinc-500">{g.items.length}</span>
						</div>
						<div className="mt-3 flex flex-wrap gap-2">
							{g.items.map((p) => (
								<span
									key={p.name}
									title={MODE[p.mode].label}
									className={`rounded-md border px-2 py-1 text-xs ${MODE[p.mode].cls}`}
								>
									{p.zh ? `${p.zh} ${p.name}` : p.name}
								</span>
							))}
						</div>
					</div>
				))}
			</div>

			<div className="flex flex-col gap-3">
				<h3 className="text-lg font-medium">
					We tested the six that matter most to us
				</h3>
				<div className="overflow-x-auto rounded-2xl border border-zinc-800">
					<table className="w-full min-w-[720px] text-left text-sm">
						<thead className="text-xs uppercase tracking-wider text-zinc-500">
							<tr className="border-b border-zinc-800">
								<th className="px-4 py-3 font-medium">Platform</th>
								<th className="px-4 py-3 font-medium">Search</th>
								<th className="px-4 py-3 font-medium">Fetch</th>
								<th className="px-4 py-3 font-medium">Verdict</th>
							</tr>
						</thead>
						<tbody>
							{platformTests.map((r) => (
								<tr
									key={r.platform}
									className="border-b border-zinc-900 align-top last:border-0"
								>
									<td className="whitespace-nowrap px-4 py-3 font-medium">
										{r.platform}
									</td>
									<td className="px-4 py-3 text-zinc-400">{r.search}</td>
									<td className="px-4 py-3 text-zinc-400">{r.fetch}</td>
									<td className="px-4 py-3">
										<span
											className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${VERDICT[r.verdict].cls}`}
										>
											{VERDICT[r.verdict].label}
										</span>
										<div className="mt-1.5 text-xs text-zinc-500">{r.note}</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<p className="text-sm text-zinc-500">
					36 live calls on Nov 14, 2026. All six returned real content; the
					catches are listed per row.
				</p>
			</div>
		</section>
	);
}

function MonitorsSection() {
	return (
		<section className="flex flex-col gap-8">
			<SectionTitle
				id="monitors"
				kicker="4 · Monitors"
				title="Describe an event, get told when it happens"
			>
				A monitor is a small agent. It turns your sentence into a plan, then
				checks on a schedule and records only what changed. Read changes with a
				cursor, or receive them by webhook.
			</SectionTitle>
			<ol className="grid grid-cols-1 gap-4 md:grid-cols-4">
				{monitorSteps.map((s, i) => (
					<li
						key={s.title}
						className={`rounded-xl border p-5 ${i === monitorSteps.length - 1 ? "border-emerald-500/50 bg-emerald-500/5" : "border-zinc-800"}`}
					>
						<div className="font-mono text-xs text-emerald-400">{s.t}</div>
						<div className="mt-2 font-medium">{s.title}</div>
						<p className="mt-2 text-sm leading-relaxed text-zinc-400">
							{s.body}
						</p>
					</li>
				))}
			</ol>
			<p className="-mt-4 text-xs text-zinc-500">Our real run, Nov 14, 2026.</p>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div className="rounded-xl border border-zinc-800 p-5">
					<div className="text-xs uppercase tracking-wider text-zinc-500">
						How often
					</div>
					<div className="mt-3 flex flex-wrap gap-2">
						{["1h", "6h", "12h", "1d", "7d"].map((f) => (
							<span
								key={f}
								className={`rounded-md border px-2 py-1 font-mono text-xs ${f === "1h" ? "border-emerald-500/50 text-emerald-300" : "border-zinc-700 text-zinc-300"}`}
							>
								{f}
							</span>
						))}
					</div>
					<p className="mt-3 text-sm text-zinc-400">
						Fastest schedule is hourly. “Run now” triggers an extra check on
						demand. Lives up to 30 days.
					</p>
				</div>
				<div className="rounded-xl border border-zinc-800 p-5 md:col-span-2">
					<div className="text-xs uppercase tracking-wider text-zinc-500">
						What it reports
					</div>
					<dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
						{changeKinds.map(([k, v]) => (
							<div key={k} className="text-sm">
								<dt className="font-mono text-xs text-zinc-300">{k}</dt>
								<dd className="text-xs text-zinc-500">{v}</dd>
							</div>
						))}
					</dl>
				</div>
			</div>
		</section>
	);
}

function CodeSection() {
	const keys = Object.keys(snippets);
	const [active, setActive] = useState(keys[0]);
	const [copied, setCopied] = useState(false);
	const code = snippets[active].code;

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			/* clipboard blocked: user can still select the text */
		}
	};

	return (
		<section className="flex flex-col gap-8">
			<SectionTitle kicker="Use it" title="Five ways in, same results">
				REST, Python, TypeScript, or as tools inside Claude Code, Codex and
				Cursor through the hosted MCP server.
			</SectionTitle>
			<div className="overflow-hidden rounded-2xl border border-zinc-800">
				<div className="flex items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/60 px-3">
					<div className="flex overflow-x-auto" role="tablist">
						{keys.map((k) => (
							<button
								key={k}
								type="button"
								role="tab"
								aria-selected={k === active}
								onClick={() => setActive(k)}
								className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors ${k === active ? "border-emerald-400 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
							>
								{snippets[k].label}
							</button>
						))}
					</div>
					<button
						type="button"
						onClick={copy}
						className="shrink-0 rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-100"
					>
						{copied ? "Copied" : "Copy"}
					</button>
				</div>
				<pre className="overflow-x-auto p-5 text-[13px] leading-relaxed text-zinc-300">
					<code>{code}</code>
				</pre>
			</div>
		</section>
	);
}

function PricingSection() {
	return (
		<section className="flex flex-col gap-8">
			<SectionTitle kicker="Cost" title="What 1,000 searches cost, per engine">
				Billed per engine that answers, at that engine's price. Ask two engines,
				pay twice. New accounts get $20 of credit; no daily cap, 6,000 items a
				minute.
			</SectionTitle>
			<div className="flex flex-col gap-2 rounded-2xl border border-zinc-800 p-6">
				{prices.map((p) => (
					<div
						key={p.name}
						className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3 text-sm sm:grid-cols-[7rem_1fr_5rem_14rem]"
					>
						<span className="font-mono text-zinc-300">{p.name}</span>
						<div className="h-2 rounded-full bg-zinc-900">
							<div
								className="h-2 rounded-full bg-emerald-400"
								style={{
									width: `${Math.max((p.usd / maxPrice) * 100, p.usd > 0 ? 1.5 : 0)}%`,
								}}
							/>
						</div>
						<span className="text-right tabular-nums text-zinc-200">
							{p.usd === 0 ? "free" : `$${(p.usd * 1000).toFixed(2)}`}
						</span>
						<span className="hidden text-xs text-zinc-500 sm:block">
							{p.note ?? ""}
						</span>
					</div>
				))}
				<p className="mt-3 text-xs text-zinc-500">
					Default tier. Platform providers bill by their own units (per call,
					page or record); fetch is billed by the reader that succeeded.
				</p>
			</div>
		</section>
	);
}

function CaveatsSection() {
	return (
		<section className="flex flex-col gap-8">
			<SectionTitle
				kicker="Honest notes"
				title="What the official docs don't tell you"
			>
				Found while testing with real calls. Worth knowing before you build on
				it.
			</SectionTitle>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{caveats.map((c) => (
					<div
						key={c.title}
						className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-5"
					>
						<div className="font-medium text-amber-200">{c.title}</div>
						<p className="mt-2 text-sm leading-relaxed text-zinc-400">
							{c.body}
						</p>
					</div>
				))}
			</div>
		</section>
	);
}

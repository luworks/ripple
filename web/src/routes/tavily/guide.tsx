import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/tavily/guide")({
	head: () => ({
		meta: [
			{ title: "Tavily field notes · Ripple" },
			{
				name: "description",
				content:
					"What Tavily does (search, extract, map, crawl, research), how to call it, what it costs, and what we measured in live tests.",
			},
		],
	}),
	component: TavilyPage,
});

/* ------------------------------------------------------------------ data */
// Facts from docs.tavily.com (llms.txt, OpenAPI spec, changelog; read Nov 14, 2026)
// and our own live API calls the same day.

const stats = [
	{ value: "5", label: "capabilities", note: "search to cited report" },
	{ value: "1,000", label: "free credits", note: "every month, no card" },
	{ value: "0.28 s", label: "fastest search", note: "ultra-fast, measured" },
	{ value: "$0.008", label: "per credit", note: "pay-as-you-go" },
];

const verbs = [
	{
		id: "search",
		name: "Search",
		endpoint: "POST /search",
		job: "Ask a question, get ranked links with the most relevant snippets.",
		when: "You don't know the URL yet.",
		measured: "0.28–2.8 s by depth",
	},
	{
		id: "extract",
		name: "Extract",
		endpoint: "POST /extract",
		job: "Give URLs, get clean markdown back. Failed URLs are free.",
		when: "You have the URL and need the content.",
		measured: "2 pages in 0.32 s, 1 credit",
	},
	{
		id: "map-crawl",
		name: "Map & Crawl",
		endpoint: "POST /map · /crawl",
		job: "List every page on a site, or walk it and read each page.",
		when: "The answer is spread across a whole site.",
		measured: "5 doc pages crawled in 0.75 s",
	},
	{
		id: "research",
		name: "Research",
		endpoint: "POST /research",
		job: "An agent searches, reads and writes a cited report, as text or your JSON schema.",
		when: "You want a decision-ready answer, not links.",
		measured: "mini: 43 s, 32 credits",
	},
];

const flow = [
	{ q: "Sources unknown", a: "Search" },
	{ q: "URL known", a: "Extract" },
	{ q: "Need a site's structure", a: "Map" },
	{ q: "Need many pages of one site", a: "Crawl" },
	{ q: "Need a cited answer", a: "Research" },
];

type Depth = "ultra-fast" | "fast" | "basic" | "advanced";
const depths: Record<
	Depth,
	{
		latency: string;
		credits: number;
		content: string;
		top: string;
		use: string;
		caveat?: string;
	}
> = {
	"ultra-fast": {
		latency: "0.28 s",
		credits: 1,
		content: "One NLP summary per URL",
		top: "askai.glarity.app (an AI answer aggregator)",
		use: "Voice agents and autocomplete, where latency matters more than ranking.",
		caveat: "Top hit in our test was a low-quality aggregator page.",
	},
	fast: {
		latency: "0.57 s",
		credits: 1,
		content: "Reranked chunks per URL",
		top: "askai.glarity.app",
		use: "Interactive agents that still want chunked evidence.",
	},
	basic: {
		latency: "1.3 s",
		credits: 1,
		content: "Reranked chunks per URL (since Jul 2026)",
		top: "github.com/langchain-ai/langgraph/releases",
		use: "The default. Good ranking at 1 credit.",
	},
	advanced: {
		latency: "2.8 s",
		credits: 2,
		content: "Longer chunks (≈800 chars), broadest coverage",
		top: "langchain.com/blog/langchain-langgraph-1dot0",
		use: "Tavily's recommended default for agents that need precise evidence.",
		caveat: "Costs 2 credits. auto_parameters can switch to it silently.",
	},
};

const knobs = [
	["Time window", "time_range day/week/month/year, or start_date / end_date."],
	["Freshness", "max_age_hours: 0 = always fetch live, 1–720 = max cache age."],
	["Topic", "general, news or finance."],
	["Domains", 'include_domains (≤300) with mode "prefer" or "restrict".'],
	["Language", "language boosts; filter_by_language drops the rest."],
	["Country", "country boosts results from one country."],
	["Exact phrase", 'exact_match keeps only results containing "quoted" text.'],
	["Extras", "include_answer, raw_content, images, favicon, published_date."],
];

const extractResults = [
	{
		label: "2 URLs + query",
		value: "0.32 s",
		body: "Rate-limits doc and a GitHub releases page. With query set, only the matching chunks came back (≈2k chars each).",
	},
	{
		label: "Cost",
		value: "1 credit",
		body: "Billed per 5 successful URLs. advanced depth doubles it and also captures tables and embedded content.",
	},
	{
		label: "Keyless",
		value: "free",
		body: "Send X-Tavily-Access-Mode: keyless and Search and Extract work without an account, rate-limited.",
	},
];

const crawlParams = [
	["max_depth", "How many link hops from the start URL (default 1)."],
	["max_breadth", "Links followed per page (default 20)."],
	["limit", "Total pages before stopping (default 50)."],
	["select_paths", "Regex allowlist, e.g. /docs/.*"],
	["exclude_paths", "Regex blocklist, e.g. /blog/.*"],
	["instructions", "Plain-English focus. Doubles the mapping cost."],
];

const researchParams = [
	["model", "mini for narrow questions, pro for multi-angle topics, auto."],
	["output_schema", "A JSON Schema; the report comes back as that object."],
	["files", "Up to 5 .txt / .md / .json files used as sources and cited."],
	["citation_format", "numbered, mla, apa or chicago."],
	["output_length", "short, standard or long."],
	["stream", "Server-sent events with live progress instead of polling."],
];

const endpoints = [
	["GET /usage", "Credits left. Limited to 10 calls per 10 minutes."],
	["POST /logs", "Per-request logs by date, endpoint and key. Paid plans."],
	["POST /feedback", "Tell Tavily which results you used. Free, beta."],
	["Enterprise", "Generate or deactivate keys in bulk; org-wide usage."],
	["X-Session-Id", "Header that groups calls from one conversation."],
	["X-Human-Id", "Header that tags the end user behind a shared key."],
];

const snippets: Record<string, { label: string; code: string }> = {
	curl: {
		label: "curl",
		code: `curl https://api.tavily.com/search \\
  -H "Authorization: Bearer $TAVILY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "LangGraph latest release",
    "search_depth": "advanced",
    "chunks_per_source": 3,
    "max_results": 5
  }'`,
	},
	python: {
		label: "Python",
		code: `# uv pip install tavily-python
from tavily import TavilyClient

client = TavilyClient()  # reads TAVILY_API_KEY
hits = client.search("LangGraph latest release", search_depth="advanced")
pages = client.extract(["https://docs.tavily.com/documentation/rate-limits"])
site = client.crawl("https://docs.tavily.com", limit=20,
                    select_paths=["/documentation/.*"])`,
	},
	research: {
		label: "Research",
		code: `curl https://api.tavily.com/research \\
  -H "Authorization: Bearer $TAVILY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": "What changed in LangGraph releases in 2026?",
    "model": "mini",
    "output_length": "short"
  }'
# then poll: GET https://api.tavily.com/research/{request_id}`,
	},
	keyless: {
		label: "No key",
		code: `curl https://api.tavily.com/search \\
  -H "Content-Type: application/json" \\
  -H "X-Tavily-Access-Mode: keyless" \\
  -d '{"query": "latest AI news", "max_results": 3}'`,
	},
	mcp: {
		label: "Claude Code (MCP)",
		code: `claude mcp add tavily --transport http https://mcp.tavily.com/mcp/

# or the CLI, which also installs skills for Claude Code, Codex, Cursor:
npx @tavily/cli init
tvly search "q1" "q2"        # up to 5 queries in parallel`,
	},
};

const operationCosts = [
	["Search basic / fast / ultra-fast", "1 credit per call"],
	["Search advanced", "2 credits per call"],
	["Extract", "1 credit per 5 URLs (advanced: 2)"],
	["Map", "1 credit per 10 pages (with instructions: 2)"],
	["Crawl", "Map cost + Extract cost"],
	["Research mini / pro", "4–110 / 15–250 credits"],
];

// Price per credit, USD. Source: docs.tavily.com/documentation/api-credits.
const plans = [
	{ name: "Growth", usd: 0.005, note: "100k credits · $500/mo" },
	{ name: "Startup", usd: 0.0058, note: "38k credits · $220/mo" },
	{ name: "Bootstrap", usd: 0.0067, note: "15k credits · $100/mo" },
	{ name: "Project", usd: 0.0075, note: "4k credits · $30/mo" },
	{ name: "Pay as you go", usd: 0.008, note: "after the plan runs out" },
];
const maxPlan = 0.008;

const caveats: { title: string; body: string }[] = [
	{
		title: "Faster depths ranked worse in our test",
		body: "For “LangGraph latest release”, basic put GitHub releases first. fast and ultra-fast both put an AI aggregator page first.",
	},
	{
		title: "auto_parameters can double the price",
		body: "It may switch search_depth to advanced (2 credits). Set search_depth explicitly to keep it at 1.",
	},
	{
		title: "Live fetch can be refused on the free plan",
		body: "Requests with max_age_hours may get HTTP 434 under load. Retry, or drop the parameter to use the cache.",
	},
	{
		title: "Crawl, map and research have their own caps",
		body: "100, 100 and 20 requests per minute on every plan, no matter how high the plan's overall limit is.",
	},
	{
		title: "Map rounds in your favor",
		body: "Mapping docs.tavily.com returned 21 URLs and billed 2 credits, not 3.",
	},
	{
		title: "Through Telem, Tavily fetch failed",
		body: "Telem's tavily reader returned MissingApiKey in our Telem tests. Call Tavily Extract directly instead.",
	},
];

const vsTelem = [
	{
		need: "Everyday search across engines",
		pick: "Telem",
		why: "One call, many engines, same result shape.",
	},
	{
		need: "Read a known URL",
		pick: "Either",
		why: "Telem has a longer fallback chain; Tavily lets you rerank chunks by query.",
	},
	{
		need: "Walk a whole site",
		pick: "Tavily",
		why: "Map and Crawl have no Telem equivalent.",
	},
	{
		need: "Cited report or structured enrichment",
		pick: "Tavily",
		why: "Research with output_schema returns your JSON.",
	},
	{
		need: "Get told when something happens",
		pick: "Telem",
		why: "Monitors. Tavily has no scheduled checks.",
	},
	{
		need: "Fine search filters",
		pick: "Tavily",
		why: "max_age_hours, exact_match, domain prefer mode are first-class here.",
	},
];

/* ------------------------------------------------------------------ page */

function TavilyPage() {
	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
			<div className="mx-auto flex max-w-5xl flex-col gap-24 px-4 py-16 sm:px-6 sm:py-20">
				<Hero />
				<WhichOne />
				<SearchSection />
				<ExtractSection />
				<MapCrawlSection />
				<ResearchSection />
				<CodeSection />
				<PricingSection />
				<VsTelemSection />
				<CaveatsSection />
				<footer className="text-xs text-zinc-600">
					Ripple · sources: docs.tavily.com and our own API calls on Nov 14,
					2026 ·{" "}
					<Link to="/tavily" className="hover:text-zinc-400">
						back to the Tavily overview
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
					Tavily: the web, <span className="text-emerald-400">pre-chewed</span>{" "}
					for your agent.
				</h1>
				<p className="max-w-3xl text-lg leading-relaxed text-zinc-400">
					One API to search the web, read pages, map and crawl whole sites, and
					run a research agent that writes a cited report. Every response is
					clean text an LLM can use directly, not raw HTML.
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

function WhichOne() {
	return (
		<section className="flex flex-col gap-8">
			<SectionTitle kicker="The idea" title="Pick the verb by what you know">
				Tavily's own guide for agents boils down to one question: how much do
				you already know about where the answer lives?
			</SectionTitle>
			<div className="grid grid-cols-1 gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:grid-cols-2 lg:grid-cols-5">
				{flow.map((f, i) => (
					<div
						key={f.a}
						className={`rounded-xl border p-4 ${i === flow.length - 1 ? "border-emerald-500/50 bg-emerald-500/5" : "border-zinc-700"}`}
					>
						<div className="text-xs text-zinc-500">{f.q}</div>
						<div className="mt-1 font-medium">→ {f.a}</div>
					</div>
				))}
			</div>
		</section>
	);
}

function SearchSection() {
	const order = Object.keys(depths) as Depth[];
	const [depth, setDepth] = useState<Depth>("basic");
	const info = depths[depth];

	return (
		<section className="flex flex-col gap-8">
			<SectionTitle
				id="search"
				kicker="1 · Search"
				title="Trade speed for ranking quality"
			>
				<code className="text-zinc-300">search_depth</code> is the main dial.
				Same query, four depths, measured live. Click a depth:
			</SectionTitle>

			<div className="rounded-2xl border border-zinc-800 p-6">
				<div className="flex flex-wrap gap-2" role="tablist">
					{order.map((d) => (
						<button
							key={d}
							type="button"
							role="tab"
							aria-selected={d === depth}
							onClick={() => setDepth(d)}
							className={`rounded-lg px-4 py-2 font-mono text-sm transition-colors ${d === depth ? "bg-emerald-400 text-zinc-950" : "border border-zinc-800 text-zinc-400 hover:text-zinc-100"}`}
						>
							{d}
						</button>
					))}
				</div>
				<div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[2fr_1fr]">
					<div className="flex flex-col gap-3">
						<div>
							<div className="text-xs uppercase tracking-wider text-zinc-500">
								What each result carries
							</div>
							<p className="mt-1 text-sm text-zinc-200">{info.content}</p>
						</div>
						<div>
							<div className="text-xs uppercase tracking-wider text-zinc-500">
								Top result in our test
							</div>
							<p className="mt-1 font-mono text-xs text-zinc-300">{info.top}</p>
						</div>
						<p className="text-sm text-zinc-300">{info.use}</p>
						{info.caveat && (
							<p className="text-sm text-amber-300/90">{info.caveat}</p>
						)}
					</div>
					<div className="rounded-xl bg-zinc-900/60 p-4">
						<div className="text-xs uppercase tracking-wider text-zinc-500">
							Measured latency
						</div>
						<div className="mt-1 text-2xl font-semibold tabular-nums">
							{info.latency}
						</div>
						<div className="mt-3 text-xs uppercase tracking-wider text-zinc-500">
							Cost
						</div>
						<div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-400">
							{info.credits} credit{info.credits > 1 ? "s" : ""}
						</div>
						<div className="mt-1 text-xs text-zinc-500">
							“LangGraph latest release”, 5 results
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
				Tavily's recommended agent defaults:{" "}
				<span className="font-mono text-zinc-400">
					search_depth=advanced · chunks_per_source=3 · max_results=5
				</span>
				, and leave <code>include_answer</code> off unless you want a quick
				answer seed.
			</p>
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

function ParamGrid({ items }: { items: string[][] }) {
	return (
		<dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-2xl border border-zinc-800 p-6 sm:grid-cols-2">
			{items.map(([k, v]) => (
				<div key={k} className="text-sm">
					<dt className="font-mono text-xs text-zinc-300">{k}</dt>
					<dd className="text-xs text-zinc-500">{v}</dd>
				</div>
			))}
		</dl>
	);
}

function ExtractSection() {
	return (
		<section className="flex flex-col gap-8">
			<SectionTitle
				id="extract"
				kicker="2 · Extract"
				title="Read known URLs, keep only what matters"
			>
				Send URLs, get markdown or plain text. Add a{" "}
				<code className="text-zinc-300">query</code> and Tavily returns only the
				chunks relevant to it, which saves tokens on long pages.
			</SectionTitle>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{extractResults.map((r) => (
					<ResultCard key={r.label} {...r} />
				))}
			</div>
		</section>
	);
}

function MapCrawlSection() {
	return (
		<section className="flex flex-col gap-8">
			<SectionTitle
				id="map-crawl"
				kicker="3 · Map & Crawl"
				title="Treat a website like a graph"
			>
				Map walks the links and returns URLs only. Crawl walks the same way and
				reads every page it keeps. Run Map first to see the shape, then Crawl
				just the paths you need.
			</SectionTitle>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<ResultCard
					label="Map docs.tavily.com"
					value="21 URLs · 0.31 s"
					body="limit=30, depth 1. Billed 2 credits."
				/>
				<ResultCard
					label="Crawl /documentation/.*"
					value="5 pages · 0.75 s"
					body="Full markdown per page, 3k to 158k chars. Billed 1 credit."
				/>
			</div>
			<ParamGrid items={crawlParams} />
			<p className="text-sm text-zinc-500">
				Each call is capped at 150 s. Both endpoints are limited to 100 requests
				per minute.
			</p>
		</section>
	);
}

function ResearchSection() {
	return (
		<section className="flex flex-col gap-8">
			<SectionTitle
				id="research"
				kicker="4 · Research"
				title="Hand off the whole question"
			>
				Submit a question, get back a request ID, then poll or stream. A
				research agent plans, searches, reads and writes a report with
				citations. Give it a JSON Schema and the report arrives as data you can
				store.
			</SectionTitle>
			<ol className="grid grid-cols-1 gap-4 md:grid-cols-4">
				{[
					["POST /research", "Send input, model, optional schema and files."],
					["request_id", "Returned at once. The work runs in the background."],
					["GET or stream", "Poll /research/{id}, or set stream=true for SSE."],
					["Report", "Text or your schema, with sources and citations."],
				].map(([t, b], i) => (
					<li
						key={t}
						className={`rounded-xl border p-5 ${i === 3 ? "border-emerald-500/50 bg-emerald-500/5" : "border-zinc-800"}`}
					>
						<div className="font-mono text-xs text-emerald-400">{t}</div>
						<p className="mt-2 text-sm leading-relaxed text-zinc-400">{b}</p>
					</li>
				))}
			</ol>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<ResultCard
					label="Our run · model=mini"
					value="43 s"
					body="“What changed in LangGraph releases in 2026?”, output_length=short."
				/>
				<ResultCard
					label="Cost"
					value="32 credits"
					body="About $0.25 at pay-as-you-go. mini is billed 4–110 credits, pro 15–250."
				/>
				<ResultCard
					label="Output"
					value="2.7k chars · 4 sources"
					body="A short report on LangGraph 1.1 / 1.2 with numbered citations."
				/>
			</div>
			<ParamGrid items={researchParams} />
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
			<SectionTitle kicker="Use it" title="Five ways in">
				REST, the Python or JS SDK, a CLI, or tools inside Claude Code, Codex
				and Cursor through the hosted MCP server. 50+ framework integrations
				wrap the same endpoints.
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
			<ParamGrid items={endpoints} />
		</section>
	);
}

function PricingSection() {
	return (
		<section className="flex flex-col gap-8">
			<SectionTitle kicker="Cost" title="Credits, and what a credit costs">
				Everything is billed in credits. The free Researcher plan gives 1,000 a
				month at 100 requests per minute; paid plans raise that to 1,000–1,500.
			</SectionTitle>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div className="rounded-2xl border border-zinc-800 p-6">
					<div className="text-xs uppercase tracking-wider text-zinc-500">
						Credits per operation
					</div>
					<dl className="mt-3 flex flex-col gap-2">
						{operationCosts.map(([k, v]) => (
							<div
								key={k}
								className="flex justify-between gap-4 border-b border-zinc-900 pb-2 text-sm last:border-0"
							>
								<dt className="text-zinc-300">{k}</dt>
								<dd className="text-right tabular-nums text-zinc-400">{v}</dd>
							</div>
						))}
					</dl>
				</div>
				<div className="flex flex-col gap-2 rounded-2xl border border-zinc-800 p-6">
					<div className="text-xs uppercase tracking-wider text-zinc-500">
						Price per 1,000 credits
					</div>
					{plans.map((p) => (
						<div
							key={p.name}
							className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3 text-sm"
						>
							<span className="text-zinc-300">{p.name}</span>
							<div className="h-2 rounded-full bg-zinc-900">
								<div
									className="h-2 rounded-full bg-emerald-400"
									style={{ width: `${(p.usd / maxPlan) * 100}%` }}
								/>
							</div>
							<span className="text-right tabular-nums text-zinc-200">
								${(p.usd * 1000).toFixed(2)}
							</span>
							<span className="col-span-3 -mt-1 text-xs text-zinc-500">
								{p.note}
							</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

const PICK: Record<string, string> = {
	Telem: "border-sky-500/40 text-sky-200",
	Tavily: "border-emerald-500/40 text-emerald-300",
	Either: "border-zinc-700 text-zinc-300",
};

function VsTelemSection() {
	return (
		<section className="flex flex-col gap-8">
			<SectionTitle kicker="With Telem" title="When to call Tavily directly">
				Tavily is one of the engines behind{" "}
				<Link
					to="/telem"
					className="text-zinc-200 underline-offset-4 hover:underline"
				>
					Telem
				</Link>
				. Route everyday calls through Telem, and come here for what only Tavily
				does.
			</SectionTitle>
			<div className="overflow-x-auto rounded-2xl border border-zinc-800">
				<table className="w-full min-w-[640px] text-left text-sm">
					<thead className="text-xs uppercase tracking-wider text-zinc-500">
						<tr className="border-b border-zinc-800">
							<th className="px-4 py-3 font-medium">You need</th>
							<th className="px-4 py-3 font-medium">Use</th>
							<th className="px-4 py-3 font-medium">Why</th>
						</tr>
					</thead>
					<tbody>
						{vsTelem.map((r) => (
							<tr
								key={r.need}
								className="border-b border-zinc-900 align-top last:border-0"
							>
								<td className="px-4 py-3 font-medium">{r.need}</td>
								<td className="px-4 py-3">
									<span
										className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${PICK[r.pick]}`}
									>
										{r.pick}
									</span>
								</td>
								<td className="px-4 py-3 text-zinc-400">{r.why}</td>
							</tr>
						))}
					</tbody>
				</table>
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
				Found while testing with real calls, plus limits that are easy to miss
				in the docs.
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

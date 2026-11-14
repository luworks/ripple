import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
	type ChartSeries,
	formatPT,
	PriceChart,
	SERIES_COLORS,
	signedPct,
} from "#/components/PriceChart";
import {
	formatEventTime,
	isDateOnly,
	keyNumbers,
	leadAndBench,
	seriesChange,
	stripMoves,
	windowRequest,
} from "#/components/research-numbers";
import {
	getPrices,
	listShowcaseRuns,
	startResearchRun,
} from "#/server/research";
import {
	BUDGETS,
	type Budget,
	budgetLabel,
	DEFAULT_BUDGET,
	toBudget,
} from "#/server/research-budget";
import type { RunSummary } from "#/server/research-db";
import type { PriceSeries, ResearchResult } from "#/server/research-types";

export const Route = createFileRoute("/research/")({
	head: () => ({ meta: [{ title: "Event research · Ripple" }] }),
	loader: async () => {
		const runs = await listShowcaseRuns({ data: { ids: SHOWCASE } });
		const featured = pickFeatured(runs);
		const fetchFor = (r: ResearchResult, symbols: string[]) =>
			getPrices({ data: windowRequest(r, symbols) }).catch(
				() => [] as PriceSeries[],
			);
		const prices = featured?.result
			? await fetchFor(featured.result, featuredSymbols(featured.result))
			: [];
		// Cards show the same lead-vs-benchmark numbers as the run page, from the same window.
		const cards = await Promise.all(
			pickOthers(runs, featured).map(async (r) => {
				const res = r.result as ResearchResult;
				const { lead, bench } = leadAndBench(res);
				const series = await fetchFor(
					res,
					[lead, bench].filter((s): s is string => !!s),
				);
				return [r.id, series] as const;
			}),
		);
		return {
			runs,
			featuredId: featured?.id ?? null,
			prices,
			cardPrices: Object.fromEntries(cards),
		};
	},
	component: ResearchHome,
});

// Starter questions, one per kind of question the agent answers well. Each is a real event
// with an earlier run, so memory makes it fast and reliable in a live demo.
const examples = [
	{
		kind: "Price reaction",
		q: "How did NVDA react when Jensen Huang resigned as CEO?",
	},
	{ kind: "Earnings", q: "Apple stock after the Q4 fiscal 2026 earnings call" },
	{ kind: "Deal", q: "AMD stock reaction to the OpenAI MI450 deal" },
	{
		kind: "Supply chain",
		q: "Apple iPhone 18 demand warning: which supplier stocks fell?",
	},
	{ kind: "Leadership · 中文", q: "苹果 CEO 库克卸任对苹果股价的影响" },
	{ kind: "Deliveries · 中文", q: "小米汽车最新交付量，股价怎么反应？" },
];

const BUDGET_KEY = "brain0.research.budget";
const BUDGET_HINT: Record<Budget, string> = {
	30: "quick: one search, key tickers",
	60: "standard: a few searches",
	120: "deep: the full method",
	240: "deep, with room for slow sources",
};

const FEATURED = /jensen|黄仁勋/i;
// Finished runs shown here: an allowlist, because test and batch runs keep arriving. Each one
// ran on the Telem-first agent (#32), searched only with Telem (no Tavily), cites at least one
// social post, finished within ~90 s, and has a Telem trace. The Jensen run is featured.
// Dropped: runs whose prose contradicts the chart-window move (Apple Q4 "negative" vs AAPL up;
// Cook succession "weaker than SPY" vs AAPL ahead of SPY).
const SHOWCASE = [
	"ee623f94-7d7f-49ef-b3f2-675c8915f8ad", // Jensen Huang resigns — NVDA and AI chips
	"1d0b4e81-9313-4255-80d3-5cb5d2f510c7", // 台积电 11 月营收
	"ed1d1e82-e525-4616-b8d4-9bf8d714ad42", // AMD MI450 OpenAI deal
	"02897ba9-6649-46ed-adb6-c8b02ee34541", // Apple iPhone 18 demand warning
	"8d456a8d-25f8-4d5a-b34d-4af2df4ef89e", // Tesla robotaxi expansion
	"f646a134-3762-4021-98ac-087b1cfe28e1", // 小米汽车交付量
	"9bcc6b90-1e66-487c-95d9-7a94150ddfeb", // 腾讯 2026 Q3 财报
];

// Date-only items carry T00:00:00Z; they can't be placed on an intraday chart.
const precise = (t: { time: string }) => !isDateOnly(t.time);

// Feature the event the site was built around, picking the run whose timeline has the most
// distinct minute-precise timestamps; else the best recent run.
function pickFeatured(runs: RunSummary[]) {
	const done = runs.filter((r) => r.status === "done" && r.result);
	const score = (r: RunSummary) =>
		new Set(r.result?.timeline.filter(precise).map((t) => t.time)).size;
	const pool = done.some((r) => FEATURED.test(r.query))
		? done.filter((r) => FEATURED.test(r.query))
		: done.slice(0, 5);
	return pool.sort((a, b) => score(b) - score(a))[0];
}

// One card per event: skip the featured event and repeat runs of the same query.
function pickOthers(runs: RunSummary[], featured: RunSummary | undefined) {
	const seen = new Set<string>();
	return runs.filter((r) => {
		if (r.status !== "done" || !r.result || r.id === featured?.id) return false;
		const key = r.query.toLowerCase().trim();
		if (seen.has(key)) return false;
		if (featured && FEATURED.test(r.query) && FEATURED.test(featured.query))
			return false;
		seen.add(key);
		return true;
	});
}

function featuredSymbols(r: ResearchResult) {
	const { lead, bench } = leadAndBench(r);
	const direct = r.tickers
		.filter((t) => t.relation === "direct")
		.map((t) => t.symbol.toUpperCase());
	return [
		...new Set(
			[
				lead,
				...direct.slice(0, 2),
				bench,
				...r.market.benchmarks.map((b) => b.toUpperCase()),
			].filter((s): s is string => !!s),
		),
	].slice(0, 5);
}

const STATUS: Record<string, string> = {
	running: "text-amber-300 border-amber-500/40",
	done: "text-emerald-300 border-emerald-500/40",
	error: "text-rose-300 border-rose-500/40",
};

function ResearchHome() {
	const { runs, featuredId, prices, cardPrices } = Route.useLoaderData();
	const done = runs.filter((r) => r.status === "done" && r.result);
	const pending = runs.filter((r) => r.status === "running");
	const featured = done.find((r) => r.id === featuredId);
	const others = pickOthers(runs, featured);
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [budget, setBudget] = useState<Budget>(DEFAULT_BUDGET);
	// Remember the choice per browser (a live demo sets 30s once). After mount, so SSR matches.
	useEffect(() => {
		try {
			const saved = localStorage.getItem(BUDGET_KEY);
			if (saved) setBudget(toBudget(saved));
		} catch {}
	}, []);
	const pickBudget = (b: Budget) => {
		setBudget(b);
		try {
			localStorage.setItem(BUDGET_KEY, String(b));
		} catch {}
	};

	async function submit(q: string) {
		const text = q.trim();
		if (!text || busy) return;
		setBusy(true);
		setError(null);
		try {
			const r = await startResearchRun({ data: { query: text, budget } });
			if (r.ok) navigate({ to: "/research/$id", params: { id: r.id } });
			else setError(r.error);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
			<div className="mx-auto flex max-w-5xl flex-col gap-14 px-4 py-16 sm:px-6 sm:py-20">
				<section className="flex flex-col gap-5">
					<span className="w-fit rounded-full border border-zinc-800 px-3 py-1 text-xs tracking-wide text-zinc-400">
						Event research · agent
					</span>
					<h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
						What moved the market?
					</h1>
					<p className="max-w-xl text-lg leading-relaxed text-zinc-400">
						Describe an event. A research agent finds the people, related
						tickers and a timestamped news timeline, then we overlay it on real
						price data. You choose how long it searches.
					</p>
					<form
						className="flex flex-col gap-3 sm:flex-row"
						onSubmit={(e) => {
							e.preventDefault();
							submit(query);
						}}
					>
						<input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							maxLength={300}
							placeholder="e.g. Jensen Huang resigns as Nvidia CEO"
							className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-base outline-none placeholder:text-zinc-600 focus:border-emerald-400/60"
						/>
						<button
							type="submit"
							disabled={busy || !query.trim()}
							className="rounded-xl bg-emerald-400 px-5 py-3 font-medium text-zinc-950 transition-colors hover:bg-emerald-300 disabled:opacity-40"
						>
							{busy ? "Starting…" : "Research"}
						</button>
					</form>
					<div
						role="radiogroup"
						aria-labelledby="budget-label"
						className="flex flex-wrap items-center gap-2 text-sm"
					>
						<span id="budget-label" className="text-zinc-500">
							Search time
						</span>
						{BUDGETS.map((b) => (
							<label
								key={b}
								className={`cursor-pointer rounded-lg border px-3 py-1 font-mono transition-colors has-focus-visible:ring-2 has-focus-visible:ring-emerald-400/60 ${
									b === budget
										? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
										: "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
								}`}
							>
								<input
									type="radio"
									name="budget"
									value={b}
									checked={b === budget}
									onChange={() => pickBudget(b)}
									className="sr-only"
								/>
								{budgetLabel(b)}
							</label>
						))}
						<span className="text-xs text-zinc-600">{BUDGET_HINT[budget]}</span>
					</div>
					{error && (
						<p className="rounded-lg border border-rose-500/40 px-4 py-2 text-sm text-rose-300">
							{error}
						</p>
					)}
					<div className="flex flex-col gap-3">
						<p className="text-sm text-zinc-500">
							Ask about one event: name the company, person or announcement and
							what you want to know. English or Chinese. Try one:
						</p>
						<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{examples.map(({ kind, q }) => (
								<button
									key={q}
									type="button"
									disabled={busy}
									onClick={() => {
										setQuery(q);
										submit(q);
									}}
									className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-left transition-colors hover:border-emerald-400/50 hover:bg-zinc-900/60 disabled:opacity-50"
								>
									<span className="text-xs uppercase tracking-wider text-emerald-400/80">
										{kind}
									</span>
									<span className="text-sm leading-snug text-zinc-200">
										{q}
									</span>
								</button>
							))}
						</div>
					</div>
				</section>

				{featured?.result && (
					<Featured run={featured} r={featured.result} prices={prices} />
				)}
				<HowItWorks runs={done} />
				{others.length > 0 && (
					<section>
						<h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-400">
							More events researched live
						</h2>
						<div className="grid gap-4 sm:grid-cols-2">
							{others.map((run) => (
								<RunCard
									key={run.id}
									run={run}
									prices={cardPrices[run.id] ?? []}
								/>
							))}
						</div>
					</section>
				)}
				{pending.length > 0 && (
					<section>
						<h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-400">
							Running now
						</h2>
						<ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
							{pending.map((r) => (
								<li key={r.id}>
									<Link
										to="/research/$id"
										params={{ id: r.id }}
										className="flex items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-zinc-900/60"
									>
										<span className="min-w-0 flex-1 truncate">{r.query}</span>
										<span
											className={`rounded-full border px-2 py-0.5 text-xs ${STATUS[r.status]}`}
										>
											{r.status}
										</span>
									</Link>
								</li>
							))}
						</ul>
					</section>
				)}
			</div>
		</main>
	);
}

type Result = ResearchResult;

const pctClass = (v: number | null) =>
	v == null ? "text-zinc-500" : v < 0 ? "text-rose-400" : "text-emerald-400";

function Stat({
	label,
	value,
	note,
	cls = "text-zinc-100",
}: {
	label: string;
	value: string;
	note?: string;
	cls?: string;
}) {
	return (
		<div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
			<div className="text-xs uppercase tracking-wider text-zinc-500">
				{label}
			</div>
			<div className={`mt-1 font-mono text-2xl font-semibold ${cls}`}>
				{value}
			</div>
			{note && <div className="mt-0.5 text-xs text-zinc-500">{note}</div>}
		</div>
	);
}

function Featured({
	run,
	r,
	prices,
}: {
	run: RunSummary;
	r: Result;
	prices: PriceSeries[];
}) {
	const symbols = featuredSymbols(r);
	const lines: ChartSeries[] = symbols.flatMap((s, i) => {
		const series = prices.find((p) => p.symbol === s);
		return series?.points.length
			? [{ symbol: s, color: SERIES_COLORS[i % SERIES_COLORS.length], series }]
			: [];
	});
	const timeline = [...r.timeline].sort((a, b) => a.time.localeCompare(b.time));
	const exact = timeline.filter(precise);
	const highlights = (exact.length >= 3 ? exact : timeline).slice(0, 5);
	const change = (l: ChartSeries) => seriesChange(l.series);
	// Stat tiles use the same Yahoo series as the chart, so the numbers always agree with it.
	const h = keyNumbers(r, prices);
	const impact = stripMoves(r.impact_summary);

	return (
		<section className="flex flex-col gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 sm:p-7">
			<div className="flex flex-col gap-2">
				<span className="w-fit rounded-full border border-emerald-500/40 px-3 py-1 text-xs text-emerald-300">
					Live example · researched by the agent in{" "}
					{run.durationMs != null ? Math.round(run.durationMs / 1000) : "?"}s
				</span>
				<h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
					{r.event.title}
				</h2>
				<p className="max-w-3xl leading-relaxed text-zinc-400">
					{r.event.summary}
				</p>
			</div>
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Stat
					label={h.lead ?? "Lead ticker"}
					value={h.leadPct != null ? signedPct(h.leadPct) : "—"}
					note="chart window, Yahoo prices"
					cls={pctClass(h.leadPct)}
				/>
				<Stat
					label={`vs ${h.bench}`}
					value={h.excess != null ? signedPct(h.excess) : "—"}
					note={
						h.benchPct != null
							? `${h.bench} ${signedPct(h.benchPct)}`
							: undefined
					}
					cls={pctClass(h.excess)}
				/>
				<Stat
					label="Tickers linked"
					value={String(r.tickers.length)}
					note={r.tickers
						.slice(0, 4)
						.map((t) => t.symbol)
						.join(" · ")}
				/>
				<Stat
					label="Timestamped sources"
					value={String(r.timeline.length)}
					note={`${r.people.length} people identified`}
				/>
			</div>
			<div>
				{lines.length ? (
					<>
						<div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-sm">
							{lines.map((l) => {
								const c = change(l);
								return (
									<span key={l.symbol} className="flex items-center gap-2">
										<span
											className="h-0.5 w-4 rounded"
											style={{ background: l.color }}
										/>
										<span className="text-zinc-300">{l.symbol}</span>
										{c != null && (
											<span className={pctClass(c)}>{signedPct(c)}</span>
										)}
									</span>
								);
							})}
						</div>
						<PriceChart lines={lines} markers={timeline} />
					</>
				) : (
					<div className="flex h-[340px] items-center justify-center rounded-xl border border-zinc-800 text-sm text-zinc-500">
						No price data for this window.
					</div>
				)}
			</div>
			<div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
				<ol className="flex flex-col gap-3">
					{highlights.map((t) => (
						<li key={t.url + t.time} className="flex gap-3 text-sm">
							<span className="w-32 shrink-0 font-mono text-xs leading-5 text-zinc-500">
								{formatEventTime(t.time)}
							</span>
							<a
								href={t.url}
								target="_blank"
								rel="noreferrer"
								className="text-zinc-300 hover:text-emerald-300"
							>
								{t.headline}
								<span className="ml-2 text-xs text-zinc-600">{t.source}</span>
							</a>
						</li>
					))}
				</ol>
				<p className="text-sm leading-relaxed text-zinc-400">
					<span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
						Impact
					</span>
					{impact}
				</p>
			</div>
			<Link
				to="/research/$id"
				params={{ id: run.id }}
				className="w-fit rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-emerald-400/60 hover:text-emerald-300"
			>
				Open the full analysis: people, all tickers, every source →
			</Link>
		</section>
	);
}

function RunCard({ run, prices }: { run: RunSummary; prices: PriceSeries[] }) {
	const r = run.result as Result;
	const h = keyNumbers(r, prices);
	return (
		<Link
			to="/research/$id"
			params={{ id: run.id }}
			className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 transition-colors hover:border-zinc-600"
		>
			<div className="flex items-start justify-between gap-3">
				<h3 className="font-medium leading-snug">{r.event.title}</h3>
				{h.leadPct != null && (
					<span className="shrink-0 text-right font-mono">
						<span className="block text-xs text-zinc-500">{h.lead}</span>
						<span className={`text-lg font-semibold ${pctClass(h.leadPct)}`}>
							{signedPct(h.leadPct)}
						</span>
					</span>
				)}
			</div>
			<p className="line-clamp-3 text-sm leading-relaxed text-zinc-400">
				{stripMoves(r.impact_summary) || r.event.summary}
			</p>
			<div className="flex flex-wrap gap-1.5">
				{r.tickers.slice(0, 6).map((t) => (
					<span
						key={t.symbol}
						className="rounded-md border border-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-400"
					>
						{t.symbol}
					</span>
				))}
			</div>
			<div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-zinc-500">
				{h.excess != null && (
					<span className={pctClass(h.excess)}>
						{signedPct(h.excess)} vs {h.bench}
					</span>
				)}
				<span>{r.timeline.length} sources</span>
				{run.durationMs != null && (
					<span>{Math.round(run.durationMs / 1000)}s agent time</span>
				)}
				<span>{formatPT(run.createdAt)}</span>
			</div>
		</Link>
	);
}

const STEPS = [
	{ k: "1", t: "Your question", d: "Any event, in English or Chinese" },
	{
		k: "2",
		t: "Codex CLI in Docker",
		d: "Fresh sandboxed container per query",
	},
	{
		k: "3",
		t: "Telem · Tavily · Market MCPs",
		d: "11 search engines, news, live prices",
	},
	{
		k: "4",
		t: "Structured answer",
		d: "People, tickers, timeline, price reaction",
	},
];

function HowItWorks({ runs }: { runs: RunSummary[] }) {
	const secs = runs
		.map((r) => r.durationMs)
		.filter((d): d is number => d != null)
		.sort((a, b) => a - b);
	const median = secs.length
		? Math.round(secs[Math.floor(secs.length / 2)] / 1000)
		: null;
	const sources = runs.reduce(
		(n, r) => n + (r.result?.timeline.length ?? 0),
		0,
	);
	return (
		<section className="flex flex-col gap-4">
			<h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
				How it works
			</h2>
			<ol className="grid gap-3 sm:grid-cols-4">
				{STEPS.map((s) => (
					<li
						key={s.k}
						className="rounded-xl border border-zinc-800 px-4 py-3 text-sm"
					>
						<span className="font-mono text-emerald-400">{s.k}</span>
						<span className="ml-2 font-medium text-zinc-200">{s.t}</span>
						<span className="mt-1 block text-zinc-500">{s.d}</span>
					</li>
				))}
			</ol>
			{runs.length > 0 && (
				<p className="font-mono text-xs text-zinc-500">
					{runs.length} events researched · {sources} timestamped sources ·
					median {median}s per run · chart prices fetched from Yahoo Finance,
					never generated by the model
				</p>
			)}
		</section>
	);
}

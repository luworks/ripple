import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
	type ChartSeries,
	formatPT,
	PriceChart,
	SERIES_COLORS,
	signedPct,
} from "#/components/PriceChart";
import {
	getPrices,
	listResearchRuns,
	startResearchRun,
} from "#/server/research";
import type { RunSummary } from "#/server/research-db";
import type { PriceSeries, ResearchResult } from "#/server/research-types";

export const Route = createFileRoute("/research/")({
	head: () => ({ meta: [{ title: "Event research · Ripple" }] }),
	loader: async () => {
		const runs = await listResearchRuns();
		const featured = pickFeatured(runs);
		const prices = featured?.result
			? await getPrices({ data: priceRequest(featured.result) }).catch(
					() => [] as PriceSeries[],
				)
			: [];
		return { runs, featuredId: featured?.id ?? null, prices };
	},
	component: ResearchHome,
});

const examples = [
	"Jensen Huang resigns as Nvidia CEO",
	"TSMC halts shipments to a major customer",
	"OpenAI announces IPO filing",
	"Apple misses iPhone sales estimates",
];

const FEATURED = /jensen|黄仁勋/i;

// Date-only items carry T00:00:00Z; they can't be placed on an intraday chart.
const precise = (t: { time: string }) => !t.time.includes("T00:00:00");

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

function featuredSymbols(r: ResearchResult) {
	const direct = r.tickers
		.filter((t) => t.relation === "direct")
		.map((t) => t.symbol.toUpperCase());
	return [
		...new Set([
			...direct.slice(0, 2),
			...r.market.benchmarks.map((b) => b.toUpperCase()),
		]),
	].slice(0, 5);
}

function priceRequest(r: ResearchResult) {
	return {
		symbols: featuredSymbols(r),
		start: r.market.window_start,
		end: r.market.window_end,
		interval: r.market.interval,
	};
}

const STATUS: Record<string, string> = {
	running: "text-amber-300 border-amber-500/40",
	done: "text-emerald-300 border-emerald-500/40",
	error: "text-rose-300 border-rose-500/40",
};

function ResearchHome() {
	const { runs, featuredId, prices } = Route.useLoaderData();
	const done = runs.filter((r) => r.status === "done" && r.result);
	const pending = runs.filter((r) => r.status === "running");
	const featured = done.find((r) => r.id === featuredId);
	// One card per event: skip the featured event and repeat runs of the same query.
	const seen = new Set<string>();
	const others = done.filter((r) => {
		const key = r.query.toLowerCase().trim();
		if (r === featured || seen.has(key)) return false;
		if (featured && FEATURED.test(r.query) && FEATURED.test(featured.query))
			return false;
		seen.add(key);
		return true;
	});
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(q: string) {
		const text = q.trim();
		if (!text || busy) return;
		setBusy(true);
		setError(null);
		try {
			const r = await startResearchRun({ data: { query: text } });
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
						price data. Takes 1–3 minutes.
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
					{error && (
						<p className="rounded-lg border border-rose-500/40 px-4 py-2 text-sm text-rose-300">
							{error}
						</p>
					)}
					<div className="flex flex-wrap gap-2">
						{examples.map((q) => (
							<button
								key={q}
								type="button"
								disabled={busy}
								onClick={() => {
									setQuery(q);
									submit(q);
								}}
								className="rounded-full border border-zinc-800 px-3 py-1 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
							>
								{q}
							</button>
						))}
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
								<RunCard key={run.id} run={run} />
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

// Headline numbers from the agent's market-tool observations: lead ticker vs its benchmark.
function headline(r: Result) {
	const obs = new Map(
		r.market.observations.map((o) => [o.symbol.toUpperCase(), o.change_pct]),
	);
	const lead =
		r.tickers.find(
			(t) => t.relation === "direct" && obs.get(t.symbol.toUpperCase()) != null,
		) ?? r.tickers.find((t) => obs.get(t.symbol.toUpperCase()) != null);
	const benchSym =
		["SPY", ...r.market.benchmarks].find(
			(b) => obs.get(b.toUpperCase()) != null,
		) ?? null;
	const leadPct = lead ? (obs.get(lead.symbol.toUpperCase()) ?? null) : null;
	const benchPct = benchSym ? (obs.get(benchSym.toUpperCase()) ?? null) : null;
	return {
		lead: lead?.symbol ?? null,
		leadPct,
		benchSym,
		benchPct,
		excess: leadPct != null && benchPct != null ? leadPct - benchPct : null,
	};
}

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
	const change = (l: ChartSeries) => {
		const p = l.series.points;
		return p.length > 1 ? (p[p.length - 1].c / p[0].c - 1) * 100 : null;
	};
	// Stat tiles use the same Yahoo series as the chart, so the numbers always agree with it.
	const chartPct = (sym: string | null) => {
		const l = lines.find((x) => x.symbol === sym?.toUpperCase());
		return l ? change(l) : null;
	};
	const agent = headline(r);
	const leadPct = chartPct(agent.lead);
	const benchSym =
		["SPY", ...r.market.benchmarks].find((b) => chartPct(b) != null) ?? null;
	const benchPct = chartPct(benchSym);
	const h = {
		lead: agent.lead,
		leadPct,
		benchSym,
		benchPct,
		excess: leadPct != null && benchPct != null ? leadPct - benchPct : null,
	};

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
					label={`vs ${h.benchSym ?? "benchmark"}`}
					value={h.excess != null ? signedPct(h.excess) : "—"}
					note={
						h.benchPct != null
							? `${h.benchSym} ${signedPct(h.benchPct)}`
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
								{formatPT(t.time)}
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
					{r.impact_summary}
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

function RunCard({ run }: { run: RunSummary }) {
	const r = run.result as Result;
	const h = headline(r);
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
				{r.impact_summary || r.event.summary}
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
						{signedPct(h.excess)} vs {h.benchSym}
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

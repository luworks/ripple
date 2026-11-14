import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	type ChartSeries,
	formatPT,
	PriceChart,
	SERIES_COLORS,
	signedPct,
} from "#/components/PriceChart";
import {
	formatEventTime,
	keyNumbers,
	seriesChange,
	stripMoves,
} from "#/components/research-numbers";
import { TelemTrace } from "#/components/TelemTrace";
import { getPrices, getResearchRun } from "#/server/research";
import type {
	AgentEvent,
	PriceSeries,
	ResearchResult,
	TickerRelation,
} from "#/server/research-types";

export const Route = createFileRoute("/research/$id")({
	loader: ({ params }) => getResearchRun({ data: { id: params.id } }),
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `${loaderData?.result?.event.title ?? loaderData?.query ?? "Research"} · Ripple`,
			},
		],
	}),
	component: ResearchRun,
});

type State =
	| { phase: "running" }
	| { phase: "done"; result: ResearchResult; durationMs: number | null }
	| { phase: "error"; error: string };

function ResearchRun() {
	const run = Route.useLoaderData();
	const { id } = Route.useParams();
	const [events, setEvents] = useState<AgentEvent[]>(run?.events ?? []);
	const [state, setState] = useState<State>(() =>
		!run
			? { phase: "error", error: "Run not found" }
			: run.status === "done" && run.result
				? { phase: "done", result: run.result, durationMs: run.durationMs }
				: run.status === "error"
					? { phase: "error", error: run.error ?? "Run failed" }
					: { phase: "running" },
	);
	const [startedAt] = useState(() =>
		run ? Date.parse(run.createdAt) : Date.now(),
	);

	useEffect(() => {
		if (state.phase !== "running") return;
		const es = new EventSource(`/api/research/${id}/events`);
		const seen = new Set<string>();
		setEvents([]);
		es.addEventListener("progress", (e) => {
			const ev = JSON.parse((e as MessageEvent).data) as AgentEvent;
			const k = `${ev.at}|${ev.text}`;
			if (seen.has(k)) return;
			seen.add(k);
			setEvents((prev) => [...prev, ev]);
		});
		es.addEventListener("done", (e) => {
			const d = JSON.parse((e as MessageEvent).data);
			setState({ phase: "done", result: d.result, durationMs: d.durationMs });
			es.close();
		});
		es.addEventListener("error", (e) => {
			const data = (e as MessageEvent).data;
			if (typeof data === "string") {
				setState({ phase: "error", error: JSON.parse(data).error });
				es.close();
			}
			// Without data it's a transport error; EventSource reconnects on its own.
		});
		return () => es.close();
	}, [id, state.phase]);

	if (!run)
		return (
			<Shell>
				<p className="text-zinc-400">
					Run not found.{" "}
					<Link to="/research" className="text-emerald-400">
						Start a new one
					</Link>
				</p>
			</Shell>
		);

	return (
		<Shell>
			<div className="flex flex-col gap-3">
				<Link
					to="/research"
					className="text-sm text-zinc-500 hover:text-zinc-300"
				>
					← All research
				</Link>
				<span className="w-fit rounded-full border border-zinc-800 px-3 py-1 text-xs tracking-wide text-zinc-400">
					Query · {formatPT(run.createdAt)}
				</span>
				<p className="text-lg text-zinc-300">“{run.query}”</p>
			</div>
			{state.phase === "done" ? (
				<ResultView
					result={state.result}
					durationMs={state.durationMs}
					events={events}
				/>
			) : (
				<Progress events={events} state={state} startedAt={startedAt} />
			)}
		</Shell>
	);
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
			<div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-12 sm:px-6 sm:py-16">
				{children}
			</div>
		</main>
	);
}

function Progress({
	events,
	state,
	startedAt,
}: {
	events: AgentEvent[];
	state: State;
	startedAt: number;
}) {
	const [now, setNow] = useState(startedAt);
	const log = useRef<HTMLOListElement>(null);
	useEffect(() => {
		setNow(Date.now());
		const t = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(t);
	}, []);
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll the log on each new event
	useEffect(() => {
		const el = log.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [events.length]);
	const secs = Math.max(0, Math.round((now - startedAt) / 1000));
	return (
		<section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
			<div className="flex items-center justify-between gap-4">
				<h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
					Agent progress
				</h2>
				{state.phase === "error" ? (
					<span className="text-sm text-rose-400">Failed</span>
				) : (
					<span className="flex items-center gap-2 text-sm text-amber-300">
						<span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" />
						Researching · {secs}s
					</span>
				)}
			</div>
			{state.phase === "error" && (
				<p className="mt-4 break-words rounded-lg border border-rose-500/40 px-4 py-2 font-mono text-sm text-rose-300">
					{state.error}
				</p>
			)}
			<ol
				ref={log}
				className="mt-5 flex max-h-96 flex-col gap-1.5 overflow-y-auto font-mono text-sm"
			>
				{events.map((e) => (
					<li key={`${e.at}|${e.text}`} className="flex gap-3">
						<span className="shrink-0 text-zinc-600">
							{new Date(e.at).toLocaleTimeString("en-US", {
								timeZone: "America/Los_Angeles",
								hour12: false,
							})}
						</span>
						<span
							className={
								e.kind === "error"
									? "text-rose-300"
									: e.kind === "tool"
										? "text-sky-300"
										: e.kind === "status"
											? "text-zinc-400"
											: "text-zinc-200"
							}
						>
							{e.text}
						</span>
					</li>
				))}
				{events.length === 0 && state.phase === "running" && (
					<li className="text-zinc-600">Connecting…</li>
				)}
			</ol>
		</section>
	);
}

const RELATION_ORDER: TickerRelation[] = [
	"direct",
	"supplier",
	"customer",
	"competitor",
	"partner",
	"etf",
	"other",
];
const RELATION_LABEL: Record<TickerRelation, string> = {
	direct: "Directly affected",
	supplier: "Suppliers",
	customer: "Customers",
	competitor: "Competitors",
	partner: "Partners",
	etf: "ETFs",
	other: "Other",
};

function ResultView({
	result: r,
	durationMs,
	events,
}: {
	result: ResearchResult;
	durationMs: number | null;
	events: AgentEvent[];
}) {
	// Every symbol gets a fixed color by its position in this list (tickers, then benchmarks).
	const symbols = useMemo(
		() => [
			...new Set(
				[...r.tickers.map((t) => t.symbol), ...r.market.benchmarks].map((s) =>
					s.toUpperCase(),
				),
			),
		],
		[r],
	);
	const colorOf = (s: string) =>
		SERIES_COLORS[symbols.indexOf(s.toUpperCase()) % SERIES_COLORS.length];
	const defaultOn = useMemo(() => {
		const on = new Set(
			r.tickers
				.filter((t) => t.relation === "direct")
				.map((t) => t.symbol.toUpperCase()),
		);
		for (const b of r.market.benchmarks) on.add(b.toUpperCase());
		return on;
	}, [r]);
	const [on, setOn] = useState(defaultOn);
	const [prices, setPrices] = useState<PriceSeries[] | null>(null);
	const [priceErr, setPriceErr] = useState<string | null>(null);

	useEffect(() => {
		setPrices(null);
		getPrices({
			data: {
				symbols: symbols.slice(0, 12),
				start: r.market.window_start,
				end: r.market.window_end,
				interval: r.market.interval,
			},
		})
			.then(setPrices)
			.catch((e) => setPriceErr(e instanceof Error ? e.message : String(e)));
	}, [symbols, r]);

	const bySymbol = new Map(prices?.map((p) => [p.symbol, p]));
	const windowChange = (s: string) =>
		seriesChange(bySymbol.get(s.toUpperCase()));
	const key = prices ? keyNumbers(r, prices) : null;
	const impact = stripMoves(r.impact_summary);
	const lines: ChartSeries[] = symbols
		.filter((s) => on.has(s) && bySymbol.get(s)?.points.length)
		.map((s) => ({
			symbol: s,
			color: colorOf(s),
			series: bySymbol.get(s) as PriceSeries,
		}));
	const timeline = [...r.timeline].sort((a, b) => a.time.localeCompare(b.time));

	return (
		<>
			<header className="flex flex-col gap-5">
				<div className="flex flex-wrap items-center gap-2 text-xs">
					<span className="rounded-full border border-emerald-500/40 px-3 py-1 text-emerald-300">
						{r.event.status}
					</span>
					<span className="font-mono text-zinc-500">
						Started {formatEventTime(r.event.started_at)}
					</span>
					{durationMs != null && (
						<span className="font-mono text-zinc-600">
							· researched in {Math.round(durationMs / 1000)}s
						</span>
					)}
				</div>
				<h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
					{r.event.title}
				</h1>
				<p className="max-w-3xl text-lg leading-relaxed text-zinc-400">
					{r.event.summary}
				</p>
			</header>

			<section>
				<SectionTitle kicker="Market" title="Price reaction vs. news" />
				<div className="mb-4 flex flex-wrap gap-2">
					{symbols.map((s) => {
						const active = on.has(s);
						const ch = windowChange(s);
						return (
							<button
								key={s}
								type="button"
								onClick={() => {
									const next = new Set(on);
									if (active) next.delete(s);
									else next.add(s);
									setOn(next);
								}}
								className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors ${
									active
										? "border-zinc-600 text-zinc-100"
										: "border-zinc-800 text-zinc-500 hover:border-zinc-600"
								}`}
							>
								<span
									className="h-2.5 w-2.5 rounded-full"
									style={{
										background: active ? colorOf(s) : "transparent",
										boxShadow: `inset 0 0 0 2px ${colorOf(s)}`,
									}}
								/>
								<span className="font-medium">{s}</span>
								{ch != null && (
									<span className="font-mono text-xs text-zinc-400">
										{signedPct(ch)}
									</span>
								)}
							</button>
						);
					})}
				</div>
				<div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3 sm:p-5">
					{priceErr ? (
						<p className="text-sm text-rose-300">
							Price data failed: {priceErr}
						</p>
					) : !prices ? (
						<div className="flex h-80 items-center justify-center text-sm text-zinc-500">
							Loading prices from Yahoo Finance…
						</div>
					) : (
						<PriceChart lines={lines} markers={timeline} />
					)}
				</div>
				<p className="mt-3 text-xs text-zinc-600">
					% change from the last close before the window (
					{formatPT(r.market.window_start)} – {formatPT(r.market.window_end)}),{" "}
					{r.market.interval} bars from Yahoo Finance. Prices never come from
					the agent's text.
				</p>
			</section>

			{r.people.length > 0 && (
				<section>
					<SectionTitle kicker="People" title="Who's involved" />
					<div className="overflow-x-auto rounded-xl border border-zinc-800">
						<table className="w-full text-left text-sm">
							<thead className="bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-500">
								<tr>
									<th className="px-4 py-3 font-medium">Name</th>
									<th className="px-4 py-3 font-medium">Role</th>
									<th className="px-4 py-3 font-medium">Relevance</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-800">
								{r.people.map((p) => (
									<tr key={p.name} className="align-top">
										<td className="whitespace-nowrap px-4 py-3 font-medium">
											{p.name}
										</td>
										<td className="px-4 py-3 text-zinc-400">{p.role}</td>
										<td className="px-4 py-3 text-zinc-400">{p.relevance}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			)}

			<section>
				<SectionTitle kicker="Tickers" title="Related securities" />
				<div className="flex flex-col gap-6">
					{RELATION_ORDER.map((rel) => {
						const items = r.tickers.filter((t) => t.relation === rel);
						if (!items.length) return null;
						return (
							<div key={rel}>
								<h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-400">
									{RELATION_LABEL[rel]}
								</h3>
								<div className="overflow-x-auto rounded-xl border border-zinc-800">
									<table className="w-full text-left text-sm">
										<thead className="bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-500">
											<tr>
												<th className="px-4 py-2 font-medium">Symbol</th>
												<th className="px-4 py-2 font-medium">Why</th>
												<th className="px-4 py-2 text-right font-medium">
													Window (Yahoo)
												</th>
												<th className="px-4 py-2 font-medium">Agent note</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-zinc-800">
											{items.map((t) => {
												const obs = r.market.observations.find(
													(o) =>
														o.symbol.toUpperCase() === t.symbol.toUpperCase(),
												);
												const note = obs ? stripMoves(obs.text) : "";
												const ch = windowChange(t.symbol);
												return (
													<tr key={t.symbol} className="align-top">
														<td className="px-4 py-3">
															<div className="flex items-center gap-2 font-medium">
																<span
																	className="h-2.5 w-2.5 shrink-0 rounded-full"
																	style={{ background: colorOf(t.symbol) }}
																/>
																{t.symbol}
															</div>
															<div className="mt-0.5 text-xs text-zinc-500">
																{t.name}
															</div>
														</td>
														<td className="px-4 py-3 text-zinc-400">
															{t.rationale}
														</td>
														<td className="whitespace-nowrap px-4 py-3 text-right font-mono">
															{ch == null ? (
																<span className="text-zinc-600">—</span>
															) : (
																<span
																	className={
																		ch >= 0
																			? "text-emerald-300"
																			: "text-rose-300"
																	}
																>
																	{signedPct(ch)}
																</span>
															)}
														</td>
														<td className="px-4 py-3 text-zinc-400">
															{note ? (
																note
															) : (
																<span className="text-zinc-600">—</span>
															)}
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</div>
						);
					})}
				</div>
			</section>

			<section>
				<SectionTitle kicker="Timeline" title="How it unfolded" />
				<ol className="relative border-l border-zinc-800">
					{timeline.map((e) => (
						<li key={`${e.time}-${e.headline}`} className="ml-6 pb-8 last:pb-0">
							<span
								className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-zinc-950 ${
									e.kind === "official" ? "bg-emerald-400" : "bg-zinc-500"
								}`}
							/>
							<div className="flex flex-wrap items-center gap-2">
								<time className="font-mono text-sm text-zinc-500">
									{formatEventTime(e.time)}
								</time>
								<span className="rounded-md border border-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">
									{e.kind}
								</span>
							</div>
							<h3 className="mt-1 text-lg font-medium">{e.headline}</h3>
							{e.detail && (
								<p className="mt-1 max-w-3xl leading-relaxed text-zinc-400">
									{e.detail}
								</p>
							)}
							<a
								href={e.url}
								target="_blank"
								rel="noreferrer"
								className="mt-2 inline-block rounded-md border border-zinc-800 px-2 py-0.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
							>
								{e.source} ↗
							</a>
						</li>
					))}
				</ol>
			</section>

			<section className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
					<h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
						Impact summary
					</h2>
					{key?.leadPct != null && (
						<p className="mt-3 font-mono text-sm text-zinc-400">
							Chart window: {key.lead}{" "}
							<span
								className={
									key.leadPct < 0 ? "text-rose-300" : "text-emerald-300"
								}
							>
								{signedPct(key.leadPct)}
							</span>
							{key.benchPct != null && key.excess != null && (
								<>
									{" "}
									· {key.bench} {signedPct(key.benchPct)} · {key.lead} vs{" "}
									{key.bench}{" "}
									<span
										className={
											key.excess < 0 ? "text-rose-300" : "text-emerald-300"
										}
									>
										{signedPct(key.excess)}
									</span>
								</>
							)}
						</p>
					)}
					{impact && (
						<p className="mt-3 leading-relaxed text-zinc-300">{impact}</p>
					)}
				</div>
				<div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
					<h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
						Open questions
					</h2>
					<ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-zinc-300">
						{r.open_questions.map((q) => (
							<li key={q}>{q}</li>
						))}
					</ul>
				</div>
			</section>

			<TelemTrace events={events} />

			{events.length > 0 && (
				<details className="text-sm">
					<summary className="cursor-pointer text-zinc-500 hover:text-zinc-300">
						Agent log · {events.length} events
					</summary>
					<ol className="mt-3 flex flex-col gap-1 font-mono text-xs text-zinc-500">
						{events.map((e) => (
							<li key={`${e.at}|${e.text}`}>{e.text}</li>
						))}
					</ol>
				</details>
			)}
		</>
	);
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
	return (
		<div className="mb-6 flex flex-col gap-2">
			<span className="text-xs font-medium uppercase tracking-wider text-emerald-400">
				{kicker}
			</span>
			<h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
				{title}
			</h2>
		</div>
	);
}

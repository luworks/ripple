// "Telem trace" panel for a research run: what the agent asked Telem and what came back,
// counted from the runner's recorded tool calls (AgentEvent.call), never from the model's answer.
import type { AgentEvent } from "#/server/research-types";

// Hosts we label as social / community platforms rather than news or web pages.
const SOCIAL: [RegExp, string][] = [
	[/(^|\.)(x|twitter)\.com$/, "X"],
	[/(^|\.)reddit\.com$/, "Reddit"],
	[/(^|\.)weibo\.(com|cn)$/, "Weibo"],
	[/(^|\.)zhihu\.com$/, "Zhihu"],
	[/(^|\.)(xiaohongshu\.com|xhslink\.com)$/, "Xiaohongshu"],
	[/(^|\.)bilibili\.com$/, "Bilibili"],
	[/(^|\.)douyin\.com$/, "Douyin"],
	[/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
	[/(^|\.)facebook\.com$/, "Facebook"],
	[/(^|\.)threads\.(net|com)$/, "Threads"],
	[/(^|\.)linkedin\.com$/, "LinkedIn"],
	[/(^|\.)stocktwits\.com$/, "Stocktwits"],
	[/(^|\.)tiktok\.com$/, "TikTok"],
	[/(^|\.)xueqiu\.com$/, "Xueqiu"],
	[/(^|\.)guba\.eastmoney\.com$/, "Guba"],
	[/(^|\.)news\.ycombinator\.com$/, "Hacker News"],
];

const host = (u: string) => {
	try {
		return new URL(u).hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
};
const socialOf = (h: string) => SOCIAL.find(([re]) => re.test(h))?.[1];
const isTelem = (server: string) => server.startsWith("telem");

export type TelemTraceStats = ReturnType<typeof telemTrace>;

export function telemTrace(events: AgentEvent[]) {
	let telemSearches = 0;
	let telemFetches = 0;
	let tavilyCalls = 0;
	let otherCalls = 0;
	let queries = 0;
	let pagesRequested = 0;
	let pagesRead = 0;
	const topics = new Set<string>();
	const providerUrls = new Map<string, Set<string>>();
	const telemUrls = new Set<string>();
	const tavilyOnlyUrls = new Set<string>();
	for (const e of events) {
		if (e.kind === "tool") {
			const server = e.call?.server ?? e.text.split(".")[0];
			const tool = e.call?.tool ?? e.text.split(".")[1]?.split(":")[0] ?? "";
			if (isTelem(server)) {
				if (tool.includes("fetch")) {
					telemFetches++;
					pagesRequested += e.call?.urls?.length ?? 0;
				} else {
					telemSearches++;
					queries += e.call?.queries?.length ?? 0;
					if (e.call?.topic) topics.add(e.call.topic);
				}
			} else if (server === "tavily") tavilyCalls++;
			else otherCalls++;
		}
		if (e.kind === "result" && e.call) {
			if (isTelem(e.call.server)) {
				pagesRead += e.call.pages ?? 0;
				for (const [p, u] of e.call.hits ?? []) {
					telemUrls.add(u);
					const s = providerUrls.get(p) ?? new Set<string>();
					providerUrls.set(p, s.add(u));
				}
			} else for (const [, u] of e.call.hits ?? []) tavilyOnlyUrls.add(u);
		}
	}
	const providers = [...providerUrls]
		.map(([name, s]) => ({ name, urls: s.size }))
		.sort((a, b) => b.urls - a.urls);
	const hosts = new Map<string, number>();
	for (const u of telemUrls) {
		const h = host(u);
		if (h) hosts.set(h, (hosts.get(h) ?? 0) + 1);
	}
	const platforms = new Map<string, number>();
	for (const [h, n] of hosts) {
		const s = socialOf(h);
		if (s) platforms.set(s, (platforms.get(s) ?? 0) + n);
	}
	const best = providers[0];
	return {
		telemCalls: telemSearches + telemFetches,
		telemSearches,
		telemFetches,
		tavilyCalls,
		otherCalls,
		queries,
		topics: [...topics],
		pagesRequested,
		pagesRead,
		sources: telemUrls.size,
		providers,
		sites: hosts.size,
		topHosts: [...hosts]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 12)
			.map(([h, n]) => ({ host: h, n, social: socialOf(h) })),
		platforms: [...platforms]
			.map(([name, n]) => ({ name, n }))
			.sort((a, b) => b.n - a.n),
		bestSingle: best,
		tavilyOnly: tavilyOnlyUrls.size,
	};
}

export function TelemTrace({ events }: { events: AgentEvent[] }) {
	const t = telemTrace(events);
	if (t.telemCalls === 0) return null;
	const searchCalls = t.telemSearches + t.tavilyCalls;
	const maxP = t.providers[0]?.urls ?? 1;
	const lift =
		t.bestSingle && t.bestSingle.urls > 0
			? Math.round((t.sources / t.bestSingle.urls - 1) * 100)
			: null;
	return (
		<section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
					Telem trace
				</h2>
				<span className="text-xs text-zinc-500">
					Counted from the agent's recorded tool calls
				</span>
			</div>
			<dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
				<Stat
					label="Telem calls"
					value={t.telemCalls}
					sub={`${t.telemSearches} search · ${t.telemFetches} fetch${
						searchCalls
							? ` · ${Math.round((t.telemSearches / searchCalls) * 100)}% of searches`
							: ""
					}`}
				/>
				<Stat
					label="Queries"
					value={t.queries}
					sub={
						t.topics.length
							? `incl. platform search: ${t.topics.join(", ")}`
							: "multi-provider"
					}
				/>
				<Stat
					label="Sources found"
					value={t.sources}
					sub={`${t.sites} sites · ${t.providers.length} providers`}
				/>
				<Stat
					label="Pages read"
					value={t.pagesRead || t.pagesRequested}
					sub={`via telem_fetch${t.tavilyCalls ? ` · ${t.tavilyCalls} Tavily fallback calls` : " · no Tavily fallback"}`}
				/>
			</dl>

			{t.providers.length > 0 && (
				<div className="mt-6 grid gap-6 lg:grid-cols-2">
					<div>
						<h3 className="text-sm font-medium text-zinc-300">
							Results by search provider
						</h3>
						<ul className="mt-2 flex flex-col gap-1.5 text-sm">
							{t.providers.map((p) => (
								<li key={p.name} className="flex items-center gap-3">
									<span className="w-20 shrink-0 font-mono text-zinc-400">
										{p.name}
									</span>
									<span className="h-2 flex-1 rounded bg-zinc-800">
										<span
											className="block h-2 rounded bg-emerald-500/70"
											style={{ width: `${(p.urls / maxP) * 100}%` }}
										/>
									</span>
									<span className="w-10 shrink-0 text-right tabular-nums text-zinc-400">
										{p.urls}
									</span>
								</li>
							))}
						</ul>
						{t.bestSingle && lift !== null && (
							<p className="mt-3 text-sm text-zinc-400">
								Best single provider ({t.bestSingle.name}):{" "}
								<span className="text-zinc-200">{t.bestSingle.urls}</span>{" "}
								sources. Telem merged:{" "}
								<span className="text-zinc-200">{t.sources}</span>
								{lift > 0 && (
									<span className="text-emerald-400"> (+{lift}%)</span>
								)}
								.
							</p>
						)}
					</div>
					<div>
						<h3 className="text-sm font-medium text-zinc-300">
							Platforms and sites
						</h3>
						{t.platforms.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-1.5">
								{t.platforms.map((p) => (
									<span
										key={p.name}
										className="rounded-full border border-sky-500/40 px-2 py-0.5 text-xs text-sky-300"
									>
										{p.name} · {p.n}
									</span>
								))}
							</div>
						)}
						<ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
							{t.topHosts.map((h) => (
								<li
									key={h.host}
									className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-400"
								>
									{h.host} <span className="text-zinc-500">{h.n}</span>
								</li>
							))}
							{t.sites > t.topHosts.length && (
								<li className="px-1 py-0.5 text-zinc-500">
									+{t.sites - t.topHosts.length} more
								</li>
							)}
						</ul>
					</div>
				</div>
			)}
		</section>
	);
}

function Stat({
	label,
	value,
	sub,
}: {
	label: string;
	value: number;
	sub: string;
}) {
	return (
		<div>
			<dt className="text-xs text-zinc-500">{label}</dt>
			<dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
			<dd className="mt-0.5 text-xs text-zinc-500">{sub}</dd>
		</div>
	);
}

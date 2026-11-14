import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND } from "#/brand";
import { RippleReplayView } from "#/components/ripple/RippleReplay";
import { VenturePitch } from "#/components/VenturePitch";

// Demo video: an .mp4 in web/public (e.g. "/demo.mp4") or a YouTube/Loom embed URL.
const DEMO_VIDEO_SRC = "";

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [
			{ title: `${BRAND} · one headline, every ripple` },
			{
				name: "description",
				content:
					"Type a market-moving event. Get the people, exposed tickers, a minute-level timeline and the chatter from X, Reddit and Chinese social platforms via Telem, every claim linked to its source.",
			},
		],
	}),
	component: Home,
});

function Home() {
	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
			<div className="mx-auto flex max-w-6xl flex-col gap-28 px-4 pt-14 pb-24 sm:px-6 sm:pt-20">
				<section className="flex flex-col gap-10">
					<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
						<div className="flex flex-col gap-6">
							<h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
								One headline.
								<br />
								<span className="text-sky-400">Every ripple.</span>
							</h1>
							<p className="max-w-xl text-lg leading-relaxed text-zinc-400">
								Type a market-moving event. In about a minute you get the
								people, the exposed tickers, a minute-level timeline and the
								chatter from X, Reddit and Chinese social platforms via Telem,
								every claim linked to its source.
							</p>
						</div>
						<div className="flex shrink-0 flex-col gap-3 lg:items-end">
							<Link
								to="/research"
								className="self-start rounded-xl bg-sky-400 px-5 py-3 text-sm font-medium text-zinc-950 hover:bg-sky-300 lg:self-auto"
							>
								Research an event →
							</Link>
							<a
								href="#pitch"
								className="text-sm text-zinc-500 hover:text-sky-400"
							>
								Investors: who pays, why us, how big ↓
							</a>
						</div>
					</div>
					<DemoVideo />
				</section>

				<section className="flex flex-col gap-8">
					<div className="grid grid-cols-1 items-end gap-x-10 gap-y-6 lg:grid-cols-5">
						<div className="flex flex-col gap-4 lg:col-span-3">
							<Kicker>Search, built on Telem</Kicker>
							<h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
								How far did it spread?
							</h2>
							<p className="leading-relaxed text-zinc-400">
								One week of the Jensen Huang story on a single clock: NVDA
								minute by minute, each event as it was reported, and every post
								Telem found on X, Xiaohongshu, Douyin, TikTok, LinkedIn and
								Instagram at the minute it was published.
							</p>
						</div>
						<div className="grid grid-cols-3 gap-4 lg:col-span-2">
							<Kpi value="180" label="relevant posts collected" />
							<Kpi value="13" label="social platforms" />
							<Kpi value="~3 min" label="posts after price" />
						</div>
					</div>
					<RippleReplayView />
					<p className="max-w-3xl leading-relaxed text-zinc-400">
						The agent reads the headline as an event, searches in English and
						the event's local language, ranks the earliest credible source
						first, and grounds every line in a URL and a UTC time. Telem reaches
						X, Reddit, Weibo, Xiaohongshu, Zhihu and more behind one API.
						Without it, each would be its own scraper and login.
					</p>
				</section>

				<TelemStages />

				<VenturePitch />

				<section className="flex flex-col gap-8">
					<div className="flex flex-col gap-3">
						<Kicker>Explore</Kicker>
						<h2 className="text-3xl font-semibold tracking-tight">
							What we built
						</h2>
					</div>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<Card
							to="/research"
							k="Live agent"
							t="Research any event"
							b="Watch the agent search, read and assemble the brief in real time."
						/>
						<Card
							to="/events/jensen-huang"
							k="Case study"
							t="Jensen Huang resigns"
							b="Live blog of how the story unfolded, plus the social pulse by stance."
						/>
						<Card
							to="/stock/nvda"
							k="Market view"
							t="NVDA, event by event"
							b="1-minute to monthly candles with each news beat pinned to the chart."
						/>
						<Card
							to="/telem"
							k="Tool notes"
							t="Telem in one page"
							b="Search, fetch, 37 platforms and monitors, measured live."
						/>
						<Card
							to="/tavily"
							k="Tool notes"
							t="Tavily in one page"
							b="Search, extract, map and crawl, and where it complements Telem."
						/>
						<Card
							to="/agent-memory"
							k="Lab"
							t="Agent Memory"
							b="Every search our agents ran, live as new ones land."
						/>
					</div>
				</section>
			</div>
		</main>
	);
}

const stages = [
	[
		"Understand",
		"Reads the headline as an event: who, what, when, and which language the story lives in.",
	],
	[
		"Retrieve",
		"Telem searches news and social platforms first; Tavily fills in when a publish time is missing.",
	],
	[
		"Rank",
		"Earliest credible report first, originals over aggregators, posts grouped by stance.",
	],
	[
		"Ground",
		"Every line carries a real URL and a UTC time. Prices come only from market data.",
	],
];

function TelemStages() {
	return (
		<ol className="-mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{stages.map(([step, body], i) => (
				<li
					key={step}
					className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5"
				>
					<span className="font-mono text-xs text-sky-400">
						{String(i + 1).padStart(2, "0")}
					</span>
					<span className="font-medium">{step}</span>
					<p className="text-sm leading-relaxed text-zinc-400">{body}</p>
				</li>
			))}
		</ol>
	);
}

function DemoVideo() {
	const frame =
		"aspect-video w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900";
	if (DEMO_VIDEO_SRC.endsWith(".mp4"))
		return (
			// biome-ignore lint/a11y/useMediaCaption: product demo, narration on screen
			<video className={frame} src={DEMO_VIDEO_SRC} controls playsInline />
		);
	if (DEMO_VIDEO_SRC)
		return (
			<iframe
				className={frame}
				src={DEMO_VIDEO_SRC}
				title={`${BRAND} demo`}
				allowFullScreen
			/>
		);
	return (
		<div
			className={`${frame} flex flex-col items-center justify-center gap-3 border-dashed`}
		>
			<span className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-700 text-xl text-zinc-400">
				▶
			</span>
			<span className="text-sm text-zinc-500">Demo video · coming soon</span>
		</div>
	);
}

function Kicker({ children }: { children: string }) {
	return (
		<span className="text-xs font-medium uppercase tracking-wider text-sky-400">
			{children}
		</span>
	);
}

function Kpi({ value, label }: { value: string; label: string }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="font-mono text-2xl">{value}</span>
			<span className="text-xs text-zinc-500">{label}</span>
		</div>
	);
}

type To =
	| "/research"
	| "/events/jensen-huang"
	| "/stock/nvda"
	| "/telem"
	| "/tavily"
	| "/agent-memory";

function Card({ to, k, t, b }: { to: To; k: string; t: string; b: string }) {
	return (
		<Link
			to={to}
			className="group flex flex-col gap-2 rounded-2xl border border-zinc-800 p-6 transition-colors hover:border-sky-400/50"
		>
			<span className="text-xs font-medium uppercase tracking-wider text-sky-400">
				{k}
			</span>
			<span className="text-lg font-medium">
				{t} <span className="text-zinc-500 group-hover:text-sky-400">→</span>
			</span>
			<span className="text-sm text-zinc-500">{b}</span>
		</Link>
	);
}

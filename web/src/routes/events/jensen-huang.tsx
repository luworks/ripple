import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import data from "#/data/jensen-huang-posts.json";
import {
	keyFacts,
	type TimelineEvent,
	timeline,
} from "#/data/jensen-huang-timeline";

export const Route = createFileRoute("/events/jensen-huang")({
	head: () => ({
		meta: [
			{ title: "Jensen Huang resigns as Nvidia CEO · brain0" },
			{
				name: "description",
				content:
					"Timeline and cross-platform social pulse of Jensen Huang's resignation as Nvidia CEO, collected with Telem.",
			},
		],
	}),
	component: JensenHuangEvent,
});

type Category = "china" | "global" | "places" | "commerce" | "ads";
type Stance = "supportive" | "critical" | "neutral" | "speculative";
type Post = {
	id: string;
	platform: string;
	category: Category;
	providers: string[];
	query: string;
	url: string;
	title: string;
	text: string;
	date: string | null;
	title_en: string;
	summary_en: string;
	language: "zh" | "en" | "other";
	stance: Stance;
	relevant: boolean;
};
type Run = {
	platform: string;
	category: string;
	provider: string;
	query: string;
	status: string;
	results: number;
	seconds: number;
};

const posts = data.posts as Post[];
const runs = data.runs as Run[];
const social = posts.filter(
	(p) => (p.category === "china" || p.category === "global") && p.relevant,
);
const beyond = posts.filter(
	(p) => p.category !== "china" && p.category !== "global",
);
const platformCount = new Set(posts.map((p) => p.platform)).size;

const STANCE: Record<Stance, { label: string; dot: string; badge: string }> = {
	supportive: {
		label: "Supportive",
		dot: "bg-emerald-400",
		badge: "border-emerald-500/40 text-emerald-300",
	},
	critical: {
		label: "Critical",
		dot: "bg-rose-400",
		badge: "border-rose-500/40 text-rose-300",
	},
	speculative: {
		label: "Speculative",
		dot: "bg-amber-400",
		badge: "border-amber-500/40 text-amber-300",
	},
	neutral: {
		label: "Neutral / news",
		dot: "bg-sky-400",
		badge: "border-sky-500/40 text-sky-300",
	},
};
const STANCES = Object.keys(STANCE) as Stance[];

const PHASE: Record<TimelineEvent["phase"], string> = {
	background: "Background",
	scandal: "Scandal breaks",
	resignation: "Resignation",
	aftermath: "Aftermath",
	upcoming: "What's next",
};

const CATEGORY_LABEL: Record<Category, string> = {
	china: "Chinese platforms",
	global: "Global platforms",
	places: "Maps & reviews",
	commerce: "Commerce & apps",
	ads: "Ad libraries",
};

function JensenHuangEvent() {
	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
			<div className="mx-auto flex max-w-5xl flex-col gap-20 px-4 py-16 sm:px-6 sm:py-20">
				<Hero />
				<Timeline />
				<SocialPulse />
				<Beyond />
				<Methodology />
				<footer className="text-xs text-zinc-600">
					brain0 · data collected with Telem on Nov 14, 2026 ·{" "}
					<Link to="/" className="hover:text-zinc-400">
						back to home
					</Link>
				</footer>
			</div>
		</main>
	);
}

function Hero() {
	return (
		<header className="flex flex-col gap-8">
			<div className="flex flex-col gap-5">
				<span className="w-fit rounded-full border border-zinc-800 px-3 py-1 text-xs tracking-wide text-zinc-400">
					Event brief · updated Nov 14, 2026
				</span>
				<h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
					Jensen Huang resigns as Nvidia CEO
				</h1>
				<p className="max-w-3xl text-lg leading-relaxed text-zinc-400">
					Nvidia's co-founder stepped down on Nov 12, 2026, four days after
					admitting an affair with Alice Huang, a Singapore businesswoman whom
					US officials investigated as a suspected Chinese intelligence asset.
					Below: what happened when, and how {social.length} relevant posts
					across {platformCount} platforms reacted.
				</p>
			</div>
			<dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
				{keyFacts.map((f) => (
					<div
						key={f.label}
						className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
					>
						<dt className="text-xs uppercase tracking-wider text-zinc-500">
							{f.label}
						</dt>
						<dd className="mt-2 text-lg font-medium">{f.value}</dd>
						<dd className="mt-1 text-xs text-zinc-500">{f.note}</dd>
					</div>
				))}
			</dl>
		</header>
	);
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
	return (
		<div className="mb-8 flex flex-col gap-2">
			<span className="text-xs font-medium uppercase tracking-wider text-emerald-400">
				{kicker}
			</span>
			<h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
				{title}
			</h2>
		</div>
	);
}

function Timeline() {
	let lastPhase = "";
	return (
		<section>
			<SectionTitle kicker="Timeline" title="How it unfolded" />
			<ol className="relative border-l border-zinc-800">
				{timeline.map((e) => {
					const showPhase = e.phase !== lastPhase;
					lastPhase = e.phase;
					const upcoming = e.phase === "upcoming";
					return (
						<li key={`${e.date}-${e.title}`} className="ml-6 pb-10 last:pb-0">
							{showPhase && (
								<div className="-ml-6 mb-4 pl-6 text-xs font-medium uppercase tracking-wider text-zinc-500">
									{PHASE[e.phase]}
								</div>
							)}
							<span
								className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-zinc-950 ${
									upcoming
										? "border border-zinc-500 bg-zinc-950"
										: e.phase === "resignation"
											? "bg-emerald-400"
											: "bg-zinc-500"
								}`}
							/>
							<time className="font-mono text-sm text-zinc-500">{e.when}</time>
							<h3 className="mt-1 text-lg font-medium">{e.title}</h3>
							<p className="mt-2 max-w-3xl leading-relaxed text-zinc-400">
								{e.detail}
							</p>
							<div className="mt-3 flex flex-wrap gap-2">
								{e.sources.map((s) => (
									<a
										key={s.url}
										href={s.url}
										target="_blank"
										rel="noreferrer"
										className="rounded-md border border-zinc-800 px-2 py-0.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
									>
										{s.label} ↗
									</a>
								))}
							</div>
						</li>
					);
				})}
			</ol>
		</section>
	);
}

function SocialPulse() {
	const [category, setCategory] = useState<"all" | "china" | "global">("all");
	const [platform, setPlatform] = useState("all");
	const [stance, setStance] = useState<"all" | Stance>("all");

	const inCategory = social.filter(
		(p) => category === "all" || p.category === category,
	);
	const platforms = useMemo(
		() => countBy(inCategory, (p) => p.platform),
		[inCategory],
	);
	const filtered = inCategory
		.filter((p) => platform === "all" || p.platform === platform)
		.filter((p) => stance === "all" || p.stance === stance)
		.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

	return (
		<section>
			<SectionTitle kicker="Social pulse" title="What people are posting" />
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<StanceBreakdown />
				<PostsPerDay />
			</div>

			<div className="mt-10 flex flex-col gap-3">
				<ChipRow>
					{(["all", "china", "global"] as const).map((c) => (
						<Chip
							key={c}
							active={category === c}
							onClick={() => {
								setCategory(c);
								setPlatform("all");
							}}
						>
							{c === "all" ? "All platforms" : CATEGORY_LABEL[c]}
						</Chip>
					))}
					<span className="mx-1 w-px self-stretch bg-zinc-800" />
					{(["all", ...STANCES] as const).map((s) => (
						<Chip key={s} active={stance === s} onClick={() => setStance(s)}>
							{s === "all" ? "Any stance" : STANCE[s].label}
						</Chip>
					))}
				</ChipRow>
				<ChipRow>
					<Chip active={platform === "all"} onClick={() => setPlatform("all")}>
						All · {inCategory.length}
					</Chip>
					{platforms.map(([name, n]) => (
						<Chip
							key={name}
							active={platform === name}
							onClick={() => setPlatform(name)}
						>
							{name} · {n}
						</Chip>
					))}
				</ChipRow>
			</div>

			<p className="mt-6 text-sm text-zinc-500">
				Showing {filtered.length} posts, newest first.
			</p>
			<div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
				{filtered.map((p) => (
					<PostCard key={p.id} post={p} />
				))}
			</div>
		</section>
	);
}

function StanceBreakdown() {
	const total = social.length;
	const byCat = (["china", "global"] as const).map((c) => {
		const ps = social.filter((p) => p.category === c);
		return { c, n: ps.length, counts: countStances(ps) };
	});
	const all = countStances(social);
	return (
		<div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
			<h3 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
				Stance toward Huang
			</h3>
			<div className="mt-5 flex flex-col gap-4">
				<StanceBar label={`All · ${total}`} counts={all} n={total} />
				{byCat.map(({ c, n, counts }) => (
					<StanceBar
						key={c}
						label={`${CATEGORY_LABEL[c]} · ${n}`}
						counts={counts}
						n={n}
					/>
				))}
			</div>
			<div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
				{STANCES.map((s) => (
					<span key={s} className="flex items-center gap-1.5">
						<span className={`h-2 w-2 rounded-full ${STANCE[s].dot}`} />
						{STANCE[s].label} {pct(all[s], total)}
					</span>
				))}
			</div>
		</div>
	);
}

function StanceBar({
	label,
	counts,
	n,
}: {
	label: string;
	counts: Record<Stance, number>;
	n: number;
}) {
	return (
		<div>
			<div className="mb-1.5 text-xs text-zinc-500">{label}</div>
			<div className="flex h-3 overflow-hidden rounded-full bg-zinc-800">
				{STANCES.map((s) =>
					counts[s] ? (
						<div
							key={s}
							className={STANCE[s].dot}
							style={{ width: `${(counts[s] / n) * 100}%` }}
							title={`${STANCE[s].label}: ${counts[s]}`}
						/>
					) : null,
				)}
			</div>
		</div>
	);
}

function PostsPerDay() {
	const days = ["08", "09", "10", "11", "12", "13", "14"].map((d) => {
		const iso = `2026-11-${d}`;
		return {
			iso,
			n: social.filter((p) => p.date?.slice(0, 10) === iso).length,
		};
	});
	const max = Math.max(...days.map((d) => d.n), 1);
	const dated = social.filter((p) => p.date).length;
	return (
		<div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
			<h3 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
				Posts per day, Nov 8–14
			</h3>
			<div className="mt-5 flex h-32 items-end gap-2">
				{days.map((d) => (
					<div
						key={d.iso}
						className="flex flex-1 flex-col items-center justify-end gap-1 self-stretch"
					>
						<span className="font-mono text-xs text-zinc-400">{d.n}</span>
						<div
							className={`w-full rounded-t ${d.iso === "2026-11-12" ? "bg-emerald-400" : "bg-zinc-600"}`}
							style={{ height: `${(d.n / max) * 100}%`, minHeight: 2 }}
						/>
					</div>
				))}
			</div>
			<div className="mt-2 flex gap-2">
				{days.map((d) => (
					<span
						key={d.iso}
						className="flex-1 text-center font-mono text-xs text-zinc-500"
					>
						{d.iso.slice(8)}
					</span>
				))}
			</div>
			<p className="mt-4 text-xs leading-relaxed text-zinc-500">
				UTC dates, recovered for {dated} of {social.length} posts from the post
				ID (X, Xiaohongshu, Douyin, TikTok, Instagram, LinkedIn). Search APIs
				return the most relevant posts, not every post, so read this as shape,
				not volume.
			</p>
		</div>
	);
}

function PostCard({ post: p }: { post: Post }) {
	const original = p.language !== "en" && p.text;
	return (
		<article className="flex flex-col gap-3 rounded-xl border border-zinc-800 p-5">
			<div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
				<span className="font-medium text-zinc-300">{p.platform}</span>
				{p.date && (
					<time title="Derived from the post ID (UTC)" className="font-mono">
						{p.date.slice(0, 10)}
					</time>
				)}
				<span
					className={`ml-auto rounded-full border px-2 py-0.5 ${STANCE[p.stance].badge}`}
				>
					{STANCE[p.stance].label}
				</span>
			</div>
			<h4 className="font-medium leading-snug">{p.title_en}</h4>
			<p className="text-sm leading-relaxed text-zinc-400">{p.summary_en}</p>
			{original && (
				<details className="group text-sm">
					<summary className="cursor-pointer select-none text-xs text-zinc-500 hover:text-zinc-300">
						Original ({p.language === "zh" ? "Chinese" : "source language"})
					</summary>
					<div className="mt-2 rounded-lg bg-zinc-900 p-3 leading-relaxed text-zinc-300">
						{p.title && p.title !== p.text && (
							<div className="mb-1 font-medium">{p.title}</div>
						)}
						<div className="whitespace-pre-line break-words">{p.text}</div>
					</div>
				</details>
			)}
			<div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs text-zinc-600">
				<span className="font-mono">{p.providers.join(", ")}</span>
				<span>· “{p.query}”</span>
				<a
					href={p.url}
					target="_blank"
					rel="noreferrer"
					className="ml-auto text-emerald-400 hover:text-emerald-300"
				>
					Open ↗
				</a>
			</div>
		</article>
	);
}

function Beyond() {
	const groups = (["places", "commerce", "ads"] as const).map((c) => ({
		c,
		items: beyond.filter((p) => p.category === c),
	}));
	return (
		<section>
			<SectionTitle kicker="Beyond social" title="Reviews, stores and ads" />
			<p className="mb-6 max-w-3xl text-zinc-400">
				These sources index places, products and ads rather than posts, so a
				news story barely shows up. We searched for Nvidia's headquarters,
				products and ads to see what each one returns.
			</p>
			<div className="flex flex-col gap-8">
				{groups.map(({ c, items }) => (
					<div key={c}>
						<h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-400">
							{CATEGORY_LABEL[c]} · {items.length}
						</h3>
						<div className="overflow-hidden rounded-xl border border-zinc-800">
							<table className="w-full text-left text-sm">
								<tbody className="divide-y divide-zinc-800">
									{items.map((p) => (
										<tr key={p.id} className="align-top">
											<td className="w-36 whitespace-nowrap px-4 py-3 text-zinc-500">
												{p.platform}
											</td>
											<td className="px-4 py-3">
												<a
													href={p.url}
													target="_blank"
													rel="noreferrer"
													className="font-medium hover:text-emerald-300"
												>
													{p.title_en}
												</a>
												<div className="mt-1 text-zinc-500">{p.summary_en}</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

function Methodology() {
	const ok = runs.filter((r) => r.status === "succeeded").length;
	return (
		<section>
			<SectionTitle kicker="Methodology" title="How this page was built" />
			<ul className="mb-8 flex max-w-3xl list-disc flex-col gap-2 pl-5 text-zinc-400">
				<li>
					Every platform was queried through Telem's search API with
					platform-specific providers ({ok} of {runs.length} runs succeeded).
					Chinese platforms were searched for “黄仁勋 离职” (Jensen Huang
					resigns); global platforms for “Jensen Huang steps down Nvidia CEO”.
				</li>
				<li>
					English titles, summaries and stance labels are machine-generated
					(gpt-5.4-mini) from the text each provider returned; original Chinese
					text is kept under each card. Off-topic results are hidden from the
					social feed.
				</li>
				<li>
					The timeline is written from news coverage found via Telem web search;
					each entry links to its sources.
				</li>
				<li>
					Not covered: Toutiao returned 0 results; Glassdoor is read-only (no
					search); Yelp and the App Store have no search provider in Telem.
				</li>
			</ul>
			<div className="overflow-x-auto rounded-xl border border-zinc-800">
				<table className="w-full text-left text-sm">
					<thead className="bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-500">
						<tr>
							<th className="px-4 py-3 font-medium">Platform</th>
							<th className="px-4 py-3 font-medium">Provider</th>
							<th className="px-4 py-3 font-medium">Query</th>
							<th className="px-4 py-3 text-right font-medium">Results</th>
							<th className="px-4 py-3 text-right font-medium">Time</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-zinc-800">
						{runs.map((r) => (
							<tr key={`${r.provider}-${r.query}`}>
								<td className="px-4 py-2 text-zinc-300">{r.platform}</td>
								<td className="px-4 py-2 font-mono text-xs text-zinc-400">
									{r.provider}
								</td>
								<td className="px-4 py-2 text-zinc-400">{r.query}</td>
								<td
									className={`px-4 py-2 text-right font-mono ${r.results ? "text-zinc-300" : "text-rose-400"}`}
								>
									{r.status === "succeeded" ? r.results : r.status}
								</td>
								<td className="px-4 py-2 text-right font-mono text-zinc-500">
									{r.seconds.toFixed(1)}s
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}

function ChipRow({ children }: { children: React.ReactNode }) {
	return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Chip({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`rounded-full border px-3 py-1 text-sm transition-colors ${
				active
					? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
					: "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
			}`}
		>
			{children}
		</button>
	);
}

function countBy<T>(items: T[], key: (t: T) => string): [string, number][] {
	const m = new Map<string, number>();
	for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
	return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function countStances(ps: Post[]): Record<Stance, number> {
	const c = { supportive: 0, critical: 0, neutral: 0, speculative: 0 };
	for (const p of ps) c[p.stance]++;
	return c;
}

function pct(n: number, total: number) {
	return `${Math.round((n / Math.max(total, 1)) * 100)}%`;
}

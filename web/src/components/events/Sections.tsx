import { useState } from "react";
import { keyFacts } from "#/data/jensen-huang-timeline";
import {
	beyondPosts,
	type PostView,
	runs,
	STANCE,
	STANCES,
	type Stance,
	socialPosts,
	telemTotals,
} from "#/data/jensen-huang-view";
import { RemoteImage, TelemCredits } from "./Telem";

export function SectionTitle({
	kicker,
	title,
	id,
}: {
	kicker: string;
	title: string;
	id?: string;
}) {
	return (
		<div id={id} className="mb-8 flex scroll-mt-24 flex-col gap-2">
			<span className="text-xs font-medium tracking-wider text-emerald-400 uppercase">
				{kicker}
			</span>
			<h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
				{title}
			</h2>
		</div>
	);
}

export function KeyFacts({ cols = 5 }: { cols?: 3 | 5 }) {
	return (
		<dl
			className={`grid grid-cols-2 gap-3 ${cols === 5 ? "sm:grid-cols-5" : "sm:grid-cols-3"}`}
		>
			{keyFacts.map((f) => (
				<div
					key={f.label}
					className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
				>
					<dt className="text-xs tracking-wider text-zinc-500 uppercase">
						{f.label}
					</dt>
					<dd className="mt-2 text-lg font-medium">{f.value}</dd>
					<dd className="mt-1 text-xs text-zinc-500">{f.note}</dd>
				</div>
			))}
		</dl>
	);
}

export function TelemStrip() {
	return (
		<div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm">
			<span className="font-medium text-emerald-300">Built with Telem</span>
			<span className="text-zinc-400">
				<b className="font-mono text-zinc-100">{telemTotals.searchRuns}</b>{" "}
				Search runs
			</span>
			<span className="text-zinc-400">
				<b className="font-mono text-zinc-100">{telemTotals.fetchedPages}</b>{" "}
				pages read with Fetch
			</span>
			<span className="text-zinc-400">
				<b className="font-mono text-zinc-100">{telemTotals.images}</b> images
			</span>
			<span className="text-zinc-400">
				<b className="font-mono text-zinc-100">{socialPosts.length}</b> relevant
				posts
			</span>
		</div>
	);
}

/** Compact post card: small thumbnail, platform/date/stance, English title only. */
export function PostCard({
	post: p,
	withImage = true,
}: {
	post: PostView;
	withImage?: boolean;
}) {
	return (
		<article className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
			{withImage && p.image && (
				<RemoteImage
					src={p.image}
					alt=""
					className="h-20 w-20 shrink-0 rounded-lg bg-zinc-900 object-cover"
				/>
			)}
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
					<span className="font-medium text-zinc-300">{p.platform}</span>
					{p.date && (
						<time title="Derived from the post ID (UTC)" className="font-mono">
							{p.date.slice(0, 10)}
						</time>
					)}
					<span
						className={`ml-auto rounded-full border px-2 py-px ${STANCE[p.stance].badge}`}
					>
						{STANCE[p.stance].label}
					</span>
				</div>
				<h4 className="line-clamp-2 text-sm leading-snug font-medium">
					<a
						href={p.url}
						target="_blank"
						rel="noreferrer"
						title={p.summary_en}
						className="hover:text-emerald-300"
					>
						{p.title_en}
					</a>
				</h4>
				<div className="mt-auto">
					<TelemCredits credits={p.credits} compact />
				</div>
			</div>
		</article>
	);
}

type Region = "global" | "china" | "all";
const REGIONS: { id: Region; label: string }[] = [
	{ id: "global", label: "Global" },
	{ id: "china", label: "Chinese platforms" },
	{ id: "all", label: "All regions" },
];

/** Platforms per region, most posts first, so every chip shows a real count. */
function platformsIn(region: Region) {
	const counts = new Map<string, number>();
	for (const p of socialPosts)
		if (region === "all" || p.category === region)
			counts.set(p.platform, (counts.get(p.platform) ?? 0) + 1);
	return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * Social feed with three filter rows, applied in order:
 * 1. Region: Global (default) or Chinese platforms, or both.
 * 2. Platform: every social network in that region with its post count; one click narrows to it.
 * 3. Stance and "With images" refine whatever the first two rows selected.
 */
export function SocialFeed({ columns = 3 }: { columns?: 2 | 3 }) {
	const [region, setRegion] = useState<Region>("global");
	const [platform, setPlatform] = useState<string | null>(null);
	const [stance, setStance] = useState<"all" | Stance>("all");
	const [withImages, setWithImages] = useState(false);
	const platforms = platformsIn(region);
	const inRegion = platforms.reduce((n, [, c]) => n + c, 0);
	const list = socialPosts
		.filter((p) => region === "all" || p.category === region)
		.filter((p) => !platform || p.platform === platform)
		.filter((p) => stance === "all" || p.stance === stance)
		.filter((p) => !withImages || p.image)
		.sort(
			(a, b) =>
				Number(Boolean(b.image)) - Number(Boolean(a.image)) ||
				(b.date ?? "").localeCompare(a.date ?? ""),
		);
	return (
		<div>
			<div className="mb-6 flex flex-col gap-3">
				<FilterRow label="Region">
					{REGIONS.map((r) => (
						<Chip
							key={r.id}
							on={region === r.id}
							onClick={() => {
								setRegion(r.id);
								setPlatform(null);
							}}
						>
							{r.label}
						</Chip>
					))}
				</FilterRow>
				<FilterRow label="Platform">
					<Chip on={!platform} onClick={() => setPlatform(null)}>
						All <Count n={inRegion} />
					</Chip>
					{platforms.map(([name, n]) => (
						<Chip
							key={name}
							on={platform === name}
							onClick={() => setPlatform(platform === name ? null : name)}
						>
							{name} <Count n={n} />
						</Chip>
					))}
				</FilterRow>
				<FilterRow label="Stance">
					{(["all", ...STANCES] as const).map((s) => (
						<Chip key={s} on={stance === s} onClick={() => setStance(s)}>
							{s === "all" ? "Any" : STANCE[s].label}
						</Chip>
					))}
					<span className="mx-1 w-px self-stretch bg-zinc-800" />
					<Chip on={withImages} onClick={() => setWithImages(!withImages)}>
						With images
					</Chip>
				</FilterRow>
			</div>
			<p className="mb-4 text-sm text-zinc-500">{list.length} posts</p>
			<div
				className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${columns === 3 ? "lg:grid-cols-3" : ""}`}
			>
				{list.map((p) => (
					<PostCard key={p.id} post={p} />
				))}
			</div>
		</div>
	);
}

function FilterRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-start">
			<span className="w-20 shrink-0 pt-1.5 text-xs tracking-wider text-zinc-500 uppercase">
				{label}
			</span>
			<div className="flex flex-wrap gap-2">{children}</div>
		</div>
	);
}

function Count({ n }: { n: number }) {
	return <span className="ml-0.5 font-mono text-xs text-zinc-500">{n}</span>;
}

export function Chip({
	on,
	onClick,
	children,
}: {
	on: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`rounded-full border px-3 py-1 text-sm transition-colors ${
				on
					? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
					: "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
			}`}
		>
			{children}
		</button>
	);
}

export function Methodology() {
	return (
		<div className="flex flex-col gap-8">
			<ul className="flex max-w-3xl list-disc flex-col gap-2 pl-5 text-zinc-400">
				<li>
					<b className="text-zinc-200">Telem Search</b> (
					<code className="text-zinc-300">POST /v1/search</code>) with{" "}
					<code className="text-zinc-300">providers_include</code> pinned one
					platform provider per run, e.g. socialdatax_xhs for Xiaohongshu or
					fetchlayer_reddit for Reddit. News for the timeline came from web
					providers (exa, parallel, tavily).
				</li>
				<li>
					<b className="text-zinc-200">Telem Fetch</b> (
					<code className="text-zinc-300">POST /v1/fetch</code>, extended tier)
					read every news source and post page; images are the page thumbnail
					the fetch provider returned.
				</li>
				<li>
					English titles, summaries and stance labels are machine-generated from
					the returned text; originals stay under each card. Post dates come
					from platform post IDs.
				</li>
				<li>
					Not covered: Toutiao returned 0 results; Glassdoor is read-only; Yelp
					and the App Store have no search provider in Telem.
				</li>
			</ul>
			<div className="overflow-x-auto rounded-xl border border-zinc-800">
				<table className="w-full text-left text-sm">
					<thead className="bg-zinc-900/60 text-xs tracking-wider text-zinc-500 uppercase">
						<tr>
							<th className="px-4 py-3 font-medium">Platform</th>
							<th className="px-4 py-3 font-medium">Telem provider</th>
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
									{r.results}
								</td>
								<td className="px-4 py-2 text-right font-mono text-zinc-500">
									{r.seconds.toFixed(1)}s
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export function BeyondSocial() {
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{beyondPosts.map((p) => (
				<div key={p.id} className="rounded-xl border border-zinc-800 p-4">
					<div className="text-xs text-zinc-500">{p.platform}</div>
					<a
						href={p.url}
						target="_blank"
						rel="noreferrer"
						className="mt-1 block font-medium hover:text-emerald-300"
					>
						{p.title_en}
					</a>
					<p className="mt-1 line-clamp-2 text-sm text-zinc-500">
						{p.summary_en}
					</p>
					<div className="mt-3">
						<TelemCredits credits={p.credits} compact />
					</div>
				</div>
			))}
		</div>
	);
}

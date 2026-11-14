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

export function PostCard({
	post: p,
	withImage = true,
}: {
	post: PostView;
	withImage?: boolean;
}) {
	const original = p.language !== "en" && p.text;
	return (
		<article className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
			{withImage && p.image && (
				<RemoteImage
					src={p.image}
					alt=""
					className="aspect-[4/3] w-full bg-zinc-900 object-cover"
				/>
			)}
			<div className="flex flex-1 flex-col gap-3 p-4">
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
				<h4 className="leading-snug font-medium">
					<a
						href={p.url}
						target="_blank"
						rel="noreferrer"
						className="hover:text-emerald-300"
					>
						{p.title_en}
					</a>
				</h4>
				<p className="text-sm leading-relaxed text-zinc-400">{p.summary_en}</p>
				{original && (
					<details className="text-sm">
						<summary className="cursor-pointer text-xs text-zinc-500 select-none hover:text-zinc-300">
							Original ({p.language === "zh" ? "Chinese" : "source language"})
						</summary>
						<div className="mt-2 rounded-lg bg-zinc-900 p-3 leading-relaxed whitespace-pre-line break-words text-zinc-300">
							{p.text}
						</div>
					</details>
				)}
				<div className="mt-auto border-t border-zinc-800/80 pt-3">
					<TelemCredits credits={p.credits} compact />
				</div>
			</div>
		</article>
	);
}

export function SocialFeed({ columns = 3 }: { columns?: 2 | 3 }) {
	const [category, setCategory] = useState<"all" | "china" | "global">("all");
	const [stance, setStance] = useState<"all" | Stance>("all");
	const [withImages, setWithImages] = useState(false);
	const list = socialPosts
		.filter((p) => category === "all" || p.category === category)
		.filter((p) => stance === "all" || p.stance === stance)
		.filter((p) => !withImages || p.image)
		.sort(
			(a, b) =>
				Number(Boolean(b.image)) - Number(Boolean(a.image)) ||
				(b.date ?? "").localeCompare(a.date ?? ""),
		);
	return (
		<div>
			<div className="mb-6 flex flex-wrap gap-2">
				{(["all", "china", "global"] as const).map((c) => (
					<Chip key={c} on={category === c} onClick={() => setCategory(c)}>
						{c === "all"
							? "All"
							: c === "china"
								? "Chinese platforms"
								: "Global"}
					</Chip>
				))}
				<span className="mx-1 w-px self-stretch bg-zinc-800" />
				{(["all", ...STANCES] as const).map((s) => (
					<Chip key={s} on={stance === s} onClick={() => setStance(s)}>
						{s === "all" ? "Any stance" : STANCE[s].label}
					</Chip>
				))}
				<span className="mx-1 w-px self-stretch bg-zinc-800" />
				<Chip on={withImages} onClick={() => setWithImages(!withImages)}>
					With images
				</Chip>
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

import { ScrollRail } from "#/components/events/ScrollRail";
import {
	BeyondSocial,
	KeyFacts,
	Methodology,
	PostCard,
	SectionTitle,
	SocialFeed,
	TelemStrip,
} from "#/components/events/Sections";
import { RemoteImage, TelemCredits } from "#/components/events/Telem";
import { WhatsNext } from "#/components/events/WhatsNext";
import { type EventView, events, PHASE } from "#/data/jensen-huang-view";

const upcoming = events.filter((e) => e.phase === "upcoming");
const past = events.filter((e) => e.phase !== "upcoming");

const rail = [
	...upcoming.map((e) => ({
		id: e.id,
		label: e.title,
		detail: e.detail,
		kicker: `${e.when} · What's next`,
	})),
	...past.map((e) => ({
		id: e.id,
		label: e.title,
		detail: e.detail,
		kicker: `${e.when} · ${PHASE[e.phase]}`,
		major: e.major,
		tag: e.tag,
	})),
];

export function LiveBlog() {
	return (
		<main className="min-h-screen bg-zinc-950 pb-28 text-zinc-100 antialiased">
			<ScrollRail items={rail} />
			<div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
				<header className="flex flex-col gap-5">
					<span className="flex w-fit items-center gap-2 rounded-full border border-rose-500/40 px-3 py-1 text-xs font-medium tracking-wide text-rose-300">
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
						Live · updated Nov 14, 2026
					</span>
					<h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
						Jensen Huang resigns as Nvidia CEO
					</h1>
					<p className="text-lg leading-relaxed text-zinc-400">
						Newest first. Every update shows which Telem feature found it, the
						provider behind it and the query we ran.
					</p>
					<TelemStrip />
				</header>

				{upcoming.length > 0 && <WhatsNext upcoming={upcoming} />}

				<ol className="mt-12 flex flex-col">
					{past.map((e, i) => (
						<Update key={e.id} e={e} newDay={past[i - 1]?.when !== e.when} />
					))}
				</ol>

				<div className="mt-16">
					<KeyFacts cols={3} />
				</div>

				<section className="mt-20">
					<SectionTitle
						id="social"
						kicker="Social pulse"
						title="What people are posting"
					/>
					<SocialFeed columns={2} />
				</section>

				<section className="mt-20">
					<SectionTitle
						kicker="Beyond social"
						title="Maps, shops and ads around the story"
					/>
					<BeyondSocial />
				</section>

				<section className="mt-20">
					<SectionTitle
						id="method"
						kicker="Methodology"
						title="How Telem collected this"
					/>
					<Methodology />
				</section>
			</div>
		</main>
	);
}

function Update({ e, newDay }: { e: EventView; newDay: boolean }) {
	return (
		<li
			id={e.id}
			className="relative scroll-mt-24 border-l border-zinc-800 pb-12 pl-6 sm:pl-8"
		>
			<span
				className={`absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full ${e.major ? "bg-amber-400 ring-4 ring-amber-400/15" : "bg-zinc-600"}`}
			/>
			{newDay && (
				<div className="sticky top-16 z-10 -mt-1 mb-3 w-fit rounded-md bg-zinc-950/90 py-1 pr-2 font-mono text-sm text-emerald-400 backdrop-blur">
					{e.when}
				</div>
			)}
			<div className="flex items-center gap-2 text-xs text-zinc-500">
				<span>{PHASE[e.phase]}</span>
				{e.major && (
					<span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-amber-300">
						Major
					</span>
				)}
			</div>
			<h3
				className={`mt-2 font-semibold tracking-tight ${e.major ? "text-2xl" : "text-lg"}`}
			>
				{e.title}
			</h3>
			{e.image && (
				<figure className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
					<RemoteImage
						src={e.image.src}
						alt={e.title}
						className="aspect-[16/9] w-full bg-zinc-900 object-cover"
					/>
					<figcaption className="px-3 py-2 text-[11px] text-zinc-500">
						Image: {e.image.from}
					</figcaption>
				</figure>
			)}
			<p className="mt-4 leading-relaxed text-zinc-300">{e.detail}</p>
			<div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
				{e.sources.map((s) => (
					<a
						key={s.url}
						href={s.url}
						target="_blank"
						rel="noreferrer"
						className="text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-emerald-300"
					>
						{s.label}
					</a>
				))}
			</div>
			<div className="mt-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
				<TelemCredits credits={e.credits} />
			</div>
			{e.posts.length > 0 && (
				<details className="mt-4">
					<summary className="cursor-pointer text-sm text-zinc-400 select-none hover:text-zinc-200">
						{e.posts.length} social posts that day
					</summary>
					<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
						{e.posts.slice(0, 4).map((p) => (
							<PostCard key={p.id} post={p} />
						))}
					</div>
				</details>
			)}
		</li>
	);
}

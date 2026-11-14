import { ScrollRail } from "#/components/events/ScrollRail";
import {
	BeyondSocial,
	KeyFacts,
	Methodology,
	SectionTitle,
	SocialFeed,
	TelemStrip,
} from "#/components/events/Sections";
import { RemoteImage, TelemCredits } from "#/components/events/Telem";
import { type EventView, events, PHASE } from "#/data/jensen-huang-view";

const rail = events.map((e) => ({
	id: e.id,
	label: e.title,
	detail: e.detail,
	kicker: `${e.when} · ${PHASE[e.phase]}`,
	major: e.major,
	tag: e.tag,
}));

export function Newsroom() {
	return (
		<main className="min-h-screen bg-zinc-950 pb-28 text-zinc-100 antialiased">
			<ScrollRail items={rail} />
			<div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
				<header className="flex flex-col gap-5">
					<span className="text-xs font-medium tracking-wider text-emerald-400 uppercase">
						Event brief · Nov 14, 2026
					</span>
					<h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
						Jensen Huang resigns as Nvidia CEO
					</h1>
					<TelemStrip />
					<KeyFacts />
				</header>

				<div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-[260px_1fr]">
					<aside className="hidden lg:block">
						<nav className="sticky top-20 flex flex-col gap-1 border-l border-zinc-800">
							<span className="mb-2 pl-4 text-xs tracking-wider text-zinc-500 uppercase">
								Timeline · newest first
							</span>
							{events.map((e) => (
								<a
									key={e.id}
									href={`#${e.id}`}
									className="-ml-px border-l border-transparent py-1 pl-4 text-sm text-zinc-400 hover:border-emerald-400 hover:text-zinc-100"
								>
									<span className="mr-2 font-mono text-xs text-zinc-600">
										{e.when}
									</span>
									<span className={e.major ? "font-medium text-zinc-200" : ""}>
										{e.title.length > 48 ? `${e.title.slice(0, 46)}…` : e.title}
									</span>
								</a>
							))}
						</nav>
					</aside>

					<div className="flex flex-col gap-4">
						{events.map((e) => (
							<Card key={e.id} e={e} />
						))}
					</div>
				</div>

				<section className="mt-24">
					<SectionTitle
						id="social"
						kicker="Social pulse"
						title="What people are posting"
					/>
					<SocialFeed />
				</section>

				<section className="mt-24">
					<SectionTitle
						kicker="Beyond social"
						title="Maps, shops and ads around the story"
					/>
					<BeyondSocial />
				</section>

				<section className="mt-24">
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

function Card({ e }: { e: EventView }) {
	const next = e.phase === "upcoming";
	return (
		<article
			id={e.id}
			className={`grid scroll-mt-24 grid-cols-1 overflow-hidden rounded-2xl border bg-zinc-900/30 sm:grid-cols-[1fr_220px] ${
				next
					? "border-amber-400/30"
					: e.major
						? "border-emerald-400/30"
						: "border-zinc-800"
			}`}
		>
			<div className="flex flex-col gap-3 p-5">
				<div className="flex items-center gap-2 text-xs">
					<time className="font-mono text-zinc-300">{e.when}</time>
					<span
						className={`rounded-full px-2 py-0.5 ${next ? "bg-amber-400/10 text-amber-300" : e.major ? "bg-emerald-400/10 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}
					>
						{PHASE[e.phase]}
					</span>
				</div>
				<h3 className="text-lg leading-snug font-semibold">{e.title}</h3>
				<p className="text-sm leading-relaxed text-zinc-400">{e.detail}</p>
				<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
					{e.sources.map((s) => (
						<a
							key={s.url}
							href={s.url}
							target="_blank"
							rel="noreferrer"
							className="text-zinc-400 hover:text-emerald-300"
						>
							{s.label} ↗
						</a>
					))}
					{e.posts.length > 0 && (
						<a href="#social" className="text-zinc-500 hover:text-zinc-200">
							· {e.posts.length} posts that day
						</a>
					)}
				</div>
				<div className="mt-auto border-t border-zinc-800/80 pt-3">
					<TelemCredits credits={e.credits} />
				</div>
			</div>
			{e.image && (
				<RemoteImage
					src={e.image.src}
					alt={e.title}
					className="h-48 w-full bg-zinc-900 object-cover sm:h-full"
				/>
			)}
		</article>
	);
}

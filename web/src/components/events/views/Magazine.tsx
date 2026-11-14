import { ScrollRail } from "#/components/events/ScrollRail";
import {
	KeyFacts,
	Methodology,
	PostCard,
	SectionTitle,
	SocialFeed,
	TelemStrip,
} from "#/components/events/Sections";
import { RemoteImage, TelemCredits } from "#/components/events/Telem";
import { type EventView, events, PHASE } from "#/data/jensen-huang-view";

const hero =
	events.find((e) => e.major && e.image && e.phase !== "upcoming") ?? events[0];

type Day = { id: string; when: string; events: EventView[] };
const days: Day[] = [];
for (const e of events) {
	if (e === hero) continue;
	const last = days.at(-1);
	if (last && last.when === e.when) last.events.push(e);
	else days.push({ id: `day-${e.date}`, when: e.when, events: [e] });
}

const rail = [
	{
		id: "hero",
		label: hero.title,
		detail: hero.detail,
		kicker: `${hero.when} · Lead`,
		major: true,
		tag: hero.tag,
	},
	...days.map((d) => ({
		id: d.id,
		label: d.events[0].title,
		detail:
			d.events.length > 1
				? `+${d.events.length - 1} more: ${d.events
						.slice(1)
						.map((e) => e.title)
						.join(" · ")}`
				: d.events[0].detail,
		kicker: `${d.when} · ${PHASE[d.events[0].phase]}`,
		major: d.events.some((e) => e.major),
		tag: d.events[0].tag,
	})),
];

export function Magazine() {
	return (
		<main className="min-h-screen bg-zinc-950 pb-28 text-zinc-100 antialiased">
			<ScrollRail items={rail} />

			<section
				id="hero"
				className="relative scroll-mt-16 overflow-hidden border-b border-zinc-800"
			>
				{hero.image && (
					<RemoteImage
						src={hero.image.src}
						alt=""
						className="absolute inset-0 h-full w-full object-cover opacity-40"
					/>
				)}
				<div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-zinc-950/20" />
				<div className="relative mx-auto flex min-h-[520px] max-w-6xl flex-col justify-end gap-5 px-4 py-14 sm:px-6">
					<span className="text-xs font-medium tracking-wider text-emerald-400 uppercase">
						{hero.when} · Latest major development
					</span>
					<h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
						{hero.title}
					</h1>
					<p className="max-w-2xl text-lg leading-relaxed text-zinc-300">
						{hero.detail}
					</p>
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
						<TelemCredits credits={hero.credits} />
						{hero.image && (
							<span className="text-[11px] text-zinc-500">
								Image: {hero.image.from}
							</span>
						)}
					</div>
				</div>
			</section>

			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="mt-10 flex flex-col gap-4">
					<TelemStrip />
					<KeyFacts />
				</div>

				{days.map((d) => (
					<DaySection key={d.id} day={d} />
				))}

				<section className="mt-24">
					<SectionTitle
						id="social"
						kicker="Social pulse"
						title="Everything people posted"
					/>
					<SocialFeed />
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

function DaySection({ day }: { day: Day }) {
	const posts = day.events.flatMap((e) => e.posts);
	const unique = [...new Map(posts.map((p) => [p.id, p])).values()]
		.sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)))
		.slice(0, 3);
	return (
		<section id={day.id} className="mt-16 scroll-mt-20">
			<div className="mb-5 flex items-baseline gap-4 border-b border-zinc-800 pb-3">
				<h2 className="font-mono text-2xl text-emerald-400">{day.when}</h2>
				<span className="text-sm text-zinc-500">
					{day.events.length} event{day.events.length > 1 ? "s" : ""}
					{unique.length > 0 && ` · ${posts.length} posts`}
				</span>
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{day.events.map((e, i) => (
					<StoryCard key={e.id} e={e} wide={i === 0 && e.major} />
				))}
				{unique.map((p) => (
					<PostCard key={p.id} post={p} />
				))}
			</div>
		</section>
	);
}

function StoryCard({ e, wide }: { e: EventView; wide: boolean }) {
	return (
		<article
			className={`flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 ${wide ? "md:col-span-2" : ""}`}
		>
			{e.image && (
				<RemoteImage
					src={e.image.src}
					alt={e.title}
					className={`w-full bg-zinc-900 object-cover ${wide ? "aspect-[2/1]" : "aspect-[16/9]"}`}
				/>
			)}
			<div className="flex flex-1 flex-col gap-3 p-5">
				<span
					className={`text-xs ${e.phase === "upcoming" ? "text-amber-300" : "text-zinc-500"}`}
				>
					{PHASE[e.phase]}
				</span>
				<h3
					className={`leading-snug font-semibold ${wide ? "text-2xl" : "text-lg"}`}
				>
					{e.title}
				</h3>
				<p className="text-sm leading-relaxed text-zinc-400">{e.detail}</p>
				<div className="flex flex-wrap gap-x-3 text-xs">
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
				</div>
				<div className="mt-auto border-t border-zinc-800/80 pt-3">
					<TelemCredits credits={e.credits} compact />
				</div>
			</div>
		</article>
	);
}

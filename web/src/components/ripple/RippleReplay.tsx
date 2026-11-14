import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { TelemCredits } from "#/components/events/Telem";
import {
	getRippleStory,
	type RippleEvent,
	type RipplePost,
	type RippleStory,
} from "#/server/ripple";
import {
	buildModel,
	etClock,
	etDayLong,
	etShort,
	fmtPct,
	STANCE_COLOR,
} from "./replay";
import { mountStage, type StageHandle } from "./stage";

const STAGE = "relative h-[430px] sm:h-[440px]";
// Lets a card's Telem credits run on one wrapping line instead of one row each.
const INLINE = "[&>div]:flex-row [&>div]:flex-wrap [&>div]:gap-x-4";
const CSS = `
@keyframes ripple-card { from { opacity: 0; transform: translateY(12px) scale(0.985) } to { opacity: 1; transform: none } }
@keyframes ripple-row { from { grid-template-rows: 0fr; opacity: 0 } to { grid-template-rows: 1fr; opacity: 1 } }
.ripple-card { animation: ripple-card 450ms cubic-bezier(0.2, 0.7, 0.2, 1) both }
.ripple-row { display: grid; animation: ripple-row 320ms ease-out both }
@media (prefers-reduced-motion: reduce) { .ripple-card, .ripple-row { animation: none } }
`;

// One week of the Jensen Huang story on a single clock: NVDA minute by minute on top, each
// dated event as a card below, and every timestamped post landing on its platform's lane.
export function RippleReplayView() {
	const [story, setStory] = useState<RippleStory | null>(null);
	const [err, setErr] = useState(false);
	useEffect(() => {
		let live = true;
		getRippleStory()
			.then((s) => live && setStory(s))
			.catch(() => live && setErr(true));
		return () => {
			live = false;
		};
	}, []);
	if (!story)
		return (
			<div className="flex h-[1150px] items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/30 text-sm text-zinc-500 lg:h-[870px]">
				{err ? "Replay data unavailable" : "Loading replay…"}
			</div>
		);
	return <Replay story={story} />;
}

const put = (el: HTMLElement | null, text: string) => {
	if (el && el.textContent !== text) el.textContent = text;
};
const tint = (el: HTMLElement | null, pct: number) => {
	if (el) el.dataset.down = String(pct < 0);
};
const PCT = "text-emerald-300 data-[down=true]:text-rose-300";

function Replay({ story }: { story: RippleStory }) {
	const model = useMemo(() => buildModel(story), [story]);
	const canvas = useRef<HTMLCanvasElement>(null);
	const handle = useRef<StageHandle | null>(null);
	const clock = useRef<HTMLSpanElement>(null);
	const market = useRef<HTMLSpanElement>(null);
	const price = useRef<HTMLSpanElement>(null);
	const since = useRef<HTMLSpanElement>(null);
	const onDay = useRef<HTMLSpanElement>(null);
	const range = useRef<HTMLInputElement>(null);
	const [view, setView] = useState({ day: 0, shown: 0, playing: false });

	useEffect(() => {
		const el = canvas.current;
		if (!el) return;
		const h = mountStage(el, model, {
			reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
			onTick(t, p, playing) {
				const c = model.bars[model.barAt(t)].c;
				const day = model.dayAt(t);
				const d = story.days[day];
				const pct = (c / story.baseline - 1) * 100;
				put(clock.current, `${etClock.format(t)} ET`);
				put(market.current, model.marketState(t));
				put(price.current, `$${c.toFixed(2)}`);
				put(since.current, fmtPct(pct));
				tint(since.current, pct);
				const dayPct = d.prevClose ? (c / d.prevClose - 1) * 100 : 0;
				put(onDay.current, d.session ? `NVDA ${fmtPct(dayPct)}` : "No session");
				tint(onDay.current, d.session ? dayPct : 0);
				if (range.current) range.current.value = String(Math.round(p * 1000));
				const shown = model.shownAt(t);
				setView((v) =>
					v.day === day && v.shown === shown && v.playing === playing
						? v
						: { day, shown, playing },
				);
			},
		});
		handle.current = h;
		return () => {
			h.dispose();
			handle.current = null;
		};
	}, [model, story]);

	const { day, shown, playing } = view;
	const d = story.days[day];
	const events = model.eventsByDay[day];
	const today = model.platforms.map(() => 0);
	for (let i = shown - 1; i >= 0 && story.posts[i].t >= d.start; i--)
		today[model.lane[i]]++;
	const feed = story.posts.slice(Math.max(0, shown - 4), shown).reverse();

	return (
		<div className="flex flex-col gap-3">
			<style>{CSS}</style>
			<div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30 has-[input:focus-visible]:border-sky-400/70">
				<div
					className={`${STAGE} bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.07),transparent_60%)]`}
				>
					<canvas
						ref={canvas}
						className="absolute inset-0 h-full w-full cursor-ew-resize touch-pan-y select-none"
					/>
					<div className="pointer-events-none absolute top-3 right-14 left-3 flex flex-wrap items-baseline gap-x-5 gap-y-0.5 sm:left-4">
						<span className="flex items-baseline gap-x-2 text-sm">
							<span ref={clock} className="font-medium text-zinc-100" />
							<span ref={market} className="text-xs text-zinc-500" />
						</span>
						<span className="font-mono text-xs text-zinc-400">
							NVDA <span ref={price} className="text-zinc-100" />{" "}
							<span ref={since} className={PCT} /> since Nov 6 close
						</span>
						<span className="text-xs text-zinc-500">
							<span className="font-mono text-sky-300">{shown}</span> /{" "}
							{story.posts.length} posts found with Telem
						</span>
					</div>
					<button
						type="button"
						onClick={() => handle.current?.setPlaying(!playing)}
						aria-label={playing ? "Pause replay" : "Play replay"}
						className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/70 text-xs text-zinc-200 hover:border-sky-400/60"
					>
						<svg
							viewBox="0 0 12 12"
							className="h-3 w-3 fill-current"
							aria-hidden="true"
						>
							<path
								d={playing ? "M2 1h3v10H2zM7 1h3v10H7z" : "M3 1l8 5-8 5z"}
							/>
						</svg>
					</button>
					<input
						ref={range}
						type="range"
						min={0}
						max={1000}
						defaultValue={0}
						onChange={(e) =>
							handle.current?.seek(Number(e.target.value) / 1000)
						}
						aria-label="Replay position"
						className="sr-only"
					/>
				</div>

				<div className="border-t border-zinc-800">
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-800/70 px-3 py-3 sm:px-4">
						<h3 className="text-lg font-semibold tracking-tight">
							{etDayLong.format(d.start)}
						</h3>
						<span className="text-xs text-zinc-500">
							<span ref={onDay} className={`font-mono text-sm ${PCT}`} />
							{d.session ? " vs prior close" : " · weekend"}
						</span>
						<ul className="flex flex-wrap gap-1.5 text-xs sm:ml-auto">
							{model.platforms.map((name, k) => (
								<li
									key={name}
									className={`rounded-full border px-2 py-0.5 ${today[k] ? "border-sky-400/40 text-zinc-200" : "border-zinc-800 text-zinc-600"}`}
								>
									{name}{" "}
									<span className="inline-block min-w-[1.1em] text-right font-mono tabular-nums">
										{today[k]}
									</span>
								</li>
							))}
						</ul>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-12">
						<div className="flex h-[26.5rem] flex-col gap-2 overflow-hidden px-3 py-3 sm:h-[23.5rem] sm:px-4 lg:col-span-5 lg:border-r lg:border-zinc-800/70">
							<Label>
								What happened
								<span className="text-zinc-600 normal-case tracking-normal">
									{" "}
									· sources give the date only
								</span>
							</Label>
							<div key={d.date} className="ripple-card flex flex-col gap-2.5">
								{events.map((e) => (
									<EventCard key={e.id} e={e} solo={events.length === 1} />
								))}
							</div>
						</div>
						<div className="flex h-[24rem] flex-col gap-2 overflow-hidden border-t border-zinc-800/70 px-3 py-3 sm:h-[23.5rem] sm:px-4 lg:col-span-7 lg:border-t-0">
							<Label>
								Where it spread
								<span className="text-zinc-600 normal-case tracking-normal">
									{" "}
									· newest post first, at its publish time
								</span>
							</Label>
							{feed.length ? (
								<div className="flex flex-col [mask-image:linear-gradient(to_bottom,black_82%,transparent)]">
									{feed.map((p) => (
										<div key={`${p.t}-${p.url}`} className="ripple-row">
											<div className="min-h-0 overflow-hidden">
												<PostRow p={p} />
											</div>
										</div>
									))}
								</div>
							) : (
								<p className="text-sm text-zinc-500">
									No posts yet. The first one lands{" "}
									{etShort.format(story.posts[0].t)} ET.
								</p>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
				{Object.entries(STANCE_COLOR).map(([k, c]) => (
					<span key={k} className="flex items-center gap-1.5">
						<span className="h-2 w-2 rounded-full" style={{ background: c }} />
						{k}
					</span>
				))}
				<span className="flex items-center gap-1.5">
					<span className="h-2 w-2 rounded-full bg-amber-400" />
					event
				</span>
				<span>bright line: regular session · thin: pre/after-hours</span>
			</div>
			<p className="max-w-4xl text-xs leading-relaxed text-zinc-500">
				{story.posts.length} of the {story.totalPosts} relevant posts Telem
				Search found carry a publish time inside Nov 8–14; each sits at that
				minute. Event cards come from dated news reports with no time of day, so
				a card appears when its US Eastern day starts. Prices are Yahoo Finance
				1-minute NVDA bars including pre-market and after-hours, not from Telem.
				The time axis is stretched where posts and price moves cluster and
				squeezed where nothing happened. Drag the chart to scrub.
			</p>
		</div>
	);
}

function Label({ children }: { children: React.ReactNode }) {
	return (
		<span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
			{children}
		</span>
	);
}

function EventCard({ e, solo }: { e: RippleEvent; solo: boolean }) {
	return (
		<article className="flex flex-col gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.04] p-3">
			<div className="flex gap-3">
				{e.image && (
					<img
						src={e.image.src}
						alt=""
						title={`Image: ${e.image.from}`}
						className="h-[4.5rem] w-24 shrink-0 rounded-lg object-cover"
					/>
				)}
				<div className="flex min-w-0 flex-col gap-1.5">
					<Link
						to="/events/jensen-huang"
						hash={e.id}
						className="font-medium leading-snug text-zinc-100 hover:text-amber-200"
					>
						{e.title}
					</Link>
					<p className="text-xs leading-relaxed text-zinc-500">
						Reported by{" "}
						{e.sources.map((s, i) => (
							<span key={s.url}>
								{i > 0 && ", "}
								<a
									href={s.url}
									target="_blank"
									rel="noreferrer"
									className="text-zinc-300 underline decoration-zinc-700 underline-offset-2 hover:text-amber-200"
								>
									{s.label}
								</a>
							</span>
						))}
					</p>
				</div>
			</div>
			{solo && (
				<p className="line-clamp-6 text-sm leading-relaxed text-zinc-400">
					{e.detail}
				</p>
			)}
			<div className={solo ? "" : INLINE}>
				<TelemCredits credits={e.credits} />
			</div>
		</article>
	);
}

function PostRow({ p }: { p: RipplePost }) {
	return (
		<a
			href={p.url}
			target="_blank"
			rel="noreferrer"
			className="mb-2 flex gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-2.5 py-2 hover:border-zinc-600"
		>
			{p.image && (
				<img
					src={p.image}
					alt=""
					className="h-14 w-14 shrink-0 rounded-lg object-cover"
				/>
			)}
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<div className="flex items-center gap-2 text-xs">
					<span
						className="h-2 w-2 shrink-0 rounded-full"
						style={{ background: STANCE_COLOR[p.stance] }}
					/>
					<span className="font-medium text-zinc-200">{p.platform}</span>
					<span className="text-zinc-500">{p.stance}</span>
					<span className="ml-auto shrink-0 font-mono text-zinc-500">
						{etShort.format(p.t)} ET
					</span>
				</div>
				<p className="truncate text-sm text-zinc-300">{p.title}</p>
				<div className={INLINE}>
					<TelemCredits credits={p.credits} />
				</div>
			</div>
		</a>
	);
}

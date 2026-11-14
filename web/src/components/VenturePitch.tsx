import { BRAND } from "#/brand";
import {
	COMPARE,
	PRICE_MO,
	RUN_COST,
	RUN_SECONDS,
	RUNS_INCLUDED,
	SIZING,
	SOURCES,
} from "#/data/venture-pitch";

/* The investor screen on the home page, hung like the /telem gallery but in
   ink wash: one painting, one sentence, a price list against the incumbents,
   then market size and why now. Numbers and sources live in venture-pitch.ts. */

const vars = {
	"--paper": "#f3ede1",
	"--ink": "#1c1a17",
	"--muted": "#6b645a",
	"--rule": "#d8cfbe",
	"--seal": "#b0362a",
} as React.CSSProperties;

const KICKER =
	"font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] sm:text-[11px]";

export function VenturePitch() {
	const margin = Math.round((1 - (RUNS_INCLUDED * RUN_COST) / PRICE_MO) * 100);
	return (
		<section
			id="pitch"
			style={vars}
			className="-mx-4 scroll-mt-20 bg-[var(--paper)] px-5 py-12 text-[var(--ink)] sm:mx-0 sm:rounded-2xl sm:px-10 sm:py-16"
		>
			<div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
				<div className="flex flex-col gap-5">
					<span className={KICKER}>The business · 生意</span>
					<h2 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
						Terminal-grade answers at{" "}
						<em className="text-[var(--seal)]">1/27</em> the price.
					</h2>
					<p className="max-w-xl leading-relaxed text-[var(--muted)]">
						Event-driven desks pay for the first minutes after a headline.{" "}
						{BRAND} tells them whether it is real, who said it first and what it
						hits, with Chinese social posts on the same clock as the price. We
						sell it as the second screen next to the Terminal, not a
						replacement.
					</p>
					<dl className="grid grid-cols-3 gap-4 border-t border-[var(--rule)] pt-5">
						<Fact v={`$${PRICE_MO}`} l="per seat / month" />
						<Fact v={`$${RUN_COST.toFixed(2)}`} l="measured cost / run" />
						<Fact v={`${margin}%`} l={`margin at ${RUNS_INCLUDED} runs`} />
					</dl>
				</div>
				<figure className="flex flex-col gap-2">
					<img
						src="/art/pitch/river.webp"
						alt="Chinese ink wash painting: three heavy junks drift on a misty river while one small boat ahead leaves ripples across the water."
						className="w-full rounded-sm shadow-[0_1px_0_var(--rule)]"
						loading="lazy"
						width={1200}
						height={800}
					/>
					<figcaption className="text-xs italic text-[var(--muted)]">
						Three heavy junks, one light boat. Its ripples cross the whole
						river.
					</figcaption>
				</figure>
			</div>

			<div className="mt-14 flex flex-col gap-4">
				<span className={KICKER}>How it compares · 比较</span>
				<ul className="flex flex-col">
					{COMPARE.map((c) => (
						<li
							key={c.name}
							className={`grid grid-cols-1 gap-1 border-b border-[var(--rule)] py-4 sm:grid-cols-[12rem_11rem_1fr] sm:gap-6 ${c.us ? "text-[var(--ink)]" : ""}`}
						>
							<span className="flex items-center gap-2 font-serif text-lg">
								{c.us && (
									<span className="inline-block h-2 w-2 rounded-full bg-[var(--seal)]" />
								)}
								{c.name}
							</span>
							<span
								className={`font-mono text-sm sm:pt-1 ${c.us ? "font-semibold text-[var(--seal)]" : c.price === "not public" ? "italic text-[var(--muted)]" : ""}`}
							>
								{c.price}
							</span>
							<span className="text-sm leading-relaxed text-[var(--muted)] sm:pt-0.5">
								{c.line}
							</span>
						</li>
					))}
				</ul>
			</div>

			<div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-2">
				<div className="flex flex-col gap-4">
					<span className={KICKER}>How big · 规模, bottom-up</span>
					<ol className="flex flex-col">
						{SIZING.map((s) => (
							<li
								key={s.label}
								className="flex items-baseline justify-between gap-4 border-b border-[var(--rule)] py-3"
							>
								<span className="text-sm">
									{s.label}
									<span className="block text-xs text-[var(--muted)]">
										{s.note}
									</span>
								</span>
								<span className="shrink-0 font-mono">{s.value}</span>
							</li>
						))}
					</ol>
				</div>
				<div className="flex flex-col gap-4">
					<span className={KICKER}>Why now · 时机</span>
					<ul className="flex flex-col gap-4 text-sm leading-relaxed text-[var(--muted)]">
						<li>
							<b className="font-medium text-[var(--ink)]">
								One API, 37 platforms.
							</b>{" "}
							Telem puts X, Reddit and 8 Chinese platforms behind one key.
							Before, each was its own scraper and login.
						</li>
						<li>
							<b className="font-medium text-[var(--ink)]">
								Agents got cheap enough to run per headline.
							</b>{" "}
							One measured run: {RUN_SECONDS} seconds and ${RUN_COST.toFixed(2)}{" "}
							in model and search fees. The same headline is cached for every
							customer after the first run.
						</li>
						<li>
							<b className="font-medium text-[var(--ink)]">
								Social moves prices in minutes.
							</b>{" "}
							In the replay above, the first resignation post landed about 3
							minutes after NVDA started to fall.
						</li>
					</ul>
				</div>
			</div>

			<p className="mt-12 text-[11px] leading-relaxed text-[var(--muted)]">
				Sources:{" "}
				{SOURCES.map((s, i) => (
					<span key={s.href}>
						{i > 0 && " · "}
						<a
							href={s.href}
							target="_blank"
							rel="noreferrer"
							className="underline decoration-[var(--rule)] underline-offset-2 hover:text-[var(--ink)]"
						>
							{s.label}
						</a>
					</span>
				))}
				. Competitor lines describe their public pages; "not public" means no
				published price. Painting generated for this page.
			</p>
		</section>
	);
}

function Fact({ v, l }: { v: string; l: string }) {
	return (
		<div className="flex flex-col gap-1">
			<dt className="font-serif text-2xl sm:text-3xl">{v}</dt>
			<dd className="text-xs text-[var(--muted)]">{l}</dd>
		</div>
	);
}

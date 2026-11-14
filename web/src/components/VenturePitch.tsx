import { Link } from "@tanstack/react-router";
import { BRAND } from "#/brand";
import {
	PRO_MO,
	REASONS,
	RUN_COST,
	RUN_COUNT,
	RUN_SECONDS,
	SIZING,
	SOURCES,
} from "#/data/venture-pitch";

/* The investor screen on the home page, hung like the /telem gallery but in
   ink wash: one painting, one sentence, why us, then market size and why now.
   The full comparison lives on /pricing. Numbers live in venture-pitch.ts. */

export const inkVars = {
	"--paper": "#f3ede1",
	"--ink": "#1c1a17",
	"--muted": "#6b645a",
	"--rule": "#d8cfbe",
	"--seal": "#b0362a",
} as React.CSSProperties;

export const KICKER =
	"font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] sm:text-[11px]";

export function Painting() {
	return (
		<figure className="flex flex-col gap-2">
			<img
				src="/art/pitch/river.webp"
				alt="Ink wash painting: three heavy junks drift on a misty river while one small boat ahead leaves ripples across the water."
				className="w-full rounded-sm"
				loading="lazy"
				width={1200}
				height={800}
			/>
			<figcaption className="text-xs italic text-[var(--muted)]">
				Three heavy junks, one light boat. Its ripples cross the whole river.
			</figcaption>
		</figure>
	);
}

export function Sources() {
	return (
		<p className="text-[11px] leading-relaxed text-[var(--muted)]">
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
			. "—" means the capability is not advertised on their public pages;
			"Quote" means no published price. Painting generated for this page.
		</p>
	);
}

export function VenturePitch() {
	return (
		<section
			id="pitch"
			style={inkVars}
			className="-mx-4 scroll-mt-20 bg-[var(--paper)] px-5 py-12 text-[var(--ink)] sm:mx-0 sm:rounded-2xl sm:px-10 sm:py-16"
		>
			<div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
				<div className="flex flex-col gap-5">
					<span className={KICKER}>Why {BRAND}</span>
					<h2 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
						Terminal-grade answers at{" "}
						<em className="text-[var(--seal)]">1/54</em> the price.
					</h2>
					<p className="max-w-xl leading-relaxed text-[var(--muted)]">
						Event-driven desks pay for the first minutes after a headline. A
						Terminal gives them the wire. {BRAND} gives them the answer: is it
						real, who said it first, what does it hit.
					</p>
					<dl className="grid grid-cols-3 gap-4 border-t border-[var(--rule)] pt-5">
						<Fact v={`$${PRO_MO}`} l="per seat / month" />
						<Fact v={`${RUN_SECONDS} s`} l="median, headline to brief" />
						<Fact v="60%" l="gross margin on every plan" />
					</dl>
				</div>
				<Painting />
			</div>

			<ol className="mt-14 grid grid-cols-1 gap-8 border-t border-[var(--rule)] pt-10 md:grid-cols-3">
				{REASONS.map((r, i) => (
					<li key={r.t} className="flex flex-col gap-2">
						<span className="font-mono text-xs text-[var(--seal)]">
							{String(i + 1).padStart(2, "0")}
						</span>
						<span className="font-serif text-xl">{r.t}</span>
						<p className="text-sm leading-relaxed text-[var(--muted)]">{r.b}</p>
					</li>
				))}
			</ol>
			<Link
				to="/pricing"
				className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--paper)] hover:bg-[var(--seal)]"
			>
				Pricing and the full comparison →
			</Link>

			<div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-2">
				<div className="flex flex-col gap-4">
					<span className={KICKER}>How big, bottom-up</span>
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
					<span className={KICKER}>Why now</span>
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
							Across {RUN_COUNT} runs: {RUN_SECONDS} seconds median and about $
							{RUN_COST.toFixed(2)} in model and search fees. The same headline
							is cached for every customer after the first run.
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

			<div className="mt-12">
				<Sources />
			</div>
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

import { Link } from "@tanstack/react-router";
import { BRAND } from "#/brand";
import {
	COMPARE,
	PRO_MO,
	PRODUCT_SHORT,
	RUN_SECONDS,
	SOURCES,
} from "#/data/venture-pitch";

/* The investor screen on the home page, in the site's dark theme: one line,
   a four-row comparison, and the way to /pricing. Numbers live in venture-pitch.ts. */

export function Sources() {
	return (
		<p className="text-[11px] leading-relaxed text-zinc-500">
			Sources:{" "}
			{SOURCES.map((s, i) => (
				<span key={s.href}>
					{i > 0 && " · "}
					<a
						href={s.href}
						target="_blank"
						rel="noreferrer"
						className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-100"
					>
						{s.label}
					</a>
				</span>
			))}
			. "—" means the capability is not advertised on their public pages;
			"Quote" means no published price.
		</p>
	);
}

function PricingCta() {
	return (
		<Link
			to="/pricing"
			className="inline-flex items-center gap-2 self-start rounded-xl bg-emerald-400 px-6 py-3 text-base font-medium text-zinc-950 hover:bg-emerald-300"
		>
			See pricing →
		</Link>
	);
}

export function VenturePitch() {
	return (
		<section id="pitch" className="flex scroll-mt-20 flex-col gap-8">
			<div className="flex flex-col gap-4">
				<span className="text-xs font-medium uppercase tracking-wider text-emerald-400">
					Why {BRAND}
				</span>
				<h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
					Terminal-grade answers at 1/54 the price.
				</h2>
				<p className="max-w-2xl leading-relaxed text-zinc-400">
					A sourced brief in {RUN_SECONDS} seconds median, with the Chinese
					social posts the incumbents don't carry. From ${PRO_MO} a month.
				</p>
				<PricingCta />
			</div>
			<Compare />
			<PricingCta />
			<Sources />
		</section>
	);
}

// Five narrow columns fit at 375 px: product names wrap, cells are short.
function Compare() {
	const cols =
		"grid grid-cols-[1.2fr_repeat(5,minmax(0,1fr))] gap-x-1.5 sm:gap-x-4";
	return (
		<div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11px] sm:px-6 sm:text-sm">
			<div className={`${cols} border-b border-zinc-700 py-3`}>
				<span />
				{PRODUCT_SHORT.map((p, i) => (
					<span
						key={p}
						className={`text-center text-[10px] font-medium leading-tight sm:text-sm ${i === 0 ? "text-emerald-400" : "text-zinc-400"}`}
					>
						{p}
					</span>
				))}
			</div>
			{COMPARE.map((r) => (
				<div
					key={r.label}
					className={`${cols} items-center border-b border-zinc-800 py-3 last:border-0`}
				>
					<span className="leading-snug text-zinc-200">{r.label}</span>
					{r.cells.map((v, i) => (
						<span
							key={PRODUCT_SHORT[i]}
							className={`hyphens-auto text-center leading-tight ${i === 0 ? "font-medium text-emerald-400" : "text-zinc-400"}`}
						>
							{v === "yes" ? (
								"✓"
							) : v === "—" ? (
								<span className="text-zinc-700">—</span>
							) : (
								v
							)}
						</span>
					))}
				</div>
			))}
		</div>
	);
}

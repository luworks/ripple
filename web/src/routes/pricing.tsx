import { createFileRoute } from "@tanstack/react-router";
import { BRAND } from "#/brand";
import { inkVars, KICKER, Painting, Sources } from "#/components/VenturePitch";
import {
	INCLUDED,
	MATRIX,
	PRICE_MO,
	PRODUCTS,
	REASONS,
} from "#/data/venture-pitch";

export const Route = createFileRoute("/pricing")({
	head: () => ({
		meta: [
			{ title: `Pricing · ${BRAND}` },
			{
				name: "description",
				content: `${BRAND} is $${PRICE_MO} per seat per month, every capability included. How it compares with Bloomberg Terminal, Dataminr, AlphaSense and Benzinga Pro.`,
			},
		],
	}),
	component: Pricing,
});

function Pricing() {
	return (
		<main
			style={inkVars}
			className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased"
		>
			<div className="mx-auto flex max-w-6xl flex-col gap-16 px-5 py-14 sm:px-8 sm:py-20">
				<section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
					<div className="flex flex-col gap-5">
						<span className={KICKER}>Pricing</span>
						<h1 className="font-serif text-4xl leading-tight tracking-tight sm:text-6xl">
							One plan. <em className="text-[var(--seal)]">Everything</em> in
							it.
						</h1>
						<p className="max-w-xl leading-relaxed text-[var(--muted)]">
							No tiers, no enterprise-only features, no two-year contract. Every
							seat gets the whole product and the same API our own app runs on.
						</p>
						<Plan />
					</div>
					<Painting />
				</section>

				<section className="flex flex-col gap-5">
					<div className="flex flex-col gap-2">
						<span className={KICKER}>Side by side</span>
						<h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
							What you get that they don't advertise.
						</h2>
					</div>
					<Matrix />
				</section>

				<section className="grid grid-cols-1 gap-8 border-t border-[var(--rule)] pt-10 md:grid-cols-3">
					{REASONS.map((r, i) => (
						<div key={r.t} className="flex flex-col gap-2">
							<span className="font-mono text-xs text-[var(--seal)]">
								{String(i + 1).padStart(2, "0")}
							</span>
							<span className="font-serif text-xl">{r.t}</span>
							<p className="text-sm leading-relaxed text-[var(--muted)]">
								{r.b}
							</p>
						</div>
					))}
				</section>

				<Sources />
			</div>
		</main>
	);
}

function Plan() {
	return (
		<div className="flex flex-col gap-4 rounded-sm border border-[var(--rule)] bg-white/40 p-6">
			<div className="flex items-baseline gap-2">
				<span className="font-serif text-5xl">${PRICE_MO}</span>
				<span className="text-sm text-[var(--muted)]">per seat / month</span>
			</div>
			<ul className="flex flex-col gap-2 text-sm">
				{INCLUDED.map((x) => (
					<li key={x} className="flex gap-2">
						<span className="text-[var(--seal)]">✓</span>
						<span>{x}</span>
					</li>
				))}
			</ul>
			<span className="text-xs text-[var(--muted)]">
				Launch price. Cancel any month.
			</span>
		</div>
	);
}

function Cell({ v, us }: { v: string; us: boolean }) {
	if (v === "yes")
		return (
			<span
				className={`text-lg ${us ? "text-[var(--seal)]" : "text-[var(--ink)]"}`}
			>
				✓
			</span>
		);
	if (v === "—") return <span className="text-[var(--rule)]">—</span>;
	return (
		<span
			className={us ? "font-medium text-[var(--seal)]" : "text-[var(--muted)]"}
		>
			{v}
		</span>
	);
}

function Matrix() {
	return (
		<div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
			<table className="w-full min-w-[720px] border-collapse text-left text-sm">
				<thead>
					<tr className="border-b border-[var(--ink)]">
						<th className="sticky left-0 bg-[var(--paper)] py-3 pr-4 font-normal" />
						{PRODUCTS.map((p, i) => (
							<th
								key={p}
								className={`px-3 py-3 font-serif text-base font-normal ${i === 0 ? "bg-[var(--seal)] text-[var(--paper)]" : ""}`}
							>
								{p}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{MATRIX.map((r) => (
						<tr key={r.label} className="border-b border-[var(--rule)]">
							<th className="sticky left-0 max-w-[14rem] bg-[var(--paper)] py-3 pr-4 font-normal">
								{r.label}
							</th>
							{r.cells.map((v, i) => (
								<td
									key={PRODUCTS[i]}
									className={`px-3 py-3 ${i === 0 ? "bg-[var(--seal)]/5" : ""}`}
								>
									<Cell v={v} us={i === 0} />
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

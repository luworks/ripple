import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND } from "#/brand";
import { Sources } from "#/components/VenturePitch";
import {
	DESK_MO,
	EVERY_PLAN,
	MATRIX,
	PLANS,
	PRODUCTS,
	RUN_PRICE,
} from "#/data/venture-pitch";

export const Route = createFileRoute("/pricing")({
	head: () => ({
		meta: [
			{ title: `Pricing · ${BRAND}` },
			{
				name: "description",
				content: `${BRAND} plans from free to $${DESK_MO} per seat per month. Every plan gets every capability. How it compares with Bloomberg Terminal, Dataminr, AlphaSense and Benzinga Pro.`,
			},
		],
	}),
	component: Pricing,
});

function Pricing() {
	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
			<div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-14 sm:px-6 sm:py-20">
				<section className="flex flex-col items-center gap-3 text-center">
					<h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
						Pricing
					</h1>
					<p className="max-w-xl text-zinc-400">
						Every plan gets every capability. Plans differ only in how many
						fresh runs they include.
					</p>
				</section>

				<section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
					{PLANS.map((p, i) => (
						<PlanCard
							key={p.name}
							name={p.name}
							tag={p.tag}
							price={p.price}
							note={p.note}
							cta={p.cta}
							featured={p.name === "Pro"}
							lead={
								i === 0 ? null : `Everything in ${PLANS[i - 1].name}, plus:`
							}
							items={
								i === 0
									? [`${p.runs} fresh runs a month`, ...EVERY_PLAN]
									: [
											`${p.runs} fresh runs a month`,
											`Then $${RUN_PRICE.toFixed(2)} a run`,
										]
							}
						/>
					))}
					<PlanCard
						name="API"
						tag="For your own agents"
						price={`$${RUN_PRICE.toFixed(2)}`}
						note="Per fresh run. Cached briefs are free."
						cta="Get an API key"
						lead={null}
						items={[
							"No seat fee",
							"POST /api/research, live events over SSE",
							"The same agent and sources as every plan",
						]}
					/>
				</section>

				<section className="flex flex-col gap-5">
					<h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
						Compare with the incumbents
					</h2>
					<Matrix />
				</section>

				<div className="[&_a:hover]:text-zinc-100 [&_a]:decoration-zinc-700 [&_p]:text-zinc-500">
					<Sources />
				</div>
			</div>
		</main>
	);
}

function PlanCard(p: {
	name: string;
	tag: string;
	price: string;
	note: string;
	cta: string;
	lead: string | null;
	items: string[];
	featured?: boolean;
}) {
	return (
		<div
			className={`flex flex-col gap-5 rounded-2xl border p-6 ${p.featured ? "border-zinc-400 bg-zinc-900" : "border-zinc-800 bg-zinc-900/40"}`}
		>
			<div className="flex flex-col gap-1">
				<span className="text-lg font-semibold">{p.name}</span>
				<span className="text-sm text-zinc-400">{p.tag}</span>
			</div>
			<div className="flex flex-col gap-1">
				<span className="text-4xl font-semibold tracking-tight">{p.price}</span>
				<span className="text-xs text-zinc-500">{p.note}</span>
			</div>
			<Link
				to="/research"
				className={`rounded-lg px-4 py-2 text-center text-sm font-medium ${p.featured ? "bg-zinc-100 text-zinc-950 hover:bg-white" : "border border-zinc-700 hover:bg-zinc-800"}`}
			>
				{p.cta}
			</Link>
			<ul className="flex flex-col gap-2 text-sm text-zinc-300">
				{p.lead && <li className="text-zinc-500">{p.lead}</li>}
				{p.items.map((x, i) => (
					<li key={x} className="flex gap-2">
						<span className="text-zinc-500">✓</span>
						<span className={i === 0 ? "font-medium text-zinc-100" : ""}>
							{x}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function Cell({ v }: { v: string }) {
	if (v === "yes") return <span className="text-zinc-100">✓</span>;
	if (v === "—") return <span className="text-zinc-700">—</span>;
	return <span className="text-zinc-400">{v}</span>;
}

function Matrix() {
	return (
		<div className="overflow-x-auto rounded-2xl border border-zinc-800">
			<table className="w-full min-w-[720px] border-collapse text-left text-sm">
				<thead>
					<tr className="border-b border-zinc-800">
						<th className="sticky left-0 bg-zinc-950 p-4 font-normal" />
						{PRODUCTS.map((p, i) => (
							<th
								key={p}
								className={`p-4 font-medium ${i === 0 ? "bg-zinc-900 text-zinc-100" : "text-zinc-400"}`}
							>
								{p}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{MATRIX.map((r) => (
						<tr
							key={r.label}
							className="border-b border-zinc-800 last:border-0"
						>
							<th className="sticky left-0 max-w-[14rem] bg-zinc-950 p-4 font-normal text-zinc-300">
								{r.label}
							</th>
							{r.cells.map((v, i) => (
								<td
									key={PRODUCTS[i]}
									className={`p-4 ${i === 0 ? "bg-zinc-900" : ""}`}
								>
									<Cell v={v} />
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

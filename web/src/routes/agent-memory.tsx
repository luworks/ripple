import { createFileRoute } from "@tanstack/react-router";
import { SearchChart } from "#/components/agent-memory/SearchChart";
import { getDetail, getSeries, getStrata } from "#/server/agent-memory/strata";

export const Route = createFileRoute("/agent-memory")({
	loader: async () => {
		const [strata, series, detail] = await Promise.all([
			getStrata(),
			getSeries({ data: { grain: "day" } }),
			getDetail({ data: { grain: "day" } }),
		]);
		return { strata, series, detail };
	},
	head: () => ({ meta: [{ title: "Agent Memory · brain0" }] }),
	component: AgentMemory,
});

const fmt = new Intl.NumberFormat("en-US");

function AgentMemory() {
	const { strata, series, detail } = Route.useLoaderData();
	const first = new Date(`${strata.first}T12:00:00Z`).toLocaleDateString(
		"en-US",
		{ timeZone: "UTC", month: "long", day: "numeric" },
	);

	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
			<div className="mx-auto flex max-w-6xl flex-col gap-20 px-4 pt-14 pb-24 sm:px-6 sm:pt-20">
				<section className="grid grid-cols-1 items-end gap-10 lg:grid-cols-5">
					<div className="flex flex-col gap-6 lg:col-span-3">
						<Kicker>Agent Memory</Kicker>
						<h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
							Every search my agents ran.
							<br />
							<span className="text-sky-400">One memory.</span>
						</h1>
						<p className="max-w-xl text-lg leading-relaxed text-zinc-400">
							Claude Code, Codex and our research agent search the web all day.
							We keep every query and every page they opened in Postgres, hide
							anything private, and add each new Tavily or Telem search the
							moment it runs.
						</p>
					</div>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:col-span-2">
						<Kpi value={fmt.format(strata.searches)} label="searches" />
						<Kpi value={fmt.format(strata.pages)} label="pages opened" />
						<Kpi value={String(strata.machines)} label="machines" />
						<Kpi
							value={fmt.format(strata.saved)}
							label={`web calls saved by memory in ${strata.memoryRuns} runs`}
							accent
						/>
					</div>
				</section>

				<section className="flex flex-col gap-6">
					<div className="flex flex-col gap-3">
						<Kicker>{`Since ${first}`}</Kicker>
						<h2 className="text-3xl font-semibold tracking-tight">
							Every search, and who ran it
						</h2>
						<p className="max-w-2xl text-zinc-400">
							Claude Code and Codex search on their own while they code. Our
							research agent searches Telem first, Tavily as fallback, when
							someone asks on /research. Hover any bar to see where those
							searches went, what they asked, and each session's kept pages.
						</p>
					</div>
					<div className="rounded-2xl border border-zinc-800 p-4 sm:p-6">
						<SearchChart initial={series} initialDetail={detail} />
					</div>
				</section>
			</div>
		</main>
	);
}

function Kicker({ children }: { children: string }) {
	return (
		<span className="text-xs font-medium uppercase tracking-wider text-sky-400">
			{children}
		</span>
	);
}

function Kpi({
	value,
	label,
	accent,
}: {
	value: string;
	label: string;
	accent?: boolean;
}) {
	return (
		<div className="flex flex-col gap-1">
			<span
				className={`font-mono text-2xl ${accent ? "text-emerald-400" : ""}`}
			>
				{value}
			</span>
			<span className="text-xs text-zinc-500">{label}</span>
		</div>
	);
}

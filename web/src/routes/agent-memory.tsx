import { createFileRoute, Link } from "@tanstack/react-router";
import { RecallView } from "#/components/agent-memory/RecallView";
import { TimelineView } from "#/components/agent-memory/TimelineView";
import { getAgentMemoryOverview } from "#/server/agent-memory/overview";

type View = "recall" | "timeline";
type Search = { view?: View; q?: string };

export const Route = createFileRoute("/agent-memory")({
	validateSearch: (s: Record<string, unknown>): Search => ({
		view: s.view === "timeline" ? "timeline" : undefined,
		q: typeof s.q === "string" && s.q.trim() ? s.q.slice(0, 200) : undefined,
	}),
	loader: () => getAgentMemoryOverview(),
	head: () => ({ meta: [{ title: "Agent Memory · brain0" }] }),
	component: AgentMemory,
});

const fmt = new Intl.NumberFormat("en-US");

function AgentMemory() {
	const o = Route.useLoaderData();
	const { view = "recall", q } = Route.useSearch();

	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
			<div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
				<header className="flex flex-col gap-3">
					<span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
						Agent Memory · what my agents read on {o.machines} machines
					</span>
					<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
						Search the web{" "}
						<span className="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">
							your agents already read.
						</span>
					</h1>
					<dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
						<Kpi value={fmt.format(o.searches)} label="agent web searches" />
						<Kpi value={fmt.format(o.sessions)} label="agent sessions" />
						<Kpi value={fmt.format(o.domains)} label="distinct domains" />
						<Kpi
							value={`${o.firstDay?.slice(5) ?? "?"} → ${o.lastDay?.slice(5) ?? "?"}`}
							label={`${o.lastDay?.slice(0, 4) ?? ""} · PT`}
						/>
					</dl>
				</header>

				<nav className="flex gap-1 border-b border-zinc-800 text-sm">
					<Tab to={undefined} active={view === "recall"} q={q}>
						Recall
					</Tab>
					<Tab to="timeline" active={view === "timeline"}>
						Timeline
					</Tab>
					<span className="ml-auto self-center rounded-full border border-emerald-900 px-2 py-0.5 text-xs text-emerald-400">
						● demo-safe
					</span>
				</nav>

				{view === "timeline" ? <TimelineView /> : <RecallView q={q} />}
			</div>
		</main>
	);
}

function Kpi({ value, label }: { value: string; label: string }) {
	return (
		<div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
			<dt className="sr-only">{label}</dt>
			<dd className="text-2xl font-semibold tabular-nums tracking-tight">
				{value}
			</dd>
			<dd className="text-xs text-zinc-500">{label}</dd>
		</div>
	);
}

function Tab({
	to,
	active,
	q,
	children,
}: {
	to: View | undefined;
	active: boolean;
	q?: string;
	children: React.ReactNode;
}) {
	return (
		<Link
			to="/agent-memory"
			search={{ view: to, q }}
			className={`-mb-px border-b-2 px-4 py-2 transition-colors ${active ? "border-sky-400 font-medium text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}
		>
			{children}
		</Link>
	);
}

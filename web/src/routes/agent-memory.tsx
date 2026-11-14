import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DailyStrip } from "#/components/agent-memory/DailyStrip";
import { TodayLane } from "#/components/agent-memory/TodayLane";
import { getStrata, getToday } from "#/server/agent-memory/strata";

export const Route = createFileRoute("/agent-memory")({
	loader: async () => {
		const [strata, today] = await Promise.all([getStrata(), getToday()]);
		return { strata, today };
	},
	head: () => ({ meta: [{ title: "Agent Memory · brain0" }] }),
	component: AgentMemory,
});

const fmt = new Intl.NumberFormat("en-US");
const POLL_MS = 10_000;

function AgentMemory() {
	const { strata, today: initial } = Route.useLoaderData();
	const [today, setToday] = useState(initial);

	// New research-agent searches land in Postgres as they run; poll to show them live.
	useEffect(() => {
		const t = setInterval(() => {
			getToday()
				.then(setToday)
				.catch(() => {});
		}, POLL_MS);
		return () => clearInterval(t);
	}, []);

	const first = new Date(`${strata.days[0].day}T12:00:00Z`).toLocaleDateString(
		"en-US",
		{ timeZone: "UTC", month: "long", day: "numeric" },
	);
	const updated = new Date(today.now).toLocaleTimeString("en-US", {
		timeZone: "America/Los_Angeles",
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
	});

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
					<div className="grid grid-cols-3 gap-4 lg:col-span-2">
						<Kpi value={fmt.format(strata.searches)} label="searches" />
						<Kpi value={fmt.format(strata.pages)} label="pages opened" />
						<Kpi value={String(strata.machines)} label="machines" />
					</div>
				</section>

				<section className="flex flex-col gap-6">
					<div className="flex flex-col gap-3">
						<Kicker>{`Since ${first}`}</Kicker>
						<h2 className="text-3xl font-semibold tracking-tight">
							Searches per day
						</h2>
					</div>
					<div className="rounded-2xl border border-zinc-800 p-6">
						<DailyStrip days={strata.days} />
					</div>
				</section>

				<section className="flex flex-col gap-6">
					<div className="flex flex-wrap items-end justify-between gap-3">
						<div className="flex flex-col gap-3">
							<Kicker>Today</Kicker>
							<h2 className="text-3xl font-semibold tracking-tight">
								What they searched today
							</h2>
						</div>
						<span className="flex items-center gap-2 font-mono text-xs text-emerald-400">
							<span className="relative flex h-2 w-2">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
								<span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
							</span>
							live · {updated} PT
						</span>
					</div>
					<TodayLane today={today} />
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

function Kpi({ value, label }: { value: string; label: string }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="font-mono text-2xl">{value}</span>
			<span className="text-xs text-zinc-500">{label}</span>
		</div>
	);
}

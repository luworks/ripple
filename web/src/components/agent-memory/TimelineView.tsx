import { Link } from "@tanstack/react-router";
import { Suspense, use } from "react";
import {
	getTimeline,
	OTHER_COLOR,
	type TimelineData,
} from "#/server/agent-memory/timeline";
import { type Filters, SessionCard } from "./timeline/SessionCard";
import { SessionFeed } from "./timeline/SessionFeed";
import { WeeklyChart } from "./timeline/WeeklyChart";

type Props = Filters & { session?: string };

// Promise cache keyed by params so `use()` sees a stable promise across renders.
const cache = new Map<string, Promise<TimelineData>>();
function load(p: Props): Promise<TimelineData> {
	const k = JSON.stringify([p.machine, p.agent, p.session]);
	let v = cache.get(k);
	if (!v) {
		if (cache.size > 50) cache.clear();
		v = getTimeline({ data: p });
		v.catch(() => cache.delete(k));
		cache.set(k, v);
	}
	return v;
}

export function TimelineView(props: Props) {
	return (
		<Suspense
			fallback={
				<div className="h-64 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/50" />
			}
		>
			<Timeline {...props} />
		</Suspense>
	);
}

function Timeline({ machine, agent, session }: Props) {
	const d = use(load({ machine, agent, session }));
	const filters = { machine, agent };
	const colors = new Map(d.chart.series.map((s) => [s.key, s.color]));
	const colorOf = (m: string) => colors.get(m) ?? OTHER_COLOR;

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
				<ChipGroup
					label="Machine"
					values={d.machines}
					active={machine}
					to={(v) => ({ machine: v, agent })}
				/>
				<ChipGroup
					label="Agent"
					values={d.agents}
					active={agent}
					to={(v) => ({ machine, agent: v })}
				/>
			</div>

			{session &&
				(d.focus ? (
					<section className="flex flex-col gap-2">
						<Link
							to="/agent-memory"
							search={{ view: "timeline", ...filters }}
							className="self-start text-xs text-zinc-400 hover:text-zinc-200"
						>
							← Back to all
						</Link>
						<SessionCard
							s={d.focus}
							color={colorOf(d.focus.machine)}
							filters={filters}
							expanded
						/>
					</section>
				) : (
					<p className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-500">
						Session not found.{" "}
						<Link
							to="/agent-memory"
							search={{ view: "timeline", ...filters }}
							className="text-zinc-300 underline"
						>
							Back to all
						</Link>
					</p>
				))}

			<WeeklyChart chart={d.chart} />
			<SessionFeed
				key={`${machine}|${agent}`}
				first={d.page}
				filters={filters}
				colorOf={colorOf}
			/>
		</div>
	);
}

function ChipGroup({
	label,
	values,
	active,
	to,
}: {
	label: string;
	values: string[];
	active?: string;
	to: (v: string | undefined) => Filters;
}) {
	const chip = (v: string | undefined, text: string) => (
		<Link
			key={text}
			to="/agent-memory"
			search={{ view: "timeline", ...to(v) }}
			className={`rounded-full border px-2.5 py-1 transition-colors ${active === v ? "border-sky-500 bg-sky-500/10 text-zinc-100" : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"}`}
		>
			{text}
		</Link>
	);
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="mr-1 text-zinc-500">{label}</span>
			{chip(undefined, "All")}
			{values.map((v) => chip(v, v))}
		</div>
	);
}

import { Suspense, use, useState } from "react";
import { chartPromise } from "./recall/data";
import { SearchBox, SearchResults } from "./recall/MemorySearch";
import {
	ChartLegend,
	DayBreakdown,
	TopDomains,
	WeeklyDomainsChart,
} from "./recall/WeeklyDomainsChart";

export function RecallView({ q }: { q?: string }) {
	return (
		<div className="flex flex-col gap-6">
			<Suspense
				fallback={
					<div className="h-[420px] animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/50" />
				}
			>
				<WeeklySection />
			</Suspense>
			<section className="flex flex-col gap-4">
				<div>
					<h2 className="text-lg font-semibold tracking-tight">
						Memory search
					</h2>
					<p className="text-sm text-zinc-500">
						Full-text search over agent web searches and the pages they opened
						next.
					</p>
				</div>
				<SearchBox q={q} />
				<SearchResults q={q} />
			</section>
		</div>
	);
}

function WeeklySection() {
	const chart = use(chartPromise());
	const [selected, setSelected] = useState(chart.days.length - 1);
	if (!chart.days.length)
		return (
			<p className="text-sm text-zinc-500">No activity in the snapshot.</p>
		);
	return (
		<section className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6">
			<div className="flex flex-col gap-1">
				<h2 className="text-lg font-semibold tracking-tight">
					Past 7 days · pages agents read
				</h2>
				<p className="text-xs text-zinc-500">
					URL occurrences per PT day by registrable domain · hidden URLs fold
					into Other · click a day for its breakdown
				</p>
			</div>
			<ChartLegend chart={chart} />
			<WeeklyDomainsChart
				chart={chart}
				selected={selected}
				onSelect={setSelected}
			/>
			<div className="grid gap-6 border-t border-zinc-800 pt-4 sm:grid-cols-2">
				<DayBreakdown chart={chart} day={selected} />
				<TopDomains chart={chart} />
			</div>
		</section>
	);
}

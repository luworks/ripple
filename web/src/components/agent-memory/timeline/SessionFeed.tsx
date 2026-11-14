import { useState } from "react";
import {
	type SessionCard as Card,
	getTimelinePage,
	type TimelinePage,
} from "#/server/agent-memory/timeline";
import { type Filters, SessionCard } from "./SessionCard";

export function SessionFeed({
	first,
	filters,
	colorOf,
}: {
	first: TimelinePage;
	filters: Filters;
	colorOf: (machine: string) => string;
}) {
	const [sessions, setSessions] = useState<Card[]>(first.sessions);
	const [cursor, setCursor] = useState(first.cursor);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function loadMore() {
		if (!cursor) return;
		setLoading(true);
		setError(null);
		try {
			const next = await getTimelinePage({ data: { ...filters, cursor } });
			setSessions((s) => [...s, ...next.sessions]);
			setCursor(next.cursor);
		} catch {
			setError("Could not load more sessions.");
		} finally {
			setLoading(false);
		}
	}

	const days: { day: string; label: string; items: Card[] }[] = [];
	for (const s of sessions) {
		const last = days[days.length - 1];
		if (last?.day === s.day) last.items.push(s);
		else days.push({ day: s.day, label: s.dayLabel, items: [s] });
	}

	if (!sessions.length) {
		return (
			<p className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-500">
				No sessions with web activity for this filter.
			</p>
		);
	}

	return (
		<section className="flex flex-col gap-6">
			{days.map((d) => (
				<div key={d.day} className="flex flex-col gap-3">
					<h3 className="sticky top-0 z-[1] bg-zinc-950/90 py-1 text-xs font-medium uppercase tracking-wider text-zinc-500 backdrop-blur">
						{d.label}
					</h3>
					{d.items.map((s) => (
						<SessionCard
							key={s.key}
							s={s}
							color={colorOf(s.machine)}
							filters={filters}
						/>
					))}
				</div>
			))}
			{error && <p className="text-sm text-rose-400">{error}</p>}
			{cursor && (
				<button
					type="button"
					onClick={loadMore}
					disabled={loading}
					className="self-center rounded-full border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
				>
					{loading ? "Loading…" : "Load more"}
				</button>
			)}
		</section>
	);
}

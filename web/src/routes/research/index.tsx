import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { formatPT } from "#/components/PriceChart";
import { listResearchRuns, startResearchRun } from "#/server/research";

export const Route = createFileRoute("/research/")({
	head: () => ({ meta: [{ title: "Event research · Ripple" }] }),
	loader: () => listResearchRuns(),
	component: ResearchHome,
});

const examples = [
	"Jensen Huang resigns as Nvidia CEO",
	"TSMC halts shipments to a major customer",
	"OpenAI announces IPO filing",
	"Apple misses iPhone sales estimates",
];

const STATUS: Record<string, string> = {
	running: "text-amber-300 border-amber-500/40",
	done: "text-emerald-300 border-emerald-500/40",
	error: "text-rose-300 border-rose-500/40",
};

function ResearchHome() {
	const runs = Route.useLoaderData();
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(q: string) {
		const text = q.trim();
		if (!text || busy) return;
		setBusy(true);
		setError(null);
		try {
			const r = await startResearchRun({ data: { query: text } });
			if (r.ok) navigate({ to: "/research/$id", params: { id: r.id } });
			else setError(r.error);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
			<div className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-16 sm:px-6 sm:py-20">
				<section className="flex flex-col gap-5">
					<span className="w-fit rounded-full border border-zinc-800 px-3 py-1 text-xs tracking-wide text-zinc-400">
						Event research · agent
					</span>
					<h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
						What moved the market?
					</h1>
					<p className="max-w-xl text-lg leading-relaxed text-zinc-400">
						Describe an event. A research agent finds the people, related
						tickers and a timestamped news timeline, then we overlay it on real
						price data. Takes 1–3 minutes.
					</p>
					<form
						className="flex flex-col gap-3 sm:flex-row"
						onSubmit={(e) => {
							e.preventDefault();
							submit(query);
						}}
					>
						<input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							maxLength={300}
							placeholder="e.g. Jensen Huang resigns as Nvidia CEO"
							className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-base outline-none placeholder:text-zinc-600 focus:border-emerald-400/60"
						/>
						<button
							type="submit"
							disabled={busy || !query.trim()}
							className="rounded-xl bg-emerald-400 px-5 py-3 font-medium text-zinc-950 transition-colors hover:bg-emerald-300 disabled:opacity-40"
						>
							{busy ? "Starting…" : "Research"}
						</button>
					</form>
					{error && (
						<p className="rounded-lg border border-rose-500/40 px-4 py-2 text-sm text-rose-300">
							{error}
						</p>
					)}
					<div className="flex flex-wrap gap-2">
						{examples.map((q) => (
							<button
								key={q}
								type="button"
								disabled={busy}
								onClick={() => {
									setQuery(q);
									submit(q);
								}}
								className="rounded-full border border-zinc-800 px-3 py-1 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
							>
								{q}
							</button>
						))}
					</div>
				</section>

				<section>
					<h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-400">
						Recent runs
					</h2>
					{runs.length === 0 ? (
						<p className="text-sm text-zinc-500">No runs yet.</p>
					) : (
						<ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
							{runs.map((r) => (
								<li key={r.id}>
									<Link
										to="/research/$id"
										params={{ id: r.id }}
										className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-zinc-900/60 sm:flex-row sm:items-center sm:gap-4"
									>
										<span className="min-w-0 flex-1">
											<span className="block truncate">
												{r.title ?? r.query}
											</span>
											{r.title && r.title !== r.query && (
												<span className="block truncate text-xs text-zinc-500">
													“{r.query}”
												</span>
											)}
										</span>
										<span className="flex items-center gap-3 text-xs text-zinc-500">
											<span className="font-mono">{formatPT(r.createdAt)}</span>
											{r.durationMs != null && (
												<span className="font-mono">
													{Math.round(r.durationMs / 1000)}s
												</span>
											)}
											<span
												className={`rounded-full border px-2 py-0.5 ${STATUS[r.status]}`}
											>
												{r.status}
											</span>
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</main>
	);
}

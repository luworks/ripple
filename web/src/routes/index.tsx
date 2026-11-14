import { createFileRoute } from "@tanstack/react-router";
import { getDbHealth } from "#/server/health";

export const Route = createFileRoute("/")({
	loader: () => getDbHealth(),
	component: Home,
});

const stack = [
	{ name: "TanStack Start", detail: "React 19 · SSR · file-based routing" },
	{ name: "PostgreSQL", detail: "local instance on dev-host" },
	{ name: "Tailscale", detail: "private, tailnet-only access" },
];

function Home() {
	const health = Route.useLoaderData();

	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
			<div className="mx-auto flex max-w-3xl flex-col gap-16 px-4 py-20 sm:px-6 sm:py-28">
				<header className="flex flex-col gap-6">
					<span className="w-fit rounded-full border border-zinc-800 px-3 py-1 text-xs tracking-wide text-zinc-400">
						Hackathon · 2026
					</span>
					<h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">
						brain<span className="text-emerald-400">0</span>
					</h1>
					<p className="max-w-xl text-lg leading-relaxed text-zinc-400">
						A second brain that starts from zero. The foundation is live: a
						full-stack TanStack Start app talking to PostgreSQL, reachable
						across our tailnet.
					</p>
				</header>

				<section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
					<div className="flex items-center justify-between gap-4">
						<h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
							System status
						</h2>
						<span
							className={`flex items-center gap-2 text-sm ${health.ok ? "text-emerald-400" : "text-rose-400"}`}
						>
							<span
								className={`h-2 w-2 rounded-full ${health.ok ? "bg-emerald-400" : "bg-rose-400"}`}
							/>
							{health.ok ? "All systems go" : "Database unreachable"}
						</span>
					</div>
					<dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
						{health.ok ? (
							<>
								<Stat label="PostgreSQL" value={health.version} />
								<Stat label="Database" value={health.database} />
								<Stat label="Query latency" value={`${health.latencyMs} ms`} />
							</>
						) : (
							<div className="col-span-full break-words font-mono text-rose-300">
								{health.error}
							</div>
						)}
					</dl>
				</section>

				<section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					{stack.map((s) => (
						<div key={s.name} className="rounded-xl border border-zinc-800 p-5">
							<div className="font-medium">{s.name}</div>
							<div className="mt-1 text-sm text-zinc-500">{s.detail}</div>
						</div>
					))}
				</section>

				<footer className="text-xs text-zinc-600">
					brain0 · built with TanStack Start
				</footer>
			</div>
		</main>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt className="text-zinc-500">{label}</dt>
			<dd className="mt-1 font-mono text-zinc-100">{value}</dd>
		</div>
	);
}

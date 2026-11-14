import { Link } from "@tanstack/react-router";

const nav = [
	{ to: "/", label: "Home" },
	{ to: "/research", label: "Research" },
	{ to: "/events/jensen-huang", label: "Jensen Huang event" },
	{ to: "/telem", label: "Telem" },
	{ to: "/tavily", label: "Tavily" },
	{ to: "/stock/nvda", label: "NVDA" },
	{ to: "/agent-memory", label: "Agent Memory" },
] as const;

export function SiteHeader() {
	return (
		<header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 text-zinc-100 backdrop-blur">
			<div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 sm:gap-6 sm:px-6">
				<Link to="/" className="text-lg font-semibold tracking-tight">
					brain<span className="text-emerald-400">0</span>
				</Link>
				<nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">
					{nav.map((n) => (
						<Link
							key={n.to}
							to={n.to}
							activeOptions={{ exact: true }}
							className="whitespace-nowrap rounded-md px-3 py-1.5 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
							activeProps={{ className: "bg-zinc-900 text-zinc-100" }}
						>
							{n.label}
						</Link>
					))}
				</nav>
				<div className="flex shrink-0 items-center gap-3">
					<div className="hidden text-right leading-tight sm:block">
						<div className="text-sm font-medium">sorastats</div>
						<div className="text-xs text-zinc-500">Yuan Lu · Discord</div>
					</div>
					<div className="flex -space-x-3">
						<img
							src="/avatar-discord.webp"
							alt="sorastats Discord avatar"
							width={36}
							height={36}
							className="h-9 w-9 rounded-full object-cover ring-2 ring-zinc-950"
						/>
						<img
							src="/avatar-yuan.webp"
							alt="Yuan Lu"
							width={36}
							height={36}
							className="h-9 w-9 rounded-full object-cover ring-2 ring-zinc-950"
						/>
					</div>
				</div>
			</div>
		</header>
	);
}

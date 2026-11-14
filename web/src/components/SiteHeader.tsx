import { Link } from "@tanstack/react-router";

const nav = [
	{ to: "/", label: "Home" },
	{ to: "/events/jensen-huang", label: "Jensen Huang event" },
] as const;

export function SiteHeader() {
	return (
		<header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 text-zinc-100 backdrop-blur">
			<div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4 sm:px-6">
				<Link to="/" className="text-lg font-semibold tracking-tight">
					brain<span className="text-emerald-400">0</span>
				</Link>
				<nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
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
			</div>
		</header>
	);
}

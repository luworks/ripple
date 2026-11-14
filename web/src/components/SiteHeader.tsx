import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { BRAND } from "#/brand";

// Logo links home, so there is no separate "Home" item.
const nav = [
	{ to: "/events/jensen-huang", label: "Jensen Huang event" },
	{ to: "/stock/nvda", label: "NVDA" },
	{ to: "/research", label: "Research" },
	{ to: "/agent-memory", label: "Agent Memory" },
	{ to: "/telem", label: "Telem" },
	{ to: "/tavily", label: "Tavily" },
] as const;

const linkBase =
	"whitespace-nowrap rounded-md text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100";
const linkActive = { className: "bg-zinc-900 text-zinc-100" };

export function SiteHeader() {
	const [open, setOpen] = useState(false);
	return (
		<header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 text-zinc-100 backdrop-blur">
			{/* Full width; height stays h-16 at every size so sticky offsets (top-16) still line up. */}
			<div className="flex h-16 w-full items-center gap-4 px-4 sm:px-6 lg:gap-6 lg:px-8">
				<Link
					to="/"
					onClick={() => setOpen(false)}
					className="shrink-0 text-lg font-semibold tracking-tight"
				>
					{BRAND}
				</Link>
				<nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm lg:flex">
					{nav.map((n) => (
						<Link
							key={n.to}
							to={n.to}
							className={`${linkBase} px-3 py-1.5`}
							activeProps={linkActive}
						>
							{n.label}
						</Link>
					))}
				</nav>
				<div className="ml-auto flex shrink-0 items-center gap-3">
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
					<Link
						to="/pricing"
						onClick={() => setOpen(false)}
						className={`${linkBase} px-3 py-1.5 text-sm`}
						activeProps={linkActive}
					>
						Pricing
					</Link>
					<button
						type="button"
						aria-label={open ? "Close menu" : "Open menu"}
						aria-expanded={open}
						aria-controls="site-mobile-nav"
						onClick={() => setOpen((v) => !v)}
						className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 lg:hidden"
					>
						<svg
							viewBox="0 0 24 24"
							className="h-5 w-5"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							strokeLinecap="round"
							aria-hidden="true"
						>
							{open ? (
								<path d="M6 6l12 12M18 6L6 18" />
							) : (
								<path d="M4 7h16M4 12h16M4 17h16" />
							)}
						</svg>
					</button>
				</div>
			</div>
			{open && (
				<nav
					id="site-mobile-nav"
					className="grid grid-cols-2 gap-1 border-t border-zinc-800/80 px-4 py-3 text-sm sm:grid-cols-3 sm:px-6 lg:hidden"
				>
					{nav.map((n) => (
						<Link
							key={n.to}
							to={n.to}
							onClick={() => setOpen(false)}
							className={`${linkBase} px-3 py-2.5`}
							activeProps={linkActive}
						>
							{n.label}
						</Link>
					))}
				</nav>
			)}
		</header>
	);
}

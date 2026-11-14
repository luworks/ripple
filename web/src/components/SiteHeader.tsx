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
	{ to: "/pricing", label: "Pricing" },
] as const;

const linkBase =
	"whitespace-nowrap rounded-md text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100";
const linkActive = { className: "bg-zinc-900 text-zinc-100" };

function Partner({
	href,
	logo,
	name,
}: {
	href: string;
	logo: string;
	name: string;
}) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			title={name}
			className="inline-flex items-center gap-2 text-sm font-medium text-zinc-200 hover:text-white"
		>
			<img
				src={logo}
				alt={name}
				width={36}
				height={36}
				className="h-9 w-9 rounded-lg"
			/>
			<span className="hidden xl:inline">{name}</span>
		</a>
	);
}

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
				<div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
					<div className="flex items-center gap-2 sm:gap-3">
						<span className="hidden text-xs leading-tight text-zinc-500 sm:block">
							Powered by
						</span>
						<Partner
							href="https://telem.ai"
							logo="/logos/telem.svg"
							name="Telem"
						/>
						<Partner
							href="https://tavily.com"
							logo="/logos/tavily.svg"
							name="Tavily"
						/>
					</div>
					<span className="h-6 w-px bg-zinc-800" aria-hidden="true" />
					<div className="flex items-center gap-2">
						<span className="text-right text-xs leading-tight text-zinc-500">
							Built by
							<span className="block text-sm font-medium text-zinc-100">
								Yuan Lu
							</span>
						</span>
						<img
							src="/avatar-discord.webp"
							alt="Yuan Lu's Discord avatar"
							width={36}
							height={36}
							className="h-9 w-9 rounded-full object-cover"
						/>
					</div>
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

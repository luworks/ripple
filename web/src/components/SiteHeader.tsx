import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { BRAND } from "#/brand";

// Logo links home, so there is no separate "Home" item.
const nav = [
	{ to: "/events/jensen-huang", label: "Jensen Huang event" },
	{ to: "/stock/nvda", label: "NVDA" },
	{ to: "/research", label: "Research" },
	{ to: "/agent-memory", label: "Agent Memory" },
	{ to: "/telem", label: "Telem", sponsor: true },
	{ to: "/tavily", label: "Tavily", sponsor: true },
	{ to: "/pricing", label: "Pricing" },
] as const;

const linkBase =
	"whitespace-nowrap rounded-md text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100";
const linkActive = { className: "bg-zinc-900 text-zinc-100" };

// Telem and Tavily sponsor the project. On desktop the pill sits at the top-right corner so
// it adds no width to the full-width row; in the mobile menu it sits inline.
const pill =
	"rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 text-[9px] font-medium uppercase leading-[14px] tracking-wide text-amber-300";

function NavLabel({
	n,
	corner,
}: {
	n: (typeof nav)[number];
	corner?: boolean;
}) {
	if (!("sponsor" in n)) return n.label;
	if (corner)
		return (
			<>
				{n.label}
				<span
					className={`pointer-events-none absolute -top-2 -right-2 ${pill}`}
				>
					Sponsor
				</span>
			</>
		);
	return (
		<span className="inline-flex items-center gap-1.5">
			{n.label}
			<span className={pill}>Sponsor</span>
		</span>
	);
}

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

// Every item shows directly from xl (1280px) up; below that the hamburger menu holds them.
function DesktopNav() {
	return (
		<nav className="hidden min-w-0 items-center gap-1 text-sm xl:flex">
			{nav.map((n) => (
				<Link
					key={n.to}
					to={n.to}
					className={`${linkBase} relative px-3 py-1.5`}
					activeProps={linkActive}
				>
					<NavLabel n={n} corner />
				</Link>
			))}
		</nav>
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
				<DesktopNav />
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
					<a
						href="https://github.com/luworks"
						target="_blank"
						rel="noreferrer"
						title="Yuan Lu on GitHub"
						className="group flex items-center gap-2"
					>
						<span className="text-right text-xs leading-tight text-zinc-500">
							Built by
							<span className="block text-sm font-medium text-zinc-100 group-hover:underline">
								Yuan Lu
							</span>
						</span>
						<img
							src="/avatar-discord.webp"
							alt="Yuan Lu's Discord avatar"
							width={36}
							height={36}
							className="h-9 w-9 rounded-full object-cover ring-zinc-600 group-hover:ring-2"
						/>
					</a>
					<button
						type="button"
						aria-label={open ? "Close menu" : "Open menu"}
						aria-expanded={open}
						aria-controls="site-mobile-nav"
						onClick={() => setOpen((v) => !v)}
						className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 xl:hidden"
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
					className="grid grid-cols-2 gap-1 border-t border-zinc-800/80 px-4 py-3 text-sm sm:grid-cols-3 sm:px-6 xl:hidden"
				>
					{nav.map((n) => (
						<Link
							key={n.to}
							to={n.to}
							onClick={() => setOpen(false)}
							className={`${linkBase} px-3 py-2.5`}
							activeProps={linkActive}
						>
							<NavLabel n={n} />
						</Link>
					))}
				</nav>
			)}
		</header>
	);
}

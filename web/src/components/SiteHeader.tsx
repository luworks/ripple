import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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

const GAP = 4; // gap-1 between nav items

// Desktop nav that never scrolls: the items that fit stay in the bar, the rest move
// into a "More" menu. Widths come from an invisible copy of every item.
function DesktopNav() {
	const box = useRef<HTMLDivElement>(null);
	const ruler = useRef<HTMLDivElement>(null);
	const [fit, setFit] = useState<number>(nav.length);
	const [more, setMore] = useState(false);

	useEffect(() => {
		const b = box.current;
		const r = ruler.current;
		if (!b || !r) return;
		const calc = () => {
			const els = [...r.children] as HTMLElement[];
			const moreW = (els.pop() as HTMLElement).offsetWidth;
			const widths = els.map((e) => e.offsetWidth);
			const avail = b.clientWidth;
			const all = widths.reduce((a, w) => a + w, 0) + GAP * (widths.length - 1);
			if (all <= avail) return setFit(nav.length);
			let used = moreW;
			let k = 0;
			while (k < widths.length && used + GAP + widths[k] <= avail)
				used += GAP + widths[k++];
			setFit(k);
		};
		const ro = new ResizeObserver(calc);
		ro.observe(b);
		document.fonts?.ready.then(calc);
		calc();
		return () => ro.disconnect();
	}, []);

	useEffect(() => {
		if (!more) return;
		const close = (e: MouseEvent) => {
			if (!box.current?.contains(e.target as Node)) setMore(false);
		};
		document.addEventListener("mousedown", close);
		return () => document.removeEventListener("mousedown", close);
	}, [more]);

	const hidden = nav.slice(fit);
	return (
		<div
			ref={box}
			className="relative hidden min-w-0 flex-1 items-center gap-1 text-sm lg:flex"
		>
			<nav className="flex min-w-0 items-center gap-1 overflow-hidden">
				{nav.slice(0, fit).map((n) => (
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
			{hidden.length > 0 && (
				<div className="relative shrink-0">
					<button
						type="button"
						aria-expanded={more}
						onClick={() => setMore((v) => !v)}
						className={`${linkBase} px-3 py-1.5`}
					>
						More ▾
					</button>
					{more && (
						<div className="absolute left-0 top-full mt-2 flex min-w-40 flex-col gap-0.5 rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
							{hidden.map((n) => (
								<Link
									key={n.to}
									to={n.to}
									onClick={() => setMore(false)}
									className={`${linkBase} px-3 py-2`}
									activeProps={linkActive}
								>
									{n.label}
								</Link>
							))}
						</div>
					)}
				</div>
			)}
			<div
				ref={ruler}
				aria-hidden="true"
				className="invisible absolute top-0 left-0 flex h-0 w-0 overflow-hidden"
			>
				{nav.map((n) => (
					<span key={n.to} className="shrink-0 whitespace-nowrap px-3 py-1.5">
						{n.label}
					</span>
				))}
				<span className="shrink-0 whitespace-nowrap px-3 py-1.5">More ▾</span>
			</div>
		</div>
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

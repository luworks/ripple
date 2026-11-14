import { createFileRoute, Link } from "@tanstack/react-router";
import { LiveBlog } from "#/components/events/views/LiveBlog";
import { Magazine } from "#/components/events/views/Magazine";
import { Newsroom } from "#/components/events/views/Newsroom";

const VIEWS = {
	live: { label: "Live blog", Component: LiveBlog },
	newsroom: { label: "Newsroom", Component: Newsroom },
	magazine: { label: "Magazine", Component: Magazine },
} as const;
type View = keyof typeof VIEWS;

export const Route = createFileRoute("/events/jensen-huang")({
	validateSearch: (s: Record<string, unknown>): { view?: View } =>
		typeof s.view === "string" && s.view in VIEWS && s.view !== "live"
			? { view: s.view as View }
			: {},
	head: () => ({
		meta: [
			{ title: "Jensen Huang resigns as Nvidia CEO · Ripple" },
			{
				name: "description",
				content:
					"Newest-first timeline and cross-platform social pulse of Jensen Huang's resignation as Nvidia CEO, collected with Telem.",
			},
		],
	}),
	component: JensenHuangEvent,
});

function JensenHuangEvent() {
	const { view = "live" } = Route.useSearch();
	const { Component } = VIEWS[view];
	return (
		<>
			<Component />
			<ViewSwitcher current={view} />
		</>
	);
}

function ViewSwitcher({ current }: { current: View }) {
	return (
		<nav
			aria-label="View"
			className="fixed top-1/2 right-1 z-40 flex -translate-y-1/2 flex-col gap-1 sm:right-2"
		>
			{(Object.keys(VIEWS) as View[]).map((v) => (
				<Link
					key={v}
					to="/events/jensen-huang"
					search={v === "live" ? {} : { view: v }}
					aria-label={VIEWS[v].label}
					aria-current={v === current ? "page" : undefined}
					className="group relative flex size-7 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
				>
					<span
						className={`block size-2.5 rounded-full border transition ${
							v === current
								? "scale-125 border-emerald-300 bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60"
								: "border-zinc-500 bg-zinc-800/80 group-hover:border-zinc-200 group-hover:bg-zinc-500"
						}`}
					/>
					<span className="pointer-events-none absolute right-full mr-1 rounded-full border border-zinc-700 bg-zinc-900/95 px-2.5 py-1 text-xs whitespace-nowrap text-zinc-200 opacity-0 shadow-lg shadow-black/50 transition group-hover:opacity-100 group-focus-visible:opacity-100">
						{VIEWS[v].label}
					</span>
				</Link>
			))}
		</nav>
	);
}

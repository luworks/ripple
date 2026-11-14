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
		<div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900/95 p-1 text-sm shadow-2xl shadow-black/50 backdrop-blur">
			<span className="px-3 text-xs text-zinc-500">View</span>
			{(Object.keys(VIEWS) as View[]).map((v) => (
				<Link
					key={v}
					to="/events/jensen-huang"
					search={v === "live" ? {} : { view: v }}
					className={`rounded-full px-3 py-1.5 whitespace-nowrap ${
						v === current
							? "bg-emerald-400/15 text-emerald-300"
							: "text-zinc-400 hover:text-zinc-100"
					}`}
				>
					{VIEWS[v].label}
				</Link>
			))}
		</div>
	);
}

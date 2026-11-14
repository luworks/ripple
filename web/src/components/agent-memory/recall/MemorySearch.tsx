import { Link, useNavigate } from "@tanstack/react-router";
import { Suspense, use } from "react";
import type { RecallSession } from "#/server/agent-memory/recall";
import { chartPromise, searchPromise } from "./data";

export function SearchBox({ q }: { q?: string }) {
	const navigate = useNavigate();
	return (
		<form
			className="flex gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				const v = String(new FormData(e.currentTarget).get("q") ?? "").trim();
				navigate({ to: "/agent-memory", search: { q: v || undefined } });
			}}
		>
			<input
				key={q ?? ""}
				name="q"
				type="search"
				defaultValue={q ?? ""}
				placeholder="Search what your agents searched and read… e.g. Telem"
				aria-label="Search agent memory"
				className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none"
			/>
			<button
				type="submit"
				className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-zinc-950 hover:bg-sky-400"
			>
				Search
			</button>
		</form>
	);
}

export function SearchResults({ q }: { q?: string }) {
	if (!q) return <Suggestions label="Try a topic your agents researched:" />;
	return (
		<Suspense
			fallback={<p className="text-sm text-zinc-500">Searching “{q}”…</p>}
		>
			<Results q={q} />
		</Suspense>
	);
}

function Results({ q }: { q: string }) {
	const r = use(searchPromise(q));
	if (!r.sessions.length)
		return (
			<div className="flex flex-col gap-3" data-search="empty">
				<p className="text-sm text-zinc-400">
					No agent sessions matched “{q}”.
				</p>
				<Suggestions label="Try one of these instead:" />
			</div>
		);
	return (
		<div className="flex flex-col gap-3" data-search="results">
			<p className="text-xs text-zinc-500">
				{r.sessions.length} session{r.sessions.length === 1 ? "" : "s"} matched
				“{q}” · most recent first · {r.ms} ms
			</p>
			{r.sessions.map((s) => (
				<SessionCard key={s.sessionKey} s={s} />
			))}
		</div>
	);
}

function SessionCard({ s }: { s: RecallSession }) {
	return (
		<article className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
			<header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
				<span className="text-zinc-300">{s.when}</span>
				{s.machine && <span>{s.machine}</span>}
				{s.agent && (
					<span className="rounded-full border border-zinc-700 px-2 py-0.5 text-zinc-300">
						{s.agent}
					</span>
				)}
				<a
					href={`/agent-memory?view=timeline&session=${encodeURIComponent(s.sessionKey)}`}
					className="ml-auto text-sky-400 hover:text-sky-300"
				>
					Open in Timeline →
				</a>
			</header>
			<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.3fr)] sm:items-start">
				<div className="flex flex-wrap gap-1.5">
					{s.queries.length ? (
						s.queries.map((q) => (
							<span
								key={q}
								className={`rounded-lg border px-2 py-1 text-xs ${s.matchedQueries ? "border-sky-900 bg-sky-950/40 text-sky-200" : "border-zinc-800 bg-zinc-900 text-zinc-300"}`}
							>
								{q}
							</span>
						))
					) : (
						<span className="text-xs text-zinc-600">matched on a page URL</span>
					)}
				</div>
				<span aria-hidden="true" className="hidden pt-1 text-zinc-600 sm:block">
					→
				</span>
				<ul className="flex flex-col gap-1 text-xs">
					{s.pages.length ? (
						s.pages.map((p) => <PageRow key={p.url} url={p.url} />)
					) : (
						<li className="text-zinc-600">No visible pages after the search</li>
					)}
				</ul>
			</div>
		</article>
	);
}

function PageRow({ url }: { url: string }) {
	const slash = url.indexOf("/");
	const host = slash < 0 ? url : url.slice(0, slash);
	const path = slash < 0 ? "" : url.slice(slash);
	return (
		<li className="truncate text-zinc-500" title={url}>
			<span className="font-semibold text-zinc-200">{host}</span>
			{path}
		</li>
	);
}

function Suggestions({ label }: { label: string }) {
	return (
		<Suspense fallback={null}>
			<SuggestionChips label={label} />
		</Suspense>
	);
}

function SuggestionChips({ label }: { label: string }) {
	const { suggestions } = use(chartPromise());
	if (!suggestions.length) return null;
	return (
		<div
			className="flex flex-wrap items-center gap-2 text-sm"
			data-search="suggestions"
		>
			<span className="text-zinc-500">{label}</span>
			{suggestions.map((t) => (
				<Link
					key={t}
					to="/agent-memory"
					search={{ q: t }}
					className="rounded-full border border-zinc-700 px-3 py-1 text-zinc-200 hover:border-sky-500 hover:text-sky-300"
				>
					{t}
				</Link>
			))}
		</div>
	);
}

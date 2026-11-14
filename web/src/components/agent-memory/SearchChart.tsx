import { useEffect, useRef, useState } from "react";
import {
	type Bucket,
	type Detail,
	type Grain,
	getDetail,
	getSeries,
	type Series,
} from "#/server/agent-memory/strata";
import { Sessions, SOURCES, SourceTag } from "./Sessions";

const H = 200;
const POLL_MS = 10_000;
const fmt = new Intl.NumberFormat("en-US");
const GRAINS: [Grain, string][] = [
	["15m", "15 min"],
	["hour", "Hour"],
	["day", "Day"],
];
const SPAN_LABEL: Record<Grain, string> = {
	"15m": "last 48 hours",
	hour: "last 7 days",
	day: "since the first search",
};

const total = (b: Bucket) => b.claude + b.codex + b.telem + b.tavily;
// Buckets are PT wall-clock strings; format them as UTC so nothing shifts.
const at = (t: string, o: Intl.DateTimeFormatOptions) =>
	new Date(`${t}:00Z`).toLocaleString("en-US", { timeZone: "UTC", ...o });
const hourLabel = (h: number) =>
	h === 0 ? "12a" : h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`;

function bucketLabel(t: string, g: Grain) {
	const day = at(t, { weekday: "short", month: "short", day: "numeric" });
	if (g === "day") return day;
	const time = at(t, { hour: "numeric", minute: "2-digit" });
	return `${day} · ${time} PT`;
}

// Axis ticks: months for days, midnights for hours, every 6 hours for 15-minute bars.
function tick(t: string, i: number, g: Grain) {
	const hh = Number(t.slice(11, 13));
	const mm = t.slice(14, 16);
	if (g === "day")
		return t.endsWith("-01T00:00") || i === 0
			? at(t, { month: "short" })
			: null;
	if (g === "hour")
		return hh === 0 ? at(t, { weekday: "short", day: "numeric" }) : null;
	if (mm !== "00" || hh % 6) return null;
	return hh === 0 ? at(t, { weekday: "short", day: "numeric" }) : hourLabel(hh);
}

// Stacked log-scale bars: the total's height is log-scaled, then split by source so a
// handful of Tavily/Telem calls stays visible next to a 100k-search batch night.
// Small sources get at least 2px; the largest source absorbs the rounding.
function segments(b: Bucket, max: number) {
	const n = total(b);
	const parts = SOURCES.map((s) => b[s.key]);
	if (!n) return parts.map(() => 0);
	const h = Math.round(4 + (Math.log10(n + 1) / Math.log10(max + 1)) * (H - 4));
	const px = parts.map((k) => (k ? Math.max(2, Math.round((h * k) / n)) : 0));
	const big = parts.indexOf(Math.max(...parts));
	px[big] = Math.max(2, h - px.reduce((s, p, i) => (i === big ? s : s + p), 0));
	return px;
}

export function SearchChart({
	initial,
	initialDetail,
}: {
	initial: Series;
	initialDetail: Detail;
}) {
	const [series, setSeries] = useState(initial);
	const [hover, setHover] = useState<number | null>(null);
	const [details, setDetails] = useState<Record<string, Detail>>({
		[`day|${initialDetail.t}`]: initialDetail,
	});
	const [updated, setUpdated] = useState<string | null>(null);
	const pending = useRef(new Set<string>());
	const { grain, rows } = series;
	const last = rows.length - 1;
	// Without a hover, show the latest bucket that has searches, not an empty "now".
	let latest = last;
	while (latest > 0 && total(rows[latest]) === 0) latest--;
	const shown = Math.min(hover ?? latest, last);
	const b = rows[shown];
	const key = `${grain}|${b.t}`;
	const detail = details[key];
	const current = useRef({ grain, t: b.t, key });
	current.current = { grain, t: b.t, key };

	// Fetch the hovered bucket's domains, queries and sessions once, after a short pause.
	useEffect(() => {
		if (details[key] || pending.current.has(key)) return;
		const id = setTimeout(() => {
			pending.current.add(key);
			getDetail({ data: { grain, t: b.t } })
				.then((d) => setDetails((m) => ({ ...m, [key]: d })))
				.catch(() => {})
				.finally(() => pending.current.delete(key));
		}, 90);
		return () => clearTimeout(id);
	}, [key, grain, b.t, details]);

	// New research-agent searches land as they run: refresh the bars and, in place, the
	// bucket on screen.
	useEffect(() => {
		const id = setInterval(() => {
			const c = current.current;
			Promise.all([
				getSeries({ data: { grain } }),
				getDetail({ data: { grain: c.grain, t: c.t } }),
			])
				.then(([s, d]) => {
					setSeries(s);
					setDetails((m) => ({ ...m, [c.key]: d }));
					setUpdated(
						new Date().toLocaleTimeString("en-US", {
							timeZone: "America/Los_Angeles",
							hour: "numeric",
							minute: "2-digit",
							second: "2-digit",
						}),
					);
				})
				.catch(() => {});
		}, POLL_MS);
		return () => clearInterval(id);
	}, [grain]);

	const pick = (g: Grain) => {
		if (g === grain) return;
		setHover(null);
		getSeries({ data: { grain: g } })
			.then(setSeries)
			.catch(() => {});
	};

	const max = Math.max(...rows.map(total), 1);
	const peak = rows.reduce((a, r, i) => (total(r) > total(rows[a]) ? i : a), 0);
	const pct = (i: number) => ((i + 0.5) / rows.length) * 100;
	const ticks = rows.flatMap((r, i) => {
		const label = tick(r.t, i, grain);
		return label ? [{ i, label }] : [];
	});

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-2">
					<span className="text-sm text-zinc-400">
						{bucketLabel(b.t, grain)}
					</span>
					<span className="font-mono text-3xl text-zinc-100">
						{fmt.format(total(b))}
						<span className="ml-2 font-sans text-sm text-zinc-500">
							{total(b) === 1 ? "search" : "searches"}
						</span>
					</span>
				</div>
				<div className="flex flex-col items-end gap-2">
					<div className="flex rounded-lg border border-zinc-800 p-0.5 text-xs">
						{GRAINS.map(([g, label]) => (
							<button
								key={g}
								type="button"
								onClick={() => pick(g)}
								className={`rounded-md px-3 py-1 transition-colors ${g === grain ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-200"}`}
							>
								{label}
							</button>
						))}
					</div>
					<span className="flex items-center gap-2 text-xs text-zinc-500">
						{SPAN_LABEL[grain]} · log scale
						<span className="flex items-center gap-1.5 font-mono text-emerald-400">
							<span className="relative flex h-1.5 w-1.5">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
								<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
							</span>
							live{updated ? ` · ${updated} PT` : ""}
						</span>
					</span>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{SOURCES.map((s) => (
					<div key={s.key} className="flex flex-col gap-1">
						<span className="flex items-center gap-2 text-sm text-zinc-200">
							<span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} />
							{s.name}
							<span className="ml-auto font-mono text-zinc-100 sm:ml-0">
								{fmt.format(b[s.key])}
							</span>
						</span>
						<span className="pl-[18px] text-xs text-zinc-500">{s.via}</span>
					</div>
				))}
			</div>

			<div className="flex flex-col gap-2">
				<div className="relative">
					{grain === "day" && total(rows[peak]) > 0 && (
						<span
							className="absolute top-0 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-zinc-500"
							style={{ left: `${Math.min(Math.max(pct(peak), 12), 88)}%` }}
						>
							{at(rows[peak].t, { month: "short", day: "numeric" })} ·{" "}
							{total(rows[peak]) > 10_000 ? "overnight batch, " : "peak, "}
							{fmt.format(total(rows[peak]))}
						</span>
					)}
					<fieldset
						className="m-0 flex items-end gap-px border-0 p-0 pt-5"
						style={{ height: H + 20 }}
						onMouseLeave={() => setHover(null)}
					>
						{rows.map((r, i) => {
							const px = segments(r, max);
							return (
								<button
									type="button"
									key={r.t}
									aria-label={`${bucketLabel(r.t, grain)}: ${total(r)} searches`}
									onMouseEnter={() => setHover(i)}
									onFocus={() => setHover(i)}
									onClick={() => setHover(i)}
									className={`flex h-full min-w-0 flex-1 flex-col-reverse overflow-hidden rounded-t-sm ${i === shown ? "bg-zinc-800/80" : "hover:bg-zinc-900"}`}
								>
									{SOURCES.map((s, j) => (
										<span
											key={s.key}
											className={`w-full shrink-0 ${s.color}`}
											style={{ height: px[j] }}
										/>
									))}
								</button>
							);
						})}
					</fieldset>
				</div>
				<div className="relative h-4 border-t border-zinc-800 font-mono text-[10px] text-zinc-500">
					{ticks.map((t) => (
						<span
							key={t.i}
							className="absolute top-1 whitespace-nowrap"
							style={{ left: `${(t.i / rows.length) * 100}%` }}
						>
							{t.label}
						</span>
					))}
					<span className="absolute top-1 right-0 bg-zinc-950 pl-1 text-emerald-400">
						now
					</span>
				</div>
			</div>

			<div
				className={`flex flex-col gap-8 border-t border-zinc-800 pt-6 transition-opacity ${detail ? "" : "opacity-50"}`}
			>
				<div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
					<TopDomains detail={detail} />
					<Queries detail={detail} />
				</div>
				<div className="flex flex-col gap-3">
					<Label>Sessions in this slot</Label>
					{detail && <Sessions key={key} sessions={detail.sessions} />}
				</div>
			</div>
		</div>
	);
}

function Label({ children }: { children: string }) {
	return (
		<span className="text-xs font-medium uppercase tracking-wider text-sky-400">
			{children}
		</span>
	);
}

function TopDomains({ detail }: { detail?: Detail }) {
	const d = detail?.domains ?? [];
	const top = d[0]?.n ?? 1;
	return (
		<div className="flex flex-col gap-3">
			<Label>Top domains</Label>
			{detail && d.length === 0 && (
				<p className="text-sm text-zinc-500">No pages recorded.</p>
			)}
			<ol className="flex flex-col gap-2">
				{d.map((x, i) => (
					<li
						key={x.d}
						className="grid grid-cols-[1.25rem_minmax(0,11rem)_1fr_3.5rem] items-center gap-3 text-sm"
					>
						<span className="font-mono text-xs text-zinc-500">{i + 1}</span>
						<span className="truncate font-mono text-zinc-100">{x.d}</span>
						<span className="h-1.5 rounded-full bg-zinc-800">
							<span
								className="block h-full rounded-full bg-zinc-400"
								style={{ width: `${(x.n / top) * 100}%` }}
							/>
						</span>
						<span className="text-right font-mono text-xs text-zinc-400">
							{fmt.format(x.n)}
						</span>
					</li>
				))}
			</ol>
		</div>
	);
}

function Queries({ detail }: { detail?: Detail }) {
	const q = detail?.queries ?? [];
	return (
		<div className="flex flex-col gap-3">
			<Label>What was searched, and by whom</Label>
			{detail && q.length === 0 && (
				<p className="text-sm text-zinc-500">No visible queries.</p>
			)}
			<ul className="flex flex-col gap-2">
				{q.map((x) => (
					<li
						key={`${x.engine}-${x.text}`}
						className="grid grid-cols-[6.5rem_1fr_auto] items-baseline gap-3 text-sm"
					>
						<SourceTag name={x.engine} />
						<span className="line-clamp-1 text-zinc-200">{x.text}</span>
						<span className="font-mono text-xs text-zinc-500">
							{x.n > 1 ? `×${x.n}` : ""}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

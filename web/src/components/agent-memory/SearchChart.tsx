import { useEffect, useRef, useState } from "react";
import {
	type Bucket,
	type Detail,
	type Grain,
	getDetail,
	getSeries,
	type Series,
} from "#/server/agent-memory/strata";
import { ENGINE_COLOR } from "./TodayLane";

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
// Bar segments bottom-up: agents' own web searches, then Tavily, then Telem.
const SEGMENTS = [
	["web", "Claude Code / Codex", ENGINE_COLOR.web],
	["tavily", "Tavily", ENGINE_COLOR.Tavily],
	["telem", "Telem", ENGINE_COLOR.Telem],
] as const;

const total = (b: Bucket) => b.web + b.tavily + b.telem;
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
function segments(b: Bucket, max: number) {
	const n = total(b);
	if (!n) return [0, 0, 0];
	const h = Math.round(4 + (Math.log10(n + 1) / Math.log10(max + 1)) * (H - 4));
	const part = (k: number) => (k ? Math.max(2, Math.round((h * k) / n)) : 0);
	const tav = part(b.tavily);
	const tel = part(b.telem);
	return [Math.max(b.web ? 2 : 0, h - tav - tel), tav, tel];
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

	// Fetch the hovered bucket's domains and queries once, after a short pause.
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

	// New research-agent searches land as they run: refresh the bars and the open bucket.
	useEffect(() => {
		const id = setInterval(() => {
			getSeries({ data: { grain } })
				.then((s) => {
					setSeries(s);
					const lastKey = `${grain}|${s.rows[s.rows.length - 1].t}`;
					setDetails(({ [lastKey]: _, ...m }) => m);
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
				<div className="flex flex-col gap-1">
					<span className="text-sm text-zinc-400">
						{bucketLabel(b.t, grain)}
					</span>
					<span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
						<span className="font-mono text-2xl text-zinc-100">
							{fmt.format(total(b))}
							<span className="ml-2 font-sans text-sm text-zinc-500">
								{total(b) === 1 ? "search" : "searches"}
							</span>
						</span>
						{SEGMENTS.map(([k, label, color]) => (
							<span
								key={k}
								className="flex items-center gap-1.5 text-xs text-zinc-400"
							>
								<span className={`h-2 w-2 rounded-sm ${color}`} />
								{label}
								<span className="font-mono text-zinc-100">
									{fmt.format(b[k])}
								</span>
							</span>
						))}
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
					<span className="text-xs text-zinc-500">
						{SPAN_LABEL[grain]} · log scale
					</span>
				</div>
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
							const [web, tav, tel] = segments(r, max);
							return (
								<button
									type="button"
									key={r.t}
									aria-label={`${bucketLabel(r.t, grain)}: ${total(r)} searches`}
									onMouseEnter={() => setHover(i)}
									onFocus={() => setHover(i)}
									onClick={() => setHover(i)}
									className={`flex h-full min-w-0 flex-1 flex-col-reverse rounded-t-sm ${i === shown ? "bg-zinc-800/80" : "hover:bg-zinc-900"}`}
								>
									<span
										className={`w-full ${ENGINE_COLOR.web}`}
										style={{ height: web }}
									/>
									<span
										className={`w-full ${ENGINE_COLOR.Tavily}`}
										style={{ height: tav }}
									/>
									<span
										className={`w-full rounded-t-[1px] ${ENGINE_COLOR.Telem}`}
										style={{ height: tel }}
									/>
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
				className={`grid grid-cols-1 gap-8 border-t border-zinc-800 pt-6 transition-opacity lg:grid-cols-2 ${detail ? "" : "opacity-50"}`}
			>
				<TopDomains detail={detail} />
				<Queries detail={detail} />
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
			<Label>What was searched</Label>
			{detail && q.length === 0 && (
				<p className="text-sm text-zinc-500">No visible queries.</p>
			)}
			<ul className="flex flex-col gap-2">
				{q.map((x) => (
					<li
						key={`${x.engine}-${x.text}`}
						className="flex items-baseline gap-2 text-sm"
					>
						<span
							className={`inline-block h-1.5 w-1.5 shrink-0 translate-y-[-2px] rounded-full ${ENGINE_COLOR[x.engine] ?? ENGINE_COLOR.web}`}
						/>
						<span className="line-clamp-1 flex-1 text-zinc-200">{x.text}</span>
						{x.n > 1 && (
							<span className="font-mono text-xs text-zinc-500">×{x.n}</span>
						)}
					</li>
				))}
			</ul>
		</div>
	);
}

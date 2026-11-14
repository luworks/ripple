import { useEffect, useMemo, useRef, useState } from "react";
import { getRippleReplay, type RippleReplay } from "#/server/ripple";
import { changeAt, fmtPct, STANCE_COLOR } from "./replay";
import type { RippleHandle } from "./scene";

const ptClock = new Intl.DateTimeFormat("en-US", {
	timeZone: "America/Los_Angeles",
	weekday: "short",
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
});
const etDate = new Intl.DateTimeFormat("en-CA", {
	timeZone: "America/New_York",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

// Replays the Jensen Huang resignation: real timestamped posts flying out to their
// platforms while real 5-minute prices move the ticker bars, all on one clock.
export function RippleReplayView() {
	const [data, setData] = useState<RippleReplay | null>(null);
	const [err, setErr] = useState(false);
	useEffect(() => {
		let live = true;
		getRippleReplay()
			.then((d) => live && setData(d))
			.catch(() => live && setErr(true));
		return () => {
			live = false;
		};
	}, []);
	if (!data)
		return (
			<div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/30 text-sm text-zinc-500 sm:aspect-[4/3]">
				{err ? "Replay data unavailable" : "Loading replay…"}
			</div>
		);
	return <Replay data={data} />;
}

function Replay({ data }: { data: RippleReplay }) {
	const host = useRef<HTMLDivElement>(null);
	const handle = useRef<RippleHandle | null>(null);
	const [t, setT] = useState(data.start);
	const [playing, setPlaying] = useState(false);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		const el = host.current;
		if (!el) return;
		let disposed = false;
		const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
		const interactive = !matchMedia("(pointer: coarse)").matches;
		import("./scene")
			.then(({ mountRipple }) => {
				if (disposed) return;
				handle.current = mountRipple(el, data, {
					reduced,
					interactive,
					onTime: (time, on) => {
						setT(time);
						setPlaying(on);
					},
				});
			})
			.catch(() => setFailed(true));
		return () => {
			disposed = true;
			handle.current?.dispose();
			handle.current = null;
		};
	}, [data]);

	const span = data.end - data.start;
	const nvda = data.prices.find((s) => s.symbol === "NVDA");
	const quote = nvda ? changeAt(nvda, data.baseline, t) : null;
	const day = etDate.format(t);
	const beats = data.beats.filter((b) => b.date === day);
	const shown = useMemo(() => {
		let n = 0;
		while (n < data.posts.length && data.posts[n].t <= t) n++;
		return n;
	}, [data, t]);
	const latest = shown ? data.posts[shown - 1] : null;

	return (
		<div className="flex flex-col gap-3">
			<div
				ref={host}
				className="relative aspect-square w-full overflow-hidden rounded-2xl border border-zinc-800 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.08),transparent_65%)] sm:aspect-[4/3]"
			>
				<div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-col gap-0.5 text-xs">
					<span className="font-mono text-zinc-200">
						{ptClock.format(t)} PT
					</span>
					{quote && (
						<span className="font-mono">
							<span className="text-zinc-400">NVDA </span>
							<span className="text-zinc-200">${quote.price.toFixed(2)}</span>{" "}
							<span
								className={
									quote.pct >= 0 ? "text-emerald-300" : "text-rose-300"
								}
							>
								{fmtPct(quote.pct)}
							</span>
						</span>
					)}
					<span className="text-zinc-500">
						{shown} / {data.posts.length} posts
					</span>
				</div>
				{failed && (
					<div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
						3D view unavailable in this browser
					</div>
				)}
			</div>

			<div className="flex min-h-[2.5rem] flex-col gap-1 text-sm">
				<p className="text-zinc-300">
					<span className="mr-2 font-mono text-xs text-sky-400">
						{day.slice(5).replace("-", "/")} ET
					</span>
					{beats.length ? beats.map((b) => b.title).join(" · ") : "—"}
				</p>
				{latest && (
					<a
						href={latest.url}
						target="_blank"
						rel="noreferrer"
						className="truncate text-xs text-zinc-400 hover:text-zinc-200"
					>
						<span
							className="mr-1.5 inline-block h-2 w-2 rounded-full"
							style={{ background: STANCE_COLOR[latest.stance] }}
						/>
						{latest.platform} · {latest.title}
					</a>
				)}
			</div>

			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={() => handle.current?.setPlaying(!playing)}
					aria-label={playing ? "Pause replay" : "Play replay"}
					className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-200 hover:border-sky-400/60"
				>
					{playing ? "❚❚" : "▶"}
				</button>
				<Scrubber
					data={data}
					p={(t - data.start) / span}
					onSeek={(v) => handle.current?.seek(v)}
				/>
			</div>

			<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
				{Object.entries(STANCE_COLOR).map(([k, c]) => (
					<span key={k} className="flex items-center gap-1.5">
						<span className="h-2 w-2 rounded-full" style={{ background: c }} />
						{k}
					</span>
				))}
			</div>
			<p className="text-xs leading-relaxed text-zinc-500">
				{data.posts.length} timestamped posts of {data.totalPosts} relevant
				(Weibo and Zhihu posts carry no time, so they sit out). Bars: Yahoo
				Finance 5-minute closes vs the Nov 11 close, flat while the market is
				shut. Headlines are date-only (US Eastern). Nov 11 1 PM – Nov 14 12 PM
				PT, replayed in ~30 s.
			</p>
		</div>
	);
}

// Range input over an NVDA sparkline and one tick per post, colored by stance.
function Scrubber({
	data,
	p,
	onSeek,
}: {
	data: RippleReplay;
	p: number;
	onSeek(v: number): void;
}) {
	const span = data.end - data.start;
	const W = 1000;
	const H = 44;
	const paths = useMemo(() => {
		const nvda = data.prices.find((s) => s.symbol === "NVDA");
		const pts = (nvda?.points ?? []).filter(
			(q) => q.t * 1000 >= data.start - 6 * 3600_000 && q.t * 1000 <= data.end,
		);
		if (!pts.length) return [];
		const lo = Math.min(...pts.map((q) => q.c));
		const hi = Math.max(...pts.map((q) => q.c));
		const x = (ms: number) => Math.max(0, ((ms - data.start) / span) * W);
		const y = (c: number) => 4 + (1 - (c - lo) / (hi - lo || 1)) * (H - 16);
		// One path per trading session: break where bars are >30 min apart.
		const out: string[] = [];
		let prev = -Infinity;
		for (const q of pts) {
			const ms = q.t * 1000;
			if (ms < data.start) continue;
			const xy = `${x(ms).toFixed(1)},${y(q.c).toFixed(1)}`;
			if (ms - prev > 1800_000) out.push(`M${xy}`);
			else out[out.length - 1] += `L${xy}`;
			prev = ms;
		}
		return out;
	}, [data, span]);
	return (
		<div className="relative h-11 flex-1">
			<svg
				viewBox={`0 0 ${W} ${H}`}
				preserveAspectRatio="none"
				className="absolute inset-0 h-full w-full overflow-visible"
				aria-hidden="true"
			>
				<rect width={W} height={H} rx={6} className="fill-zinc-900/60" />
				{paths.map((d) => (
					<path
						key={d}
						d={d}
						fill="none"
						stroke="#a1a1aa"
						strokeWidth={1.5}
						vectorEffect="non-scaling-stroke"
					/>
				))}
				{data.posts.map((post) => {
					const x = ((post.t - data.start) / span) * W;
					return (
						<line
							key={`${post.url}-${post.t}`}
							x1={x}
							x2={x}
							y1={H - 9}
							y2={H - 2}
							stroke={STANCE_COLOR[post.stance]}
							strokeWidth={1.5}
							vectorEffect="non-scaling-stroke"
						/>
					);
				})}
				<line
					x1={p * W}
					x2={p * W}
					y1={0}
					y2={H}
					stroke="#38bdf8"
					strokeWidth={2}
					vectorEffect="non-scaling-stroke"
				/>
			</svg>
			<input
				type="range"
				min={0}
				max={1000}
				value={Math.round(p * 1000)}
				onChange={(e) => onSeek(Number(e.target.value) / 1000)}
				aria-label="Replay time"
				className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
			/>
		</div>
	);
}

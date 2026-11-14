import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TelemCredits, TelemMark } from "#/components/events/Telem";
import plan from "#/data/jensen-huang-scan-plan.json";
import type { EventView } from "#/data/jensen-huang-view";
import { startResearchRun } from "#/server/research";
import { getScanPlanStatus, type MonitorStatus } from "#/server/scan-plan";

const RATE: Record<string, { label: string; perDay: number }> = {
	"1h": { label: "hourly", perDay: 24 },
	"6h": { label: "every 6h", perDay: 4 },
	"12h": { label: "every 12h", perDay: 2 },
	"1d": { label: "daily", perDay: 1 },
};

const ptDate = (d = new Date()) =>
	d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

const ago = (iso: string) => {
	const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
	return min < 60 ? `${min} min ago` : `${Math.round(min / 60)} h ago`;
};

const ptTime = (iso: string) =>
	new Date(iso).toLocaleString("en-US", {
		timeZone: "America/Los_Angeles",
		weekday: "short",
		hour: "numeric",
		minute: "2-digit",
	});

/** "What's next": the week's known dates, Research's finds, and how often Telem checks each day. */
export function WhatsNext({ upcoming }: { upcoming: EventView[] }) {
	const navigate = useNavigate();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<MonitorStatus | null>(null);
	const [today, setToday] = useState<string | null>(null);

	// After mount, so the server render matches the first client render.
	useEffect(() => {
		setToday(ptDate());
		getScanPlanStatus()
			.then(setStatus)
			.catch(() => {});
	}, []);

	async function predict() {
		setBusy(true);
		setError(null);
		try {
			const r = await startResearchRun({
				data: { query: plan.predictionQuery, budget: 120 },
			});
			if (r.ok) navigate({ to: "/research/$id", params: { id: r.id } });
			else setError(r.error);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}

	return (
		<section className="mt-10 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 sm:p-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="text-xs font-medium tracking-wider text-amber-300 uppercase">
					What's next · Telem is on it
				</h2>
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={predict}
						disabled={busy}
						className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-60"
					>
						{busy ? "Starting…" : "▶ Predict next week · ~90 s"}
					</button>
					<Link
						to="/telem/guide"
						hash="monitors"
						className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
					>
						⏱ Run a plan like this
					</Link>
				</div>
			</div>
			{error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

			<MonitorLine status={status} />

			<ol className="mt-4 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
				{plan.days.map((d) => {
					const rate = RATE[d.frequency];
					const hot = d.events.some((e) => e.kind === "confirmed");
					const isToday = today !== null && today >= d.from && today <= d.to;
					return (
						<li
							key={d.from}
							className={`flex min-h-28 flex-col gap-1 rounded-lg border p-1.5 text-center ${isToday ? "border-emerald-400/70" : hot ? "border-amber-400/40" : "border-zinc-800"}`}
						>
							<span className="text-[10px] text-zinc-500">
								{d.label}
								{isToday && " · today"}
							</span>
							{d.events.map((e) => (
								<span
									key={e.title}
									className={`rounded px-1 py-0.5 text-[10px] leading-tight ${e.kind === "confirmed" ? "bg-amber-400/10 text-amber-200" : "border border-dashed border-zinc-600 text-zinc-300"}`}
								>
									{e.title}
								</span>
							))}
							<div className="mt-auto flex h-8 items-end justify-center">
								<span
									className="w-4 rounded-sm bg-emerald-500"
									style={{
										height: `${Math.max(12, (Math.log2(rate.perDay + 1) / Math.log2(25)) * 100)}%`,
									}}
								/>
							</div>
							<span
								className={`text-[10px] ${d.frequency === "1h" ? "text-emerald-300" : "text-zinc-500"}`}
							>
								{rate.label}
							</span>
						</li>
					);
				})}
			</ol>
			<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
				<span>
					<span className="text-amber-300">■</span> Confirmed date
				</span>
				<span>
					┅{" "}
					<Link
						to="/research/$id"
						params={{ id: plan.predictionRunId }}
						className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300"
					>
						Found by Research
					</Link>
				</span>
				<span>
					<span className="text-emerald-500">▮</span> Telem Monitor check rate
					(PT days)
				</span>
			</div>

			<ul className="mt-5 flex flex-col gap-4 border-t border-zinc-800 pt-4">
				{upcoming.map((e) => (
					<li key={e.id} id={e.id} className="scroll-mt-24">
						<div className="font-mono text-xs text-amber-200/80">{e.when}</div>
						<div className="mt-1 font-medium">{e.title}</div>
						<p className="mt-1 text-sm text-zinc-400">{e.detail}</p>
						<div className="mt-2">
							<TelemCredits credits={e.credits} compact />
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}

function MonitorLine({ status }: { status: MonitorStatus | null }) {
	if (!status) return null;
	const live = status.status === "active";
	return (
		<p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-zinc-400">
			<span
				className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-zinc-500"}`}
			/>
			<TelemMark />
			<span className="font-medium text-zinc-300">Telem Monitor</span>
			<span className="text-zinc-600">·</span>
			<span>
				{live ? "checking" : status.status}{" "}
				{RATE[status.frequency]?.label ?? status.frequency}
			</span>
			<span className="text-zinc-600">·</span>
			<span>
				{status.lastCheck
					? `last check ${ago(status.lastCheck)}`
					: "planning its first check"}
			</span>
			{status.nextCheck && (
				<>
					<span className="text-zinc-600">·</span>
					<span>next {ptTime(status.nextCheck)} PT</span>
				</>
			)}
			<span className="text-zinc-600">·</span>
			<span>{status.found} sources found</span>
			{status.alerts.length > 0 && (
				<span className="mt-2 flex w-full flex-col gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
					<span className="text-[10px] tracking-wider text-emerald-300 uppercase">
						Latest alerts
					</span>
					{status.alerts.map((a) => (
						<span key={`${a.at}-${a.name}`} className="flex gap-2 text-xs">
							<span className="shrink-0 font-mono text-zinc-500">
								{ago(a.at)}
							</span>
							{a.url ? (
								<a
									href={a.url}
									target="_blank"
									rel="noreferrer"
									className="text-zinc-200 underline decoration-zinc-700 underline-offset-2 hover:text-emerald-300"
								>
									{a.name}
								</a>
							) : (
								<span className="text-zinc-200">{a.name}</span>
							)}
						</span>
					))}
				</span>
			)}
		</p>
	);
}

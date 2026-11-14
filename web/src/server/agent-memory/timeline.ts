import { createServerFn } from "@tanstack/react-start";

// Timeline reads ONLY the demo-safe views hackathon_agent_data.demo_events / demo_urls.
// Hidden values arrive as NULL there; they are counted, never rendered.

const TZ = "America/Los_Angeles";
const PAGE_SIZE = 20;
const CARD_TRAIL = 8;
const FULL_TRAIL = 400;
// "Pages opened" = URLs an agent actually opened, not every link listed in search results.
const PAGE_KINDS = ["open_target", "page_reference"];
const TRAIL_EVENTS = [
	"search_operation",
	"open_operation",
	"page_find_operation",
];

export const PALETTE = ["#3987e5", "#d95926", "#199e70", "#c98500"];
export const OTHER_COLOR = "#52525b";

export type TimelineFilters = { machine?: string; agent?: string };

type Summary = {
	key: string;
	machine: string;
	agent: string;
	start: string;
	end: string;
	week: string;
};

export type TrailItem =
	| { kind: "query"; text: string }
	| { kind: "page"; host: string; path: string };

export type SessionCard = {
	key: string;
	machine: string;
	agent: string;
	start: string;
	day: string;
	dayLabel: string;
	timeRange: string;
	searches: number;
	pages: number;
	hidden: number;
	trail: TrailItem[];
	more: number;
	firstQuery: string | null;
};

export type ChartSeries = { key: string; color: string; total: number };
export type ChartWeek = { week: string; label: string; counts: number[] };
export type TimelineChart = { series: ChartSeries[]; weeks: ChartWeek[] };

export type TimelinePage = { sessions: SessionCard[]; cursor: string | null };

export type TimelineData = {
	machines: string[];
	agents: string[];
	chart: TimelineChart;
	page: TimelinePage;
	focus: SessionCard | null;
};

let summaries: Promise<Summary[]> | undefined;

// One row per session with >=1 web search or opened page. The snapshot is static,
// so compute once per server process (~150 ms with JIT off), newest first.
function loadSummaries(): Promise<Summary[]> {
	summaries ??= (async () => {
		const { db } = await import("../db");
		const rows = await db().begin(async (tx) => {
			await tx`set local jit = off`;
			return tx`
				select
					e.session_key as key,
					min(e.machine) as machine,
					min(e.agent) as agent,
					min(e.ts) as start,
					max(e.ts) as "end",
					to_char(date_trunc('week', min(e.ts) at time zone ${TZ}), 'YYYY-MM-DD') as week
				from hackathon_agent_data.demo_events e
				where e.ts is not null
					and e.session_key is not null
					and (
						e.event_type = 'search_operation'
						or (
							e.event_type in ('open_operation', 'page_find_operation')
							and exists (
								select 1 from hackathon_agent_data.demo_urls u
								where u.event_id = e.id and u.occurrence_kind = any(${PAGE_KINDS})
							)
						)
					)
				group by e.session_key
				order by start desc, key desc`;
		});
		return rows.map((r) => ({
			key: r.key,
			machine: r.machine,
			agent: r.agent,
			start: (r.start as Date).toISOString(),
			end: (r.end as Date).toISOString(),
			week: r.week,
		}));
	})().catch((err) => {
		summaries = undefined;
		throw err;
	});
	return summaries;
}

const matches = (s: Summary, f: TimelineFilters) =>
	(!f.machine || s.machine === f.machine) && (!f.agent || s.agent === f.agent);

function byCount(values: string[]): string[] {
	const n = new Map<string, number>();
	for (const v of values) n.set(v, (n.get(v) ?? 0) + 1);
	return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

function addDays(isoDay: string, days: number): string {
	const d = new Date(`${isoDay}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

function isoWeekLabel(monday: string): string {
	const d = new Date(`${monday}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + 3); // Thursday decides the ISO year
	const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1);
	const wk = Math.floor((d.getTime() - jan1) / 86_400_000 / 7) + 1;
	return `W${String(wk).padStart(2, "0")}`;
}

function buildChart(all: Summary[], f: TimelineFilters): TimelineChart {
	// Colors follow the machine (ranked on the unfiltered data), never the filtered rank.
	const ranked = byCount(all.map((s) => s.machine));
	const top = ranked.slice(0, PALETTE.length);
	const keys = ranked.length > top.length ? [...top, "Other"] : top;
	const slot = (m: string) => (top.includes(m) ? top.indexOf(m) : top.length);

	const rows = all.filter((s) => matches(s, f));
	const byWeek = new Map<string, number[]>();
	const totals = keys.map(() => 0);
	for (const s of rows) {
		let c = byWeek.get(s.week);
		if (!c) {
			c = keys.map(() => 0);
			byWeek.set(s.week, c);
		}
		c[slot(s.machine)]++;
		totals[slot(s.machine)]++;
	}

	const weeks: ChartWeek[] = [];
	const present = [...byWeek.keys()].sort();
	if (present.length) {
		for (
			let w = present[0];
			w <= present[present.length - 1];
			w = addDays(w, 7)
		) {
			weeks.push({
				week: w,
				label: isoWeekLabel(w),
				counts: byWeek.get(w) ?? keys.map(() => 0),
			});
		}
	}
	return {
		series: keys.map((k, i) => ({
			key: k,
			color: PALETTE[i] ?? OTHER_COLOR,
			total: totals[i],
		})),
		weeks,
	};
}

const dayFmt = new Intl.DateTimeFormat("en-US", {
	timeZone: TZ,
	weekday: "long",
	month: "short",
	day: "numeric",
	year: "numeric",
});
const isoDayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("en-US", {
	timeZone: TZ,
	hour: "numeric",
	minute: "2-digit",
	hour12: true,
});

function clock(iso: string): { hm: string; ap: string } {
	const parts = timeFmt.formatToParts(new Date(iso));
	const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
	return { hm: `${get("hour")}:${get("minute")}`, ap: get("dayPeriod") };
}

function timeRange(start: string, end: string): string {
	const a = clock(start);
	const b = clock(end);
	if (a.hm === b.hm && a.ap === b.ap) return `${a.hm} ${a.ap} PT`;
	if (a.ap === b.ap) return `${a.hm}–${b.hm} ${b.ap} PT`;
	return `${a.hm} ${a.ap}–${b.hm} ${b.ap} PT`;
}

type DetailRow = {
	session_key: string;
	event_type: string;
	query_text: string | null;
	host: string | null;
	display_url: string | null;
	url_hidden: boolean | null;
	has_url: boolean;
};

// Trail events (+ opened URLs) for a page of sessions in one indexed query.
async function loadDetails(keys: string[]): Promise<Map<string, DetailRow[]>> {
	const out = new Map<string, DetailRow[]>();
	if (!keys.length) return out;
	const { db } = await import("../db");
	const rows = await db()<DetailRow[]>`
		select
			e.session_key,
			e.event_type,
			e.query_text,
			u.host,
			u.display_url,
			u.url_hidden,
			(u.id is not null) as has_url
		from hackathon_agent_data.demo_events e
		left join hackathon_agent_data.demo_urls u
			on u.event_id = e.id and u.occurrence_kind = any(${PAGE_KINDS})
		where e.session_key = any(${keys})
			and e.ts is not null
			and e.event_type = any(${TRAIL_EVENTS})
		order by e.session_key, e.ts, e.id, u.occurrence_ordinal`;
	for (const r of rows) {
		let list = out.get(r.session_key);
		if (!list) {
			list = [];
			out.set(r.session_key, list);
		}
		list.push(r);
	}
	return out;
}

function toCard(s: Summary, rows: DetailRow[], limit: number): SessionCard {
	// Duplicate projections of the same event exist: dedupe identical queries and URLs for display.
	const seenQ = new Set<string>();
	const seenU = new Set<string>();
	const trail: TrailItem[] = [];
	let searches = 0;
	let pages = 0;
	let hidden = 0;
	for (const r of rows) {
		if (r.event_type === "search_operation") {
			const text = r.query_text?.trim();
			if (!text) {
				hidden++;
				continue;
			}
			if (seenQ.has(text)) continue;
			seenQ.add(text);
			searches++;
			trail.push({ kind: "query", text });
		} else if (r.has_url) {
			if (r.url_hidden || !r.display_url) {
				hidden++;
				continue;
			}
			if (seenU.has(r.display_url)) continue;
			seenU.add(r.display_url);
			pages++;
			const host = r.host && r.display_url.startsWith(r.host) ? r.host : "";
			trail.push({
				kind: "page",
				host: host || r.display_url,
				path: host ? r.display_url.slice(host.length) : "",
			});
		}
	}
	const first = trail.find((t) => t.kind === "query");
	return {
		key: s.key,
		machine: s.machine,
		agent: s.agent,
		start: s.start,
		day: isoDayFmt.format(new Date(s.start)),
		dayLabel: dayFmt.format(new Date(s.start)),
		timeRange: timeRange(s.start, s.end),
		searches,
		pages,
		hidden,
		trail: trail.slice(0, limit),
		more: Math.max(0, trail.length - limit),
		firstQuery: first?.kind === "query" ? first.text : null,
	};
}

async function page(
	all: Summary[],
	f: TimelineFilters,
	cursor?: string,
): Promise<TimelinePage> {
	const [cStart, cKey] = cursor ? cursor.split("|") : [];
	const picked: Summary[] = [];
	let hasMore = false;
	for (const s of all) {
		if (!matches(s, f)) continue;
		if (cStart && (s.start > cStart || (s.start === cStart && s.key >= cKey)))
			continue;
		if (picked.length === PAGE_SIZE) {
			hasMore = true;
			break;
		}
		picked.push(s);
	}
	const details = await loadDetails(picked.map((s) => s.key));
	const sessions = picked.map((s) =>
		toCard(s, details.get(s.key) ?? [], CARD_TRAIL),
	);
	const last = picked[picked.length - 1];
	return {
		sessions,
		cursor: hasMore && last ? `${last.start}|${last.key}` : null,
	};
}

type Input = TimelineFilters & { session?: string; cursor?: string };

const str = (v: unknown, max = 64) =>
	typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

const parseInput = (d: unknown): Input => {
	const o = (d ?? {}) as Record<string, unknown>;
	return {
		machine: str(o.machine),
		agent: str(o.agent),
		session: str(o.session),
		cursor: str(o.cursor, 128),
	};
};

export const getTimeline = createServerFn({ method: "GET" })
	.validator(parseInput)
	.handler(async ({ data }): Promise<TimelineData> => {
		const all = await loadSummaries();
		const f = { machine: data.machine, agent: data.agent };
		const focusSummary = data.session
			? all.find((s) => s.key === data.session)
			: undefined;
		const [first, focusRows] = await Promise.all([
			page(all, f),
			focusSummary ? loadDetails([focusSummary.key]) : undefined,
		]);
		return {
			machines: byCount(all.map((s) => s.machine)),
			agents: byCount(all.map((s) => s.agent)),
			chart: buildChart(all, f),
			page: first,
			focus: focusSummary
				? toCard(
						focusSummary,
						focusRows?.get(focusSummary.key) ?? [],
						FULL_TRAIL,
					)
				: null,
		};
	});

export const getTimelinePage = createServerFn({ method: "GET" })
	.validator(parseInput)
	.handler(async ({ data }): Promise<TimelinePage> => {
		const all = await loadSummaries();
		return page(all, { machine: data.machine, agent: data.agent }, data.cursor);
	});

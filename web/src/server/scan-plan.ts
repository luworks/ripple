import { createServerFn } from "@tanstack/react-start";
import plan from "#/data/jensen-huang-scan-plan.json";

// Live state of the Telem monitor behind the Jensen Huang scan plan. The Cloudflare worker's
// hourly cron sets the monitor's frequency from the plan; this only reads it.
export type MonitorStatus = {
	status: string;
	frequency: string;
	lastCheck: string | null;
	nextCheck: string | null;
	found: number; // sources the monitor qualified (entity_added)
	alerts: { name: string; url: string | null; at: string }[]; // newest first, at most 4
	expiresAt: string | null;
};

type Change = {
	kind: string;
	subject?: { entity_id?: string; name?: string };
	after?: { url?: string } | null;
	at: string;
};

// Changes come oldest first; page through to the end (one monitor, a few hundred at most).
async function allChanges() {
	const out: Change[] = [];
	let cursor = 0;
	for (let page = 0; page < 10; page++) {
		const r = await telem(
			`/agent/changes?cursor=${cursor}&limit=200&kinds=entity_added,alert`,
		);
		out.push(...r.changes);
		if (!r.changes.length || r.next_cursor === r.watermark) break;
		cursor = r.next_cursor;
	}
	return out;
}

const BASE = process.env.TELEM_HACK_BASE_URL ?? "https://hack.telem.ai/api";
let cached: { at: number; value: MonitorStatus | null } | null = null;

async function telem(path: string) {
	const res = await fetch(`${BASE}/v1/monitors/${plan.monitorId}${path}`, {
		headers: { authorization: `Bearer ${process.env.TELEM_HACK_API_KEY}` },
		signal: AbortSignal.timeout(5_000),
	});
	if (!res.ok) throw new Error(`Telem ${res.status}`);
	return res.json();
}

export const getScanPlanStatus = createServerFn({ method: "GET" }).handler(
	async (): Promise<MonitorStatus | null> => {
		if (!process.env.TELEM_HACK_API_KEY) return null;
		if (cached && Date.now() - cached.at < 60_000) return cached.value;
		const value = await Promise.all([telem(""), allChanges()])
			.then(([m, changes]) => {
				const urls = new Map<string, string>();
				for (const c of changes)
					if (c.kind === "entity_added" && c.subject?.entity_id && c.after?.url)
						urls.set(c.subject.entity_id, c.after.url);
				return {
					status: String(m.status),
					frequency: String(m.frequency),
					// last_polled_at stays null on agent monitors; the newest finding dates the last check.
					lastCheck: m.last_polled_at ?? changes.at(-1)?.at ?? null,
					nextCheck: m.agent_state?.next_run_at ?? null,
					found: urls.size,
					alerts: changes
						.filter((c) => c.kind === "alert" && c.subject?.name)
						.slice(-4)
						.reverse()
						.map((c) => ({
							name: String(c.subject?.name),
							url: urls.get(c.subject?.entity_id ?? "") ?? null,
							at: c.at,
						})),
					expiresAt: m.expires_at ?? null,
				};
			})
			.catch(() => null);
		cached = { at: Date.now(), value };
		return value;
	},
);

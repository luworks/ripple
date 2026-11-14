import { createServerFn } from "@tanstack/react-start";
import { toBudget } from "./research-budget";
import type { PriceSeries } from "./research-types";

export const startResearchRun = createServerFn({ method: "POST" })
	.validator((d: { query: string; budget?: number }) => ({
		query: String(d?.query ?? ""),
		budget: toBudget(d?.budget),
	}))
	.handler(async ({ data }) => {
		const { startResearch } = await import("./research-service");
		return startResearch(data.query, data.budget);
	});

export const getResearchRun = createServerFn({ method: "GET" })
	.validator((d: { id: string }) => ({ id: String(d?.id ?? "") }))
	.handler(async ({ data }) => {
		const { getRun } = await import("./research-db");
		return getRun(data.id);
	});

// The curated showcase runs plus whatever is running right now.
export const listShowcaseRuns = createServerFn({ method: "GET" })
	.validator((d: { ids: string[] }) => ({
		ids: d.ids.slice(0, 50).map(String),
	}))
	.handler(async ({ data }) => {
		const { listRecentRuns } = await import("./research-db");
		const [picked, recent] = await Promise.all([
			listRecentRuns(data.ids.length, data.ids),
			listRecentRuns(20),
		]);
		// A run killed by a server restart stays "running" in the DB; the agent times out at
		// 240 s, so anything older than 5 minutes is not really in progress.
		const live = (r: (typeof recent)[number]) =>
			r.status === "running" &&
			Date.now() - Date.parse(r.createdAt) < 5 * 60_000;
		return [...recent.filter(live), ...picked];
	});

export const getPrices = createServerFn({ method: "GET" })
	.validator(
		(d: {
			symbols: string[];
			start: string;
			end: string;
			interval: string;
		}) => ({
			symbols: Array.isArray(d?.symbols) ? d.symbols.map(String) : [],
			start: String(d?.start ?? ""),
			end: String(d?.end ?? ""),
			interval: String(d?.interval ?? "5m"),
		}),
	)
	.handler(async ({ data }): Promise<PriceSeries[]> => {
		const { getPriceSeries } = await import("./prices");
		return getPriceSeries(data.symbols, data.start, data.end, data.interval);
	});

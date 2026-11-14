import { createServerFn } from "@tanstack/react-start";
import type { PriceSeries } from "./research-types";

export const startResearchRun = createServerFn({ method: "POST" })
	.validator((d: { query: string }) => ({ query: String(d?.query ?? "") }))
	.handler(async ({ data }) => {
		const { startResearch } = await import("./research-service");
		return startResearch(data.query);
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
		return [...recent.filter((r) => r.status === "running"), ...picked];
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

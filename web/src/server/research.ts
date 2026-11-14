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

export const listResearchRuns = createServerFn({ method: "GET" }).handler(
	async () => {
		const { listRecentRuns } = await import("./research-db");
		return listRecentRuns(20);
	},
);

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

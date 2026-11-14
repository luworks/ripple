import { createServerFn } from "@tanstack/react-start";

// Agent Memory reads ONLY the demo-safe materialized views (db/agent-memory/demo-safe.sql):
// hackathon_agent_data.demo_events / demo_urls. Never query the raw tables from the web app.

export type AgentMemoryOverview = {
	searches: number;
	sessions: number;
	domains: number;
	machines: number;
	firstDay: string | null;
	lastDay: string | null;
};

let cached: Promise<AgentMemoryOverview> | undefined;

// The snapshot is static, so compute once per server process.
export const getAgentMemoryOverview = createServerFn({ method: "GET" }).handler(
	async (): Promise<AgentMemoryOverview> => {
		cached ??= (async () => {
			const { db } = await import("../db");
			const sql = db();
			const [row] = await sql`
				select
					(select count(*) from hackathon_agent_data.demo_events where event_type = 'search_operation')::int as searches,
					(select count(distinct session_key) from hackathon_agent_data.demo_events)::int as sessions,
					(select count(distinct reg_domain) from hackathon_agent_data.demo_urls)::int as domains,
					(select count(distinct machine) from hackathon_agent_data.demo_events)::int as machines,
					(select to_char(min(ts) at time zone 'America/Los_Angeles', 'YYYY-MM-DD') from hackathon_agent_data.demo_events) as first_day,
					(select to_char(max(ts) at time zone 'America/Los_Angeles', 'YYYY-MM-DD') from hackathon_agent_data.demo_events) as last_day`;
			return {
				searches: row.searches,
				sessions: row.sessions,
				domains: row.domains,
				machines: row.machines,
				firstDay: row.first_day,
				lastDay: row.last_day,
			};
		})().catch((err) => {
			cached = undefined;
			throw err;
		});
		return cached;
	},
);

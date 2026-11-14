// Contract between the Codex research agent (agent/), its runner and the /research UI.
// Mirrors agent/result.schema.json; keep the two in sync.

export type TickerRelation =
	| "direct"
	| "supplier"
	| "customer"
	| "competitor"
	| "partner"
	| "etf"
	| "other";

export type ResearchResult = {
	event: {
		title: string;
		summary: string;
		started_at: string; // ISO 8601 UTC
		status: "developing" | "concluded" | "upcoming";
	};
	people: { name: string; role: string; relevance: string }[];
	tickers: {
		symbol: string; // Yahoo Finance symbol
		name: string;
		relation: TickerRelation;
		rationale: string;
	}[];
	timeline: {
		time: string; // ISO 8601 UTC
		headline: string;
		detail: string;
		kind: "news" | "filing" | "official" | "social" | "market" | "analyst";
		source: string;
		url: string;
	}[];
	market: {
		window_start: string;
		window_end: string;
		interval: "1m" | "5m" | "15m" | "1h" | "1d";
		benchmarks: string[];
		observations: { symbol: string; change_pct: number | null; text: string }[];
	};
	impact_summary: string;
	open_questions: string[];
};

// Progress events streamed while the agent runs.
export type AgentEvent = {
	at: string; // ISO time
	kind: "status" | "tool" | "result" | "message" | "error" | "memory";
	text: string; // short human-readable line, e.g. "telem.telem_search: Jensen Huang resigns"
	call?: ToolCallTrace; // set by the runner from the raw tool call, never by the model
	memory?: MemoryTrace; // set on the one "memory" event emitted before the agent starts
};

// What memory recall found before the agent ran, plus the typical run it is compared with.
export type MemoryTrace = {
	runs: { id: string; query: string; at: string; similarity: number }[];
	best: number; // similarity of the closest earlier run, hit or not
	urls: string[]; // sources handed to the agent
	tickers: number;
	ms: number; // recall time
	// Median over earlier finished runs that had no memory hit.
	baseline: { runs: number; searchCalls: number; durationMs: number } | null;
};

// What one search/fetch tool call asked for ("tool" events) or returned ("result" events).
export type ToolCallTrace = {
	server: string;
	tool: string;
	queries?: string[];
	topic?: string;
	urls?: string[]; // pages requested by a fetch/extract call
	hits?: [provider: string, url: string][]; // search results, provider-attributed
	pages?: number; // pages a fetch/extract call returned
};

export type RunOutcome =
	| {
			ok: true;
			result: ResearchResult;
			durationMs: number;
			usage?: { inputTokens: number; outputTokens: number };
	  }
	| { ok: false; error: string; durationMs: number };

export type PriceSeries = {
	symbol: string;
	currency: string | null;
	points: { t: number; c: number }[]; // t = unix seconds, c = close
};

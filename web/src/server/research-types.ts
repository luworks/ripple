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
	kind: "status" | "tool" | "message" | "error";
	text: string; // short human-readable line, e.g. "telem.telem_search: Jensen Huang resigns"
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

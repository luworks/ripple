// Search-time budget the user picks per run. Client-safe: the form imports the options.
export const BUDGETS = [30, 60, 120, 240] as const;
export type Budget = (typeof BUDGETS)[number];
export const DEFAULT_BUDGET: Budget = 60;

export function toBudget(v: unknown): Budget {
	const n = Number(v);
	return (BUDGETS as readonly number[]).includes(n)
		? (n as Budget)
		: DEFAULT_BUDGET;
}

export const budgetLabel = (s: number) => (s < 60 ? `${s}s` : `${s / 60} min`);

// The agent can't see a clock, so the budget only steers it (see agent/AGENTS.md).
// The container is killed at the budget plus a margin so a slightly late answer still lands.
export const hardTimeoutMs = (s: Budget) => (s + Math.max(45, s / 2)) * 1000;

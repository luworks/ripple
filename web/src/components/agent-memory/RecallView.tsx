// Placeholder; the Recall view (memory search + 7-day top-domain chart) lands in its own PR.
export function RecallView({ q }: { q?: string }) {
	return (
		<div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-400">
			Recall is coming next{q ? ` (query: ${q})` : ""}.
		</div>
	);
}

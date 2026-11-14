import { createFileRoute } from "@tanstack/react-router";

// POST { query, budget? (30|60|120|240 s, default 120) } -> { id, cached } | { error } (400 / 429).
export const Route = createFileRoute("/api/research/")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const { startResearch } = await import("#/server/research-service");
				const { toBudget } = await import("#/server/research-budget");
				const body = (await request.json().catch(() => null)) as {
					query?: unknown;
					budget?: unknown;
				} | null;
				try {
					const r = await startResearch(
						String(body?.query ?? ""),
						toBudget(body?.budget),
					);
					return r.ok
						? Response.json({ id: r.id, cached: r.cached })
						: Response.json({ error: r.error }, { status: r.status });
				} catch (err) {
					return Response.json(
						{ error: err instanceof Error ? err.message : String(err) },
						{ status: 500 },
					);
				}
			},
		},
	},
});

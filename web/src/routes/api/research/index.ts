import { createFileRoute } from "@tanstack/react-router";

// POST { query } -> { id, cached } | { error } (400 / 429).
export const Route = createFileRoute("/api/research/")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const { startResearch } = await import("#/server/research-service");
				const body = (await request.json().catch(() => null)) as {
					query?: unknown;
				} | null;
				try {
					const r = await startResearch(String(body?.query ?? ""));
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

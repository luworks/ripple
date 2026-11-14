import { createFileRoute } from "@tanstack/react-router";
import type { AgentEvent } from "#/server/research-types";

// SSE: replay stored progress, stream live events, end with `done` or `error`.
// Events: `progress` (AgentEvent), `done` ({ result, durationMs }), `error` ({ error }).
export const Route = createFileRoute("/api/research/$id/events")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const { getRun } = await import("#/server/research-db");
				const { subscribe } = await import("#/server/research-service");
				const id = params.id;

				const enc = new TextEncoder();
				let cleanup = () => {};
				const stream = new ReadableStream<Uint8Array>({
					async start(controller) {
						let closed = false;
						const send = (event: string, data: unknown) => {
							if (closed) return;
							controller.enqueue(
								enc.encode(
									`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
								),
							);
						};
						const timers: ReturnType<typeof setInterval>[] = [];
						let unsub: (() => void) | null = null;
						const close = () => {
							if (closed) return;
							closed = true;
							for (const t of timers) clearInterval(t);
							unsub?.();
							try {
								controller.close();
							} catch {}
						};
						cleanup = close;
						request.signal.addEventListener("abort", close);

						// Subscribe before reading the row so nothing falls in the gap.
						const buffered: Parameters<Parameters<typeof subscribe>[1]>[0][] =
							[];
						let ready = false;
						const seen = new Set<string>();
						const key = (e: AgentEvent) => `${e.at}|${e.text}`;
						const onLive: Parameters<typeof subscribe>[1] = (m) => {
							if (!ready) {
								buffered.push(m);
								return;
							}
							if (m.type === "event") {
								if (seen.has(key(m.event))) return;
								seen.add(key(m.event));
								send("progress", m.event);
							} else if (m.type === "done") {
								send("done", { result: m.result, durationMs: m.durationMs });
								close();
							} else {
								send("error", { error: m.error, durationMs: m.durationMs });
								close();
							}
						};
						unsub = subscribe(id, onLive);

						const row = await getRun(id).catch(() => null);
						if (!row) {
							send("error", { error: "Run not found" });
							close();
							return;
						}
						send("run", { id: row.id, query: row.query, status: row.status });
						for (const e of row.events) {
							seen.add(key(e));
							send("progress", e);
						}
						if (row.status === "done" && row.result) {
							send("done", { result: row.result, durationMs: row.durationMs });
							return close();
						}
						if (row.status === "error") {
							send("error", { error: row.error ?? "Run failed" });
							return close();
						}
						timers.push(
							setInterval(() => {
								if (!closed) controller.enqueue(enc.encode(": ping\n\n"));
							}, 15000),
						);
						if (unsub) {
							ready = true;
							for (const m of buffered.splice(0)) onLive(m);
							return;
						}

						// Running in another process (or orphaned): poll the row.
						let sent = row.events.length;
						const createdAt = Date.parse(row.createdAt);
						timers.push(
							setInterval(async () => {
								const r = await getRun(id).catch(() => null);
								if (!r || closed) return;
								for (const e of r.events.slice(sent)) send("progress", e);
								sent = r.events.length;
								if (r.status === "done" && r.result) {
									send("done", { result: r.result, durationMs: r.durationMs });
									close();
								} else if (r.status === "error") {
									send("error", { error: r.error ?? "Run failed" });
									close();
								} else if (Date.now() - createdAt > 20 * 60 * 1000) {
									send("error", { error: "Run was interrupted" });
									close();
								}
							}, 1500),
						);
					},
					cancel() {
						cleanup();
					},
				});

				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache, no-transform",
						Connection: "keep-alive",
						"X-Accel-Buffering": "no",
					},
				});
			},
		},
	},
});

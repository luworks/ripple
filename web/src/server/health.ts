import { createServerFn } from "@tanstack/react-start";

export type DbHealth =
	| { ok: true; version: string; database: string; latencyMs: number }
	| { ok: false; error: string };

export const getDbHealth = createServerFn({ method: "GET" }).handler(
	async (): Promise<DbHealth> => {
		const { db } = await import("./db");
		const started = performance.now();
		try {
			const [row] =
				await db()`select current_setting('server_version') as version, current_database() as database`;
			return {
				ok: true,
				version: row.version,
				database: row.database,
				latencyMs: Math.round(performance.now() - started),
			};
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	},
);

import postgres from "postgres";

let sql: postgres.Sql | undefined;

// One lazily created pool per server process; DATABASE_URL comes from the repo-root .env.
export function db() {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error("DATABASE_URL is not set");
	sql ??= postgres(url, {
		max: 10,
		idle_timeout: 30,
		connect_timeout: 5,
		prepare: false,
	});
	return sql;
}

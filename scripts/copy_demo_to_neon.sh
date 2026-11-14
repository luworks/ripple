#!/usr/bin/env bash
# One-time, atomic copy of the two demo-safe views to an empty target schema.
# Requires SOURCE_CONTAINER and TARGET_DATABASE_URL in the environment.
set -euo pipefail
umask 077
: "${SOURCE_CONTAINER:?Set SOURCE_CONTAINER}"
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL}"
source_psql() { docker exec "$SOURCE_CONTAINER" psql -X -U brain0 -d brain0 -v ON_ERROR_STOP=1 -qAt "$@"; }
target_psql() {
  node -e '
const { spawnSync } = require("node:child_process");
const u = new URL(process.env.TARGET_DATABASE_URL);
const env = { ...process.env, PGHOST: u.hostname, PGPORT: u.port || "5432",
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.slice(1)), PGSSLMODE: u.searchParams.get("sslmode") || "prefer" };
if (u.searchParams.has("channel_binding")) env.PGCHANNELBINDING = u.searchParams.get("channel_binding");
const p = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-q"], { env, stdio: "inherit" });
process.exit(p.status ?? 1);
'
}
events=$(source_psql -c 'select count(*) from hackathon_agent_data.demo_events')
urls=$(source_psql -c 'select count(*) from hackathon_agent_data.demo_urls')
[[ "$events" =~ ^[0-9]+$ && "$urls" =~ ^[0-9]+$ ]]

{
  cat <<'SQL'
BEGIN;
CREATE SCHEMA hackathon_agent_data;
CREATE TABLE hackathon_agent_data.demo_events (
  id bigint, ts timestamptz, machine text, agent text, event_type text,
  tool text, model text, outcome text, session_key text, query_text text,
  query_hidden boolean
);
CREATE TABLE hackathon_agent_data.demo_urls (
  id bigint, event_id bigint, occurrence_kind text, occurrence_ordinal bigint,
  host text, reg_domain text, display_url text, url_hidden boolean
);
COPY hackathon_agent_data.demo_events FROM STDIN;
SQL
  source_psql -c 'COPY hackathon_agent_data.demo_events TO STDOUT'
  printf '\\.\n'
  printf 'COPY hackathon_agent_data.demo_urls FROM STDIN;\n'
  source_psql -c 'COPY hackathon_agent_data.demo_urls TO STDOUT'
  printf '\\.\n'
  cat <<SQL
DO \$\$ BEGIN
  IF (SELECT count(*) FROM hackathon_agent_data.demo_events) <> $events OR
     (SELECT count(*) FROM hackathon_agent_data.demo_urls) <> $urls THEN
    RAISE EXCEPTION 'Source and destination counts differ';
  END IF;
END \$\$;
CREATE UNIQUE INDEX demo_events_id_idx ON hackathon_agent_data.demo_events (id);
CREATE INDEX demo_events_ts_idx ON hackathon_agent_data.demo_events (ts);
CREATE INDEX demo_events_session_idx ON hackathon_agent_data.demo_events (session_key, ts);
CREATE INDEX demo_events_machine_ts_idx ON hackathon_agent_data.demo_events (machine, ts);
CREATE INDEX demo_events_query_fts_idx ON hackathon_agent_data.demo_events USING gin (to_tsvector('simple', coalesce(query_text, '')));
CREATE UNIQUE INDEX demo_urls_id_idx ON hackathon_agent_data.demo_urls (id);
CREATE INDEX demo_urls_event_idx ON hackathon_agent_data.demo_urls (event_id);
CREATE INDEX demo_urls_domain_idx ON hackathon_agent_data.demo_urls (reg_domain);
ANALYZE hackathon_agent_data.demo_events;
ANALYZE hackathon_agent_data.demo_urls;
COMMIT;
SQL
} | target_psql
printf 'Copied %s demo events and %s demo URLs; source left unchanged.\n' "$events" "$urls"

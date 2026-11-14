-- Agent Memory demo-safe layer.
--
-- The raw tables in hackathon_agent_data (sources, events, url_occurrences) are never read by
-- the web app. It reads only the two materialized views below, which:
--   * keep every event / URL row so counts stay exact,
--   * null out text that may be private (emails, phones, secrets, private hosts, own name,
--     job / tax / health topics, hidden domains), flagging it with *_hidden,
--   * expose URLs as host + path only (no ?query / #fragment),
--   * never expose source_path, session_id or agent_id (sessions get an opaque key).
--
-- Idempotent: safe to re-run; it rebuilds only the objects defined here (never raw tables).
--   docker exec -i brain0-postgres psql -U brain0 -d brain0 -v ON_ERROR_STOP=1 < db/agent-memory/demo-safe.sql

BEGIN;
SET search_path = hackathon_agent_data;

-- Registrable domain (eTLD+1) for the common multi-label public suffixes in this data.
CREATE OR REPLACE FUNCTION reg_domain(host text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN host IS NULL OR host = '' THEN NULL
    WHEN host ~ '^[0-9.]+$' OR host !~ '\.' THEN host
    WHEN array_length(p, 1) >= 3
         AND (p[array_length(p, 1) - 1] || '.' || p[array_length(p, 1)]) ~
             '^(com|net|org|gov|edu|ac|co|or|ne|go)\.(cn|hk|tw|uk|jp|au|kr|nz|sg|in|br|za|il|mx|my|th|id|ph|tr|ar)$'
      THEN array_to_string(p[array_length(p, 1) - 2:], '.')
    ELSE array_to_string(p[array_length(p, 1) - 1:], '.')
  END
  FROM (SELECT string_to_array(lower(rtrim(host, '.')), '.') AS p) s
$$;

-- Domains whose URLs are always hidden and which are folded into "Other" in charts.
-- Edit freely, then re-run this file.
CREATE TABLE IF NOT EXISTS demo_hidden_domains (
  domain text PRIMARY KEY,
  reason text NOT NULL
);
INSERT INTO demo_hidden_domains (domain, reason) VALUES
  ('greenhouse.io', 'job applications'), ('lever.co', 'job applications'),
  ('ashbyhq.com', 'job applications'), ('myworkdayjobs.com', 'job applications'),
  ('jobright.ai', 'job search'), ('linkedin.com', 'personal profile / job search'),
  ('indeed.com', 'job search'), ('glassdoor.com', 'job search'),
  ('ts.net', 'tailnet host'), ('local', 'local host'), ('localhost', 'local host'),
  ('drive.google.com', 'private documents'), ('docs.google.com', 'private documents'),
  ('sharepoint.com', 'private documents'), ('dropbox.com', 'private documents'),
  ('icloud.com', 'private documents'), ('1drv.ms', 'private documents'),
  ('onedrive.live.com', 'private documents'), ('box.com', 'private documents')
ON CONFLICT (domain) DO NOTHING;  -- config table only; never used for migrated data

-- Text that must never be shown verbatim.
CREATE OR REPLACE FUNCTION demo_text_unsafe(t text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT t IS NOT NULL AND (
       t ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'                                   -- email
    OR t ~ '(\(?\m\d{3}\)?[ .-]\d{3}[ .-]\d{4}\M|\+\d{1,3}[ .-]?\d{2,4}[ .-]\d{3,4}[ .-]?\d{3,4})'  -- phone
    OR t ~ '(sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[bpas]-|eyJ[A-Za-z0-9_-]{20,})'
    OR t ~* '[?&](token|key|api_?key|access_token|auth|sig|signature|password|code|session|email)='
    OR t ~* '(localhost|127\.0\.0\.1|\m10\.\d+\.\d+\.\d+|192\.168\.|\m100\.\d+\.\d+\.\d+|\.ts\.net|\.local\M|/Users/|/home/)'
    OR t ~ '[A-Za-z0-9_-]{40,}'                                                        -- signed links / tokens
    OR t ~* 'contact (email|info|number)|phone number|whatsapp|\me-?mail\M|邮箱'
    OR t ~* '(yuan ?lu|yuanlu|luworks|sn0admin)'
    OR t ~* '(resume|job|career|hiring|recruit|salary|offer letter|interview|简历|招聘|求职|薪|面试)'
    OR t ~* '(\mtax|irs\M|1099|\mw-?2\M|\mssn\M|bank|报税|银行|llc\M)'
    OR t ~* '(medical|doctor|clinic|diagnos|symptom|health insurance|医院|症状|病)'
    OR t ~* '(google\.[a-z.]+/maps|maps\.app\.goo\.gl|\maddress\M|\d+ [a-z]+ (st|ave|ct|rd|dr|blvd|ln|way)\M)'
  )
$$;

DROP MATERIALIZED VIEW IF EXISTS demo_urls;
DROP MATERIALIZED VIEW IF EXISTS demo_events;

CREATE MATERIALIZED VIEW demo_events AS
SELECT
  e.id,
  e.timestamp_utc                                         AS ts,
  s.storage_host                                          AS machine,
  CASE WHEN e.client LIKE 'codex%' THEN 'codex' ELSE e.client END AS agent,
  e.event_type,
  e.tool,
  e.model,
  e.outcome,
  left(md5(coalesce(e.session_id, 'source:' || e.source_id)), 16) AS session_key,
  CASE WHEN demo_text_unsafe(e.query_text) THEN NULL ELSE e.query_text END AS query_text,
  demo_text_unsafe(e.query_text)                          AS query_hidden
FROM events e
JOIN sources s ON s.id = e.source_id;

CREATE MATERIALIZED VIEW demo_urls AS
WITH u AS (
  SELECT u.id, u.event_id, u.occurrence_kind, u.occurrence_ordinal,
         lower(u.hostname) AS host, reg_domain(u.hostname) AS dom, u.url_raw
  FROM url_occurrences u
), h AS (
  SELECT u.*,
         (u.host IS NULL
          OR u.host ~ '^[0-9.]+$'
          OR EXISTS (SELECT 1 FROM demo_hidden_domains d
                     WHERE u.dom = d.domain OR u.host = d.domain OR u.host LIKE '%.' || d.domain)
          OR demo_text_unsafe(u.url_raw)) AS hidden
  FROM u
)
SELECT
  id, event_id, occurrence_kind, occurrence_ordinal,
  CASE WHEN hidden THEN NULL ELSE host END                                   AS host,
  CASE WHEN hidden THEN NULL ELSE dom END                                    AS reg_domain,
  CASE WHEN hidden THEN NULL
       ELSE regexp_replace(regexp_replace(url_raw, '^[a-z]+://', '', 'i'), '[?#].*$', '') END AS display_url,
  hidden                                                                      AS url_hidden
FROM h;

CREATE UNIQUE INDEX demo_events_id_idx ON demo_events (id);
CREATE INDEX demo_events_ts_idx ON demo_events (ts);
CREATE INDEX demo_events_session_idx ON demo_events (session_key, ts);
CREATE INDEX demo_events_machine_ts_idx ON demo_events (machine, ts);
CREATE INDEX demo_events_query_fts_idx ON demo_events
  USING gin (to_tsvector('simple', coalesce(query_text, '')));
CREATE UNIQUE INDEX demo_urls_id_idx ON demo_urls (id);
CREATE INDEX demo_urls_event_idx ON demo_urls (event_id);
CREATE INDEX demo_urls_domain_idx ON demo_urls (reg_domain);

ANALYZE demo_events;
ANALYZE demo_urls;
COMMIT;

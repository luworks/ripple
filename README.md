# brain0

Hackathon project.

## Development

Python tooling uses [uv](https://docs.astral.sh/uv/):

```bash
uv venv
uv pip install -e .   # once pyproject.toml exists
uv run pytest
```

## Workflow

- `main` is the trunk; small commits are pushed directly during the hackathon.
- CI (`.github/workflows/ci.yml`) runs lint and tests on every push and PR.

## Web (TanStack Start + PostgreSQL)

```bash
cd web
pnpm install
pnpm dev                        # http://localhost:3070, reads DATABASE_URL from env
pnpm build && PORT=3070 pnpm start   # production; loads ../.env
```

On dev-host the `brain0-web` systemd user service runs `vite dev` (HMR) in `./web`,
exposed tailnet-only via `tailscale serve --https=3070` → https://private-host:3070.
A `git pull` in `.` goes live immediately; no build or restart needed.
The site header lives in `web/src/components/SiteHeader.tsx`; don't add page-level headers.

## Research agent (`agent/`)

`/research` runs each query in a fresh `brain0-agent` container: Codex CLI (`codex exec --json
--output-schema`) driving three MCP servers — Telem and Tavily for search, and `agent/market`
(Yahoo Finance prices) — and returns JSON matching `agent/result.schema.json`.

- Our instructions live in `agent/AGENTS.md`; Codex's built-in system prompt is left untouched.
- Build after changing anything in `agent/`: `docker build -t brain0-agent agent`.
- CLI test: `docker run --rm --read-only --tmpfs /tmp -e OPENAI_API_KEY -e TELEM_API_KEY -e TAVILY_API_KEY brain0-agent "Jensen Huang resigns as Nvidia CEO"`.
- Model and effort: `AGENT_MODEL` (default `gpt-5.4-mini`), `AGENT_EFFORT` (default `low`); timeout `AGENT_TIMEOUT_MS` (240 s).
- The web server runs it via `web/src/server/agent-runner.ts`; charts re-fetch prices from Yahoo and never use numbers from the model.

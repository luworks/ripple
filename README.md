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
--output-schema`) driving MCP servers — Telem (dev `mcp.telem.ai` + hackathon `hack.telem.ai/mcp`, each with its own key) and Tavily for search, and `agent/market`
(Yahoo Finance prices) — and returns JSON matching `agent/result.schema.json`.

- Our instructions live in `agent/AGENTS.md`; Codex's built-in system prompt is left untouched.
- Build after changing anything in `agent/`: `docker build -t brain0-agent agent`.
- CLI test: `docker run --rm --read-only --tmpfs /tmp -e OPENAI_API_KEY -e TELEM_API_KEY -e TELEM_HACK_API_KEY -e TAVILY_API_KEY brain0-agent "Jensen Huang resigns as Nvidia CEO"`.
- Model and effort: `AGENT_MODEL` (default `gpt-5.4-mini`), `AGENT_EFFORT` (default `low`); timeout `AGENT_TIMEOUT_MS` (240 s).
- The web server runs it via `web/src/server/agent-runner.ts`; charts re-fetch prices from Yahoo and never use numbers from the model.

## Market data

`uv run scripts/fetch_stock.py NVDA ./data/market` saves every Yahoo Finance interval
(1m … 1mo) as Parquet under `data/market/NVDA/` (gitignored) and merges with earlier runs.
Yahoo keeps 1m bars for ~30 days and 2m–30m for 60 days, so run it weekly to keep them.
`/stock/nvda` reads those files (`MARKET_DATA_DIR`, default `../data/market` from `web/`).

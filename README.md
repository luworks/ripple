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

Deployed on dev-host as the `brain0-web` systemd user service, exposed tailnet-only via
`tailscale serve --https=3070` → https://private-host:3070

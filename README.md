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

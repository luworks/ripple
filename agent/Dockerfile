# brain0 research agent: Codex CLI + search MCPs (Telem, Tavily) + local market-data MCP.
FROM node:22-bookworm-slim
COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /usr/local/bin/uv
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* \
 && npm install -g @openai/codex@0.169.0 && npm cache clean --force

ENV UV_PYTHON_INSTALL_DIR=/opt/python UV_LINK_MODE=copy
COPY market/pyproject.toml /opt/market/pyproject.toml
RUN cd /opt/market && uv venv --python 3.12 -q && uv pip install -q -r pyproject.toml
COPY market/server.py /opt/market/server.py

RUN useradd -m -u 10001 agent
COPY config.toml /etc/brain0/codex-config.toml
COPY AGENTS.md result.schema.json /work/
COPY run.sh /usr/local/bin/run.sh
USER agent
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/run.sh"]

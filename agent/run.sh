#!/bin/sh
# Entrypoint: run one research query; stdout = Codex JSONL events, then one brain0.result line.
set -eu
query="${1:?usage: run.sh <query>}"
model="${AGENT_MODEL:-gpt-5.4-mini}"
effort="${AGENT_EFFORT:-low}"
cd /work
# Root fs is read-only at runtime; Codex needs a writable home, so build it on /tmp.
export CODEX_HOME=/tmp/codex
mkdir -p "$CODEX_HOME" && cp /etc/brain0/codex-config.toml "$CODEX_HOME/config.toml"
set +e
codex exec --json --ephemeral --skip-git-repo-check \
  -m "$model" -c "model_reasoning_effort=\"$effort\"" \
  --output-schema /work/result.schema.json -o /tmp/result.json -- "$query" </dev/null
code=$?
set -e
if [ -s /tmp/result.json ]; then
  printf '{"type":"brain0.result","result":%s}\n' "$(cat /tmp/result.json)"
else
  printf '{"type":"brain0.error","exit_code":%s}\n' "$code"
fi
exit "$code"

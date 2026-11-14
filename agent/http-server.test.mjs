import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("agent endpoint validates requests and streams one isolated run", async () => {
	const dir = mkdtempSync(join(tmpdir(), "brain0-agent-test-"));
	const executable = join(dir, "run.sh");
	writeFileSync(executable, '#!/bin/sh\nprintf \'{"type":"brain0.result","result":{"ok":true}}\\n\'\n', { mode: 0o700 });
	const probe = createServer();
	await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
	const port = probe.address().port;
	await new Promise((resolve) => probe.close(resolve));
	const child = spawn(process.execPath, [fileURLToPath(new URL("./http-server.mjs", import.meta.url))], {
		env: { ...process.env, PORT: String(port), AGENT_EXECUTABLE: executable }, stdio: "ignore",
	});
	const base = `http://127.0.0.1:${port}`;
	try {
		let ready = false;
		for (let i = 0; i < 50 && !ready; i++) {
			try { ready = (await fetch(`${base}/health`)).ok; } catch { await new Promise((r) => setTimeout(r, 50)); }
		}
		assert.ok(ready, "agent server did not start");
		assert.equal((await fetch(`${base}/run`, { method: "POST", body: '{}' })).status, 400);
		// Memory-first research can append verified context to the user's query.
		const response = await fetch(`${base}/run`, { method: "POST", body: JSON.stringify({ query: "test ".repeat(100) }) });
		assert.equal(response.status, 200);
		assert.equal(JSON.parse((await response.text()).trim()).type, "brain0.result");
	} finally {
		child.kill();
		rmSync(dir, { recursive: true, force: true });
	}
});

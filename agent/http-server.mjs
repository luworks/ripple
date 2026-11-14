// One request per isolated Cloudflare Container. The Worker supplies routing and
// authentication; the agent image retains its unprivileged user and Codex sandbox.
import { createServer } from "node:http";
import { spawn } from "node:child_process";

let running = false;
createServer(async (req, res) => {
	if (req.url === "/health" && req.method === "GET") {
		res.writeHead(200).end("ok");
		return;
	}
	if (req.url !== "/run" || req.method !== "POST" || running) {
		res.writeHead(running ? 409 : 404).end();
		return;
	}
	let body = "";
	for await (const chunk of req) {
		body += chunk;
		if (body.length > 65536) {
			res.writeHead(413).end();
			return;
		}
	}
	let query;
	try {
		query = JSON.parse(body).query;
	} catch {
		res.writeHead(400).end();
		return;
	}
	if (typeof query !== "string" || !query.trim() || query.length > 60000) {
		res.writeHead(400).end();
		return;
	}
	running = true;
	res.writeHead(200, { "content-type": "application/x-ndjson", "cache-control": "no-store" });
	const child = spawn(process.env.AGENT_EXECUTABLE ?? "/usr/local/bin/run.sh", [query], { stdio: ["ignore", "pipe", "ignore"] });
	child.stdout.pipe(res, { end: false });
	// Backstop only: the web app aborts at the run's budget plus margin (max 360 s).
	const timeout = setTimeout(() => child.kill("SIGKILL"), 360_000);
	res.on("close", () => child.kill("SIGKILL"));
	child.on("error", () => res.end('{"type":"brain0.error","exit_code":1}\n', () => process.exit(1)));
	child.on("close", () => { clearTimeout(timeout); res.end(() => process.exit(0)); });
}).listen(Number(process.env.PORT ?? 8080), "0.0.0.0");

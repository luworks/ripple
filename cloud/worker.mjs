import { Container, getContainer } from "@cloudflare/containers";
import { env } from "cloudflare:workers";
import plan from "../web/src/data/jensen-huang-scan-plan.json";

export class WebContainer extends Container {
	defaultPort = 8080;
	sleepAfter = "10m";
	envVars = {
		HOST: "0.0.0.0", PORT: "8080", NODE_ENV: "production",
		DATABASE_URL: env.DATABASE_URL,
		OPENAI_API_KEY: env.OPENAI_API_KEY,
		TELEM_HACK_API_KEY: env.TELEM_HACK_API_KEY,
		AGENT_ENDPOINT: `${env.PUBLIC_ORIGIN}/__internal/agent`,
		AGENT_INTERNAL_TOKEN: env.AGENT_INTERNAL_TOKEN,
		RESEARCH_DAILY_LIMIT: "10",
		RESEARCH_MAX_CONCURRENT: "3",
	};
}

export class AgentContainer extends Container {
	defaultPort = 8080;
	sleepAfter = "5m";
	envVars = {
		OPENAI_API_KEY: env.OPENAI_API_KEY,
		TELEM_HACK_API_KEY: env.TELEM_HACK_API_KEY,
		TAVILY_API_KEY: env.TAVILY_API_KEY,
	};
}

async function equal(a, b) {
	if (!a || !b) return false;
	const encode = (s) => new TextEncoder().encode(s);
	const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", encode(a)), crypto.subtle.digest("SHA-256", encode(b))]);
	return crypto.subtle.timingSafeEqual(x, y);
}

// Hourly: set the Jensen Huang monitor's check rate to the plan's rate for today (PT).
async function applyScanPlan(key) {
	const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
	const frequency = plan.days.find((d) => today >= d.from && today <= d.to)?.frequency ?? plan.defaultFrequency;
	const url = `https://hack.telem.ai/api/v1/monitors/${plan.monitorId}`;
	const headers = { authorization: `Bearer ${key}`, "content-type": "application/json" };
	const monitor = await fetch(url, { headers }).then((r) => (r.ok ? r.json() : null));
	if (!monitor || monitor.status !== "active" || monitor.frequency === frequency) return;
	const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify({ frequency }) });
	console.log(`scan plan: ${monitor.frequency} -> ${frequency} (${res.status})`);
}

// Browser caching for files that are the same for every visitor. Pages, API
// responses and version.txt stay uncached.
const STATIC_FILE = /^\/(media|art|fonts|logos)\/|^\/avatar-[^/]+\.webp$/;
function cacheControl(pathname, status) {
	if (status === 200 || status === 206 || status === 304) {
		// Vite puts a content hash in every /assets/ file name.
		if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
		// A deploy can replace these under the same name: fresh for an hour, then
		// shown from cache while the browser re-checks in the background.
		if (STATIC_FILE.test(pathname)) return "public, max-age=3600, stale-while-revalidate=86400";
	}
	return "private, no-store";
}

export default {
	async scheduled(_controller, bindings, ctx) {
		ctx.waitUntil(applyScanPlan(bindings.TELEM_HACK_API_KEY));
	},
	async fetch(request, bindings) {
		const url = new URL(request.url);
		if (url.pathname === "/__internal/agent") {
			if (!bindings.AGENT_INTERNAL_TOKEN || request.method !== "POST" || !(await equal(request.headers.get("authorization"), `Bearer ${bindings.AGENT_INTERNAL_TOKEN}`)))
				return new Response("Not found", { status: 404 });
			return getContainer(bindings.AGENT, crypto.randomUUID()).fetch(new Request("http://container/run", request));
		}
		if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
			const origin = request.headers.get("origin");
			if (origin && origin !== url.origin) return new Response("Forbidden", { status: 403 });
		}
		// One web container per deploy: a running container keeps its image, so each
		// deploy starts a fresh one and the previous one sleeps once traffic stops.
		const headers = new Headers(request.headers);
		headers.delete("authorization");
		const response = await getContainer(bindings.WEB, `site-${bindings.VERSION.id}`).fetch(new Request(request, { headers }));
		const responseHeaders = new Headers(response.headers);
		const cacheable = request.method === "GET" || request.method === "HEAD";
		responseHeaders.set("Cache-Control", cacheable ? cacheControl(url.pathname, response.status) : "private, no-store");
		return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
	},
};

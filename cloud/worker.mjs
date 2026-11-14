import { Container, getContainer } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

export class WebContainer extends Container {
	defaultPort = 8080;
	sleepAfter = "10m";
	envVars = {
		HOST: "0.0.0.0", PORT: "8080", NODE_ENV: "production",
		DATABASE_URL: env.DATABASE_URL,
		OPENAI_API_KEY: env.OPENAI_API_KEY,
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

export default {
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
		const headers = new Headers(request.headers);
		headers.delete("authorization");
		const response = await getContainer(bindings.WEB, "site").fetch(new Request(request, { headers }));
		const responseHeaders = new Headers(response.headers);
		responseHeaders.set("Cache-Control", "private, no-store");
		return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
	},
};

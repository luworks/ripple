import { bindings, defineConfig, defineContainer, exports } from "cf/config";

const web = defineContainer({
	name: "brain0-web",
	image: { dockerfile: "../web/Dockerfile.cloud", buildContext: ".." },
	instanceType: "basic",
	maxInstances: 1,
});
const agent = defineContainer({
	name: "brain0-agent",
	image: { dockerfile: "../agent/Dockerfile.cloud", buildContext: "../agent" },
	instanceType: "basic",
	maxInstances: 3,
});

export default defineConfig({
	worker: {
		name: "brain0-search",
		entrypoint: "./worker.mjs",
		compatibilityDate: "2026-11-14",
		workersDev: process.env.CF_ATTACH_DOMAIN !== "1",
		previewUrls: false,
		domains: process.env.CF_ATTACH_DOMAIN === "1" ? ["search.chaorders.com"] : [],
		observability: { enabled: true, redactQueryString: true, traces: { enabled: true, headSamplingRate: 0.1 } },
		exports: {
			WebContainer: exports.durableObject({ storage: "sqlite", container: web }),
			AgentContainer: exports.durableObject({ storage: "sqlite", container: agent }),
		},
		env: {
			WEB: bindings.durableObject({ worker: "brain0-search", exportName: "WebContainer" }),
			AGENT: bindings.durableObject({ worker: "brain0-search", exportName: "AgentContainer" }),
			DATABASE_URL: bindings.secret(),
			OPENAI_API_KEY: bindings.secret(),
			TELEM_HACK_API_KEY: bindings.secret(),
			TAVILY_API_KEY: bindings.secret(),
			AGENT_INTERNAL_TOKEN: bindings.secret(),
			PUBLIC_ORIGIN: bindings.secret(),
			VERSION: bindings.versionMetadata(),
		},
	},
	containers: [web, agent],
});

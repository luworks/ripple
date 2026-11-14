import { useState } from "react";
import type { TelemCredit } from "#/data/jensen-huang-view";

const FEATURE_HINT = {
	Search: "Telem Search (POST /v1/search) routed the query to these providers",
	Fetch:
		"Telem Fetch (POST /v1/fetch) read the page; image from the provider's thumbnail",
};

/** Small "found with Telem" footer listing the Telem feature, provider(s) and query. */
export function TelemCredits({
	credits,
	compact = false,
}: {
	credits: TelemCredit[];
	compact?: boolean;
}) {
	return (
		<div
			className={`flex flex-col gap-1 ${compact ? "text-[11px]" : "text-xs"} text-zinc-500`}
		>
			{credits.map((c) => (
				<div
					key={`${c.feature}-${c.what}`}
					className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5"
					title={FEATURE_HINT[c.feature]}
				>
					<TelemMark />
					<span className="font-medium text-zinc-300">Telem {c.feature}</span>
					<span className="text-zinc-600">·</span>
					<span>{c.what}</span>
					{c.providers.length > 0 && (
						<>
							<span className="text-zinc-600">·</span>
							<span className="font-mono text-zinc-400">
								{c.providers.join(" + ")}
							</span>
						</>
					)}
					{c.query && !compact && (
						<>
							<span className="text-zinc-600">·</span>
							<span className="text-zinc-500">“{c.query}”</span>
						</>
					)}
				</div>
			))}
		</div>
	);
}

export function TelemMark() {
	return (
		<span className="inline-flex h-4 w-4 items-center justify-center rounded bg-emerald-400/15 font-mono text-[10px] font-bold text-emerald-300">
			T
		</span>
	);
}

/** Remote image that hides itself if the publisher blocks hotlinking. */
export function RemoteImage({
	src,
	alt,
	className,
}: {
	src: string;
	alt: string;
	className?: string;
}) {
	const [failed, setFailed] = useState(false);
	if (failed) return null;
	return (
		<img
			src={src}
			alt={alt}
			loading="lazy"
			referrerPolicy="no-referrer"
			onError={() => setFailed(true)}
			className={className}
		/>
	);
}

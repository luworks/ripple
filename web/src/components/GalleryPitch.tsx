import { Link } from "@tanstack/react-router";
import { useState } from "react";

/* One-scroll product page laid out like a gallery wall: one painting, one
   sentence, the verbs as numbered figures, then a price list. All copy is real
   text; the paintings never carry words. */

export type Pitch = {
	kicker: string;
	title: React.ReactNode;
	lede: string;
	facts: {
		value: string;
		label: string;
		note: string;
		/** Full list behind the note, shown on hover, focus or tap. */
		detail?: { title: string; groups: { title: string; items: string[] }[] };
	}[];
	cta: { label: string; href: string };
	setup: { label: string; command: string };
	painting: { src: string; alt: string; title: string; caption: string };
	verbsTitle: string;
	verbs: {
		name: string;
		src: string;
		alt: string;
		line: string;
		when: string;
		cost: string;
		color?: string;
	}[];
	price: {
		title: string;
		body: string;
		rows: { label: string; value: string; note?: string }[];
		foot: string;
	};
	credit: string;
	sources: { label: string; href: string }[];
	guide: "/telem/guide" | "/tavily/guide";
	next: { label: string; to: "/telem" | "/tavily" };
	theme: {
		paper: string;
		wall: string;
		ink: string;
		muted: string;
		rule: string;
		accent: string;
	};
};

const COLS: Record<number, string> = {
	4: "lg:grid-cols-4",
	5: "lg:grid-cols-5",
};

const KICKER =
	"flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] sm:text-[11px] sm:tracking-[0.22em]";

export function GalleryPitch({ pitch }: { pitch: Pitch }) {
	const t = pitch.theme;
	const vars = {
		"--paper": t.paper,
		"--wall": t.wall,
		"--ink": t.ink,
		"--muted": t.muted,
		"--rule": t.rule,
		"--accent": t.accent,
	} as React.CSSProperties;

	return (
		<main
			style={vars}
			className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased"
		>
			<Hero pitch={pitch} />
			<Verbs pitch={pitch} />
			<PriceList pitch={pitch} />
			<footer className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs leading-relaxed text-[var(--muted)] sm:px-8 lg:flex-row lg:items-baseline lg:justify-between">
				<p className="max-w-2xl">
					{pitch.credit} Paintings are AI-generated for this page. Sources, read
					Nov 14, 2026:{" "}
					{pitch.sources.map((s, i) => (
						<span key={s.href}>
							{i > 0 && ", "}
							<a
								href={s.href}
								target="_blank"
								rel="noreferrer"
								className="underline decoration-[var(--rule)] underline-offset-2 hover:text-[var(--ink)]"
							>
								{s.label}
							</a>
						</span>
					))}
					.
				</p>
				<p className="flex shrink-0 gap-5 text-[var(--ink)]">
					<Link to={pitch.guide} className="hover:text-[var(--accent)]">
						Field notes: what we measured →
					</Link>
					<Link to={pitch.next.to} className="hover:text-[var(--accent)]">
						{pitch.next.label} →
					</Link>
				</p>
			</footer>
		</main>
	);
}

function Hero({ pitch }: { pitch: Pitch }) {
	const p = pitch.painting;
	return (
		<section className="relative">
			<img
				src={p.src}
				alt={p.alt}
				width={1536}
				height={1024}
				fetchPriority="high"
				className="gallery-art h-[36svh] w-full object-cover object-[78%_50%] lg:absolute lg:inset-y-0 lg:right-0 lg:h-full lg:w-[60%]"
			/>
			<div className="relative mx-auto max-w-6xl px-5 sm:px-8">
				<div className="-mt-6 flex max-w-[35rem] flex-col gap-7 pb-12 lg:mt-0 lg:min-h-[min(calc(100svh-4rem),45rem)] lg:justify-center lg:py-14">
					<p className={KICKER}>
						<span className="hidden h-px w-8 bg-current sm:block" />
						{pitch.kicker}
					</p>
					<h1 className="font-display text-[3.4rem] leading-[0.94] sm:text-7xl lg:text-[5.5rem] [&_em]:text-[var(--accent)]">
						{pitch.title}
					</h1>
					<p className="max-w-[31rem] text-lg leading-relaxed">{pitch.lede}</p>
					<dl className="relative flex divide-x divide-[var(--rule)]">
						{pitch.facts.map((f) => (
							<div
								key={f.label}
								// focusable, so the list also opens from the keyboard and on tap
								tabIndex={f.detail ? 0 : undefined}
								className={`group flex flex-col-reverse px-4 outline-none first:pl-0 sm:px-6 ${f.detail ? "cursor-help" : ""}`}
							>
								<dt className="mt-1 text-sm leading-tight">
									<span className="font-medium">{f.label}</span>
									<span
										className={`block text-xs text-[var(--muted)] ${f.detail ? "underline decoration-dotted underline-offset-2 group-hover:text-[var(--ink)] group-focus-visible:text-[var(--ink)]" : ""}`}
									>
										{f.note}
									</span>
									{f.detail && <FactDetail detail={f.detail} />}
								</dt>
								<dd className="font-display text-4xl leading-none sm:text-5xl">
									{f.value}
								</dd>
							</div>
						))}
					</dl>
					<div className="flex flex-wrap items-center gap-3">
						<a
							href={pitch.cta.href}
							target="_blank"
							rel="noreferrer"
							className="flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-medium text-[var(--paper)] transition-opacity hover:opacity-85"
						>
							{pitch.cta.label}
							<svg
								viewBox="0 0 12 12"
								aria-hidden="true"
								className="h-3 w-3 fill-none stroke-current stroke-[1.5]"
							>
								<path d="M3 9l6-6M4 3h5v5" />
							</svg>
						</a>
						<CopyButton
							text={pitch.setup.command}
							label={pitch.setup.label}
							className="rounded-full border border-[var(--ink)]/30 px-5 py-3 text-sm font-medium transition-colors hover:border-[var(--ink)]"
						/>
					</div>
				</div>
			</div>
			<p className="absolute bottom-6 right-6 hidden max-w-[15rem] border border-[var(--rule)] bg-[var(--paper)]/90 px-3 py-2 text-[11px] leading-snug text-[var(--muted)] backdrop-blur-sm lg:block">
				<span className="block font-display text-base italic leading-tight text-[var(--ink)]">
					{p.title}
				</span>
				{p.caption}
			</p>
		</section>
	);
}

/* The whole list behind a fact, as a gallery wall label. It opens upward from
   the facts row: there is always room above it, on desktop and on a phone. */
function FactDetail({
	detail,
}: {
	detail: NonNullable<Pitch["facts"][number]["detail"]>;
}) {
	return (
		<span
			role="tooltip"
			className="invisible absolute bottom-full left-0 z-20 block w-full max-w-[30rem] pb-3 opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100"
		>
			<span className="block cursor-default border border-[var(--rule)] bg-[var(--paper)] px-5 py-4 shadow-[0_18px_40px_-18px_rgba(40,30,10,0.35)]">
				<span className="block font-display text-xl italic">
					{detail.title}
				</span>
				{detail.groups.map((g) => (
					<span key={g.title} className="mt-3 block">
						<span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
							{g.title} · {g.items.length}
						</span>
						<span className="mt-0.5 block text-[13px] leading-relaxed">
							{g.items.map((item, i) => (
								<span key={item}>
									<span className="whitespace-nowrap">
										{item}
										{i < g.items.length - 1 && " ·"}
									</span>{" "}
								</span>
							))}
						</span>
					</span>
				))}
			</span>
		</span>
	);
}

function Verbs({ pitch }: { pitch: Pitch }) {
	return (
		<section className="mx-auto max-w-6xl px-5 pb-12 pt-4 sm:px-8 lg:pt-12">
			<div className="flex items-baseline justify-between gap-4 border-b border-[var(--rule)] pb-3">
				<h2 className="font-display text-3xl sm:text-4xl">
					{pitch.verbsTitle}
				</h2>
				<p className={`${KICKER} hidden sm:flex`}>
					Fig. 1–{pitch.verbs.length}
				</p>
			</div>
			<ol
				className={`-mx-5 mt-6 flex snap-x snap-mandatory scroll-px-5 gap-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 ${COLS[pitch.verbs.length]}`}
			>
				{pitch.verbs.map((v, i) => (
					<li
						key={v.name}
						className="flex w-[70%] shrink-0 snap-start flex-col sm:w-auto"
					>
						<div className="border border-[var(--rule)] bg-white/70 p-1.5">
							<img
								src={v.src}
								alt={v.alt}
								width={480}
								height={480}
								loading="lazy"
								className="aspect-square w-full object-cover"
							/>
						</div>
						<p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
							Fig. {i + 1}
						</p>
						<h3
							className="font-display text-[2rem] leading-tight"
							style={{ color: v.color ?? "var(--accent)" }}
						>
							{v.name}
						</h3>
						<p className="mt-1 text-[15px] leading-snug">{v.line}</p>
						<p className="mt-2 text-sm leading-snug text-[var(--muted)]">
							<span className="font-display text-base italic">Use when</span>{" "}
							{v.when}
						</p>
						<p className="mt-auto pt-3">
							<span className="block border-t border-[var(--rule)] pt-2 font-mono text-xs">
								{v.cost}
							</span>
						</p>
					</li>
				))}
			</ol>
		</section>
	);
}

function PriceList({ pitch }: { pitch: Pitch }) {
	const pr = pitch.price;
	return (
		<section className="border-y border-[var(--rule)] bg-[var(--wall)]">
			<div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:py-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
				<div className="flex min-w-0 flex-col gap-5">
					<p className={KICKER}>
						<span className="hidden h-px w-8 bg-current sm:block" />
						Price list
					</p>
					<h2 className="font-display text-5xl leading-[0.98] sm:text-6xl">
						{pr.title}
					</h2>
					<p className="max-w-md text-lg leading-relaxed">{pr.body}</p>
				</div>
				<div className="flex min-w-0 flex-col gap-6">
					<dl className="flex flex-col gap-4">
						{pr.rows.map((r) => (
							<div key={r.label}>
								<div className="flex items-baseline gap-3">
									<dt className="font-display text-2xl">{r.label}</dt>
									<span className="flex-1 -translate-y-1 border-b border-dotted border-[var(--muted)]/60" />
									<dd className="font-mono text-sm tabular-nums sm:text-base">
										{r.value}
									</dd>
								</div>
								{r.note && (
									<p className="text-xs text-[var(--muted)]">{r.note}</p>
								)}
							</div>
						))}
					</dl>
					<p className="text-sm leading-relaxed text-[var(--muted)]">
						{pr.foot}
					</p>
					<div className="flex items-start gap-3 border border-[var(--rule)] bg-[var(--paper)] px-4 py-3">
						<code className="min-w-0 flex-1 break-words font-mono text-xs leading-relaxed">
							{pitch.setup.command}
						</code>
						<CopyButton
							text={pitch.setup.command}
							label="Copy"
							className="shrink-0 font-mono text-xs uppercase leading-relaxed tracking-widest text-[var(--accent)] hover:underline"
						/>
					</div>
				</div>
			</div>
		</section>
	);
}

function CopyButton({
	text,
	label,
	className,
}: {
	text: string;
	label: string;
	className: string;
}) {
	const [copied, setCopied] = useState(false);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			/* clipboard blocked: the command is still visible in the price list */
		}
	};
	return (
		<button type="button" onClick={copy} className={className}>
			{copied ? "Copied" : label}
		</button>
	);
}

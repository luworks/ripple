import { Link } from "@tanstack/react-router";
import { useState } from "react";

/* One-scroll product page laid out like a gallery wall: one painting, one
   sentence, the verbs as numbered figures, then a price list. All copy is real
   text; the paintings never carry words.

   Every page built on this is the same room with different pictures: each
   block is the same size and sits at the same height on every page, so moving
   between them shifts nothing. Text that differs between pages is laid out
   through <Same>; verb cards reserve their lines, because the column count
   differs; card pictures get one height whatever the column count. */

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
		title: React.ReactNode;
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

type Room = {
	pitch: Pitch;
	/** Every gallery page, this one included. */
	rooms: Pitch[];
};

export function GalleryPitch({ pitch, rooms }: Room) {
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
			<Hero pitch={pitch} rooms={rooms} />
			<Verbs pitch={pitch} />
			<PriceList pitch={pitch} rooms={rooms} />
			<footer className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs leading-relaxed text-[var(--muted)] sm:px-8 lg:flex-row lg:items-baseline lg:justify-between">
				<p className="grid max-w-2xl grid-cols-1">
					<Same pitch={pitch} rooms={rooms} pick={credit} />
				</p>
				<p className="flex shrink-0 gap-5 text-[var(--ink)]">
					<Link to={pitch.guide} className="hover:text-[var(--accent)]">
						Field notes: what we measured →
					</Link>
					<Link
						to={pitch.next.to}
						className="grid grid-cols-1 hover:text-[var(--accent)]"
					>
						<Same
							pitch={pitch}
							rooms={rooms}
							pick={(r) => `${r.next.label} →`}
						/>
					</Link>
				</p>
			</footer>
		</main>
	);
}

/* This page's text in one grid cell, with the same text from every other room
   laid out invisibly in that cell. The cell takes the size of the longest, so
   the block is the same size on every page at any width and in any font.
   The parent must be a one-column grid. */
function Same({
	pitch,
	rooms,
	pick,
	className = "",
}: Room & {
	pick: (room: Pitch) => React.ReactNode;
	/** Applied to this page's text only. */
	className?: string;
}) {
	return rooms.map((room) => {
		const text = pick(room);
		if (text == null) return null;
		return room === pitch ? (
			<span key={room.guide} className={`col-start-1 row-start-1 ${className}`}>
				{text}
			</span>
		) : (
			<span
				key={room.guide}
				aria-hidden="true"
				className="invisible col-start-1 row-start-1"
			>
				{text}
			</span>
		);
	});
}

function credit(room: Pitch) {
	return (
		<>
			{room.credit} Paintings are AI-generated for this page. Sources, read Nov
			14, 2026:{" "}
			{room.sources.map((s, i) => (
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
		</>
	);
}

function Hero({ pitch, rooms }: Room) {
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
				<div className="-mt-6 flex max-w-[35rem] flex-col gap-7 pb-12 lg:mt-0 lg:min-h-[min(calc(100svh-4rem),44rem)] lg:justify-center lg:py-14">
					<p className={KICKER}>
						<span className="hidden h-px w-8 bg-current sm:block" />
						{pitch.kicker}
					</p>
					<h1 className="font-display text-[clamp(2.75rem,14.5vw,3.4rem)] leading-[0.94] sm:text-7xl lg:text-[5.5rem] [&_em]:text-[var(--accent)]">
						{pitch.title}
					</h1>
					<p className="grid max-w-[31rem] grid-cols-1 text-lg leading-relaxed">
						<Same pitch={pitch} rooms={rooms} pick={(r) => r.lede} />
					</p>
					<dl className="relative grid grid-cols-3 divide-x divide-[var(--rule)]">
						{pitch.facts.map((f, i) => (
							<div
								key={f.label}
								// focusable, so the list also opens from the keyboard and on tap
								tabIndex={f.detail ? 0 : undefined}
								className={`group flex min-w-0 flex-col-reverse justify-end px-3 outline-none first:pl-0 last:pr-0 sm:px-6 ${f.detail ? "cursor-help" : ""}`}
							>
								<dt className="mt-1 text-sm leading-tight">
									<span className="block whitespace-nowrap font-medium">
										{f.label}
									</span>
									<span className="grid grid-cols-1 text-xs text-[var(--muted)]">
										<Same
											pitch={pitch}
											rooms={rooms}
											pick={(r) => r.facts[i]?.note}
											className={
												f.detail
													? "underline decoration-dotted underline-offset-2 group-hover:text-[var(--ink)] group-focus-visible:text-[var(--ink)]"
													: ""
											}
										/>
									</span>
									{f.detail && <FactDetail detail={f.detail} />}
								</dt>
								<dd className="whitespace-nowrap font-display text-[clamp(1.875rem,10vw,2.25rem)] leading-none sm:text-5xl">
									{f.value}
								</dd>
							</div>
						))}
					</dl>
					<div className="flex items-center gap-2 sm:gap-3">
						<a
							href={pitch.cta.href}
							target="_blank"
							rel="noreferrer"
							className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[var(--ink)] px-4 py-3 text-sm font-medium text-[var(--paper)] transition-opacity hover:opacity-85 sm:px-5"
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
							className="whitespace-nowrap rounded-full border border-[var(--ink)]/30 px-4 py-3 text-sm font-medium transition-colors hover:border-[var(--ink)] sm:px-5"
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
				className={`-mx-5 mt-6 flex snap-x snap-mandatory scroll-px-5 gap-5 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:grid lg:overflow-visible lg:px-0 ${COLS[pitch.verbs.length]}`}
			>
				{pitch.verbs.map((v, i) => (
					<li
						key={v.name}
						className="flex w-[70%] shrink-0 snap-start flex-col sm:w-[38%] lg:w-auto"
					>
						<div className="border border-[var(--rule)] bg-white/70 p-1.5">
							<img
								src={v.src}
								alt={v.alt}
								width={480}
								height={480}
								loading="lazy"
								className="aspect-square w-full object-cover lg:aspect-auto lg:h-[min(15.5vw,14rem)]"
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
						{/* three lines reserved for the description, two for "use when" */}
						<p className="mt-1 min-h-[3lh] text-[15px] leading-snug">
							{v.line}
						</p>
						<p className="mt-2 min-h-[2.75rem] text-sm leading-snug text-[var(--muted)]">
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

function PriceList({ pitch, rooms }: Room) {
	const pr = pitch.price;
	return (
		<section className="border-y border-[var(--rule)] bg-[var(--wall)]">
			<div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:py-9 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
				<div className="flex min-w-0 flex-col gap-5">
					<p className={KICKER}>
						<span className="hidden h-px w-8 bg-current sm:block" />
						Price list
					</p>
					<h2 className="font-display text-5xl leading-[0.98] sm:text-6xl">
						{pr.title}
					</h2>
					<p className="grid max-w-md grid-cols-1 text-lg leading-relaxed">
						<Same pitch={pitch} rooms={rooms} pick={(r) => r.price.body} />
					</p>
				</div>
				<div className="flex min-w-0 flex-col gap-6">
					<dl className="flex flex-col gap-3">
						{pr.rows.map((r, i) => (
							<div key={r.label}>
								<div className="flex items-baseline gap-3">
									{/* one line at any width: the price shrinks before it wraps */}
									<dt className="whitespace-nowrap font-display text-2xl">
										{r.label}
									</dt>
									<span className="flex-1 -translate-y-1 border-b border-dotted border-[var(--muted)]/60" />
									<dd className="whitespace-nowrap font-mono text-[clamp(0.75rem,3.6vw,0.875rem)] tabular-nums sm:text-base">
										{r.value}
									</dd>
								</div>
								{/* always there, so every row has the same pitch */}
								<p className="grid min-h-4 grid-cols-1 text-xs text-[var(--muted)]">
									<Same
										pitch={pitch}
										rooms={rooms}
										pick={(room) => room.price.rows[i]?.note}
									/>
								</p>
							</div>
						))}
					</dl>
					<p className="grid grid-cols-1 text-sm leading-relaxed text-[var(--muted)]">
						<Same pitch={pitch} rooms={rooms} pick={(r) => r.price.foot} />
					</p>
					<div className="flex items-center gap-3 border border-[var(--rule)] bg-[var(--paper)] px-4 py-3">
						<code className="grid min-w-0 flex-1 grid-cols-1 items-center break-words font-mono text-xs leading-relaxed">
							<Same pitch={pitch} rooms={rooms} pick={(r) => r.setup.command} />
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

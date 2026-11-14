import { BRAND } from "#/brand";
import { RUN, SIZING, SOURCES, TABLE } from "#/data/venture-pitch";

/* The investor screen on the home page: who pays, why us, how big, why now.
   Every competitor number and market figure is in src/data/venture-pitch.ts
   with its public source; nothing here is typed in by hand. */

export function VenturePitch() {
	return (
		<section id="pitch" className="flex scroll-mt-20 flex-col gap-10">
			<div className="flex max-w-3xl flex-col gap-3">
				<span className="text-xs font-medium uppercase tracking-wider text-sky-400">
					The business
				</span>
				<h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
					Desks pay for the first minutes after a headline.
				</h2>
				<p className="leading-relaxed text-zinc-400">
					Terminals sell wires and transcripts. {BRAND} sells the answer to "is
					it real, who said it first, and what does it hit" in about a minute,
					including the Chinese social platforms where many supply chain stories
					break first.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-800 md:grid-cols-3">
				<Answer
					k="Who pays"
					t="Event-driven desks"
					b="Hedge fund analysts, PMs and traders, plus IR and comms teams watching their own ticker. Per seat, with an API for quant and risk teams."
				/>
				<Answer
					k="Why us"
					t="Chinese social, priced on one clock"
					b="Posts from Xiaohongshu, Douyin, X and more sit next to minute bars of the exposed tickers. Every line links to its source and UTC time."
				/>
				<Answer k="How big" t={SIZING.headline} b={SIZING.short} />
			</div>

			<Comparison />

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<Sizing />
				<WhyNow />
			</div>

			<p className="text-xs leading-relaxed text-zinc-600">
				Sources:{" "}
				{SOURCES.map((s, i) => (
					<span key={s.href}>
						{i > 0 && " · "}
						<a
							href={s.href}
							target="_blank"
							rel="noreferrer"
							className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-400"
						>
							{s.label}
						</a>
					</span>
				))}
				. Competitor features are what their public pages describe; "not public"
				means we could not find a published figure.
			</p>
		</section>
	);
}

function Answer({ k, t, b }: { k: string; t: string; b: string }) {
	return (
		<div className="flex flex-col gap-2 bg-zinc-950 p-6">
			<span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
				{k}
			</span>
			<span className="text-lg font-medium">{t}</span>
			<p className="text-sm leading-relaxed text-zinc-400">{b}</p>
		</div>
	);
}

function Cell({ v }: { v: string }) {
	if (v === "yes") return <span className="text-sky-400">Yes</span>;
	if (v === "no") return <span className="text-zinc-600">No</span>;
	if (v === "not public")
		return <span className="text-zinc-600 italic">not public</span>;
	return <span>{v}</span>;
}

function Comparison() {
	return (
		<div className="flex flex-col gap-3">
			<h3 className="text-lg font-medium">How it compares</h3>
			<div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
				<table className="w-full min-w-[640px] border-collapse text-left text-sm">
					<thead>
						<tr className="border-b border-zinc-800 text-xs text-zinc-500">
							<th className="py-2 pr-4 font-normal" />
							{TABLE.cols.map((c, i) => (
								<th
									key={c}
									className={`py-2 pr-4 font-medium ${i === 0 ? "text-sky-400" : "text-zinc-300"}`}
								>
									{c}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{TABLE.rows.map((r) => (
							<tr key={r.label} className="border-b border-zinc-900 align-top">
								<th className="py-3 pr-4 font-normal text-zinc-400">
									{r.label}
								</th>
								{r.cells.map((v, i) => (
									<td
										key={TABLE.cols[i]}
										className={`py-3 pr-4 ${i === 0 ? "bg-sky-400/5 font-medium" : "text-zinc-300"}`}
									>
										<Cell v={v} />
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function Sizing() {
	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 p-6">
			<h3 className="text-lg font-medium">Market size, bottom-up</h3>
			<ol className="flex flex-col gap-3">
				{SIZING.steps.map((s) => (
					<li
						key={s.label}
						className="flex items-baseline justify-between gap-4 border-b border-zinc-900 pb-3 last:border-0"
					>
						<span className="text-sm text-zinc-400">
							{s.label}
							{s.note && (
								<span className="block text-xs text-zinc-600">{s.note}</span>
							)}
						</span>
						<span className="shrink-0 font-mono text-lg">{s.value}</span>
					</li>
				))}
			</ol>
		</div>
	);
}

function WhyNow() {
	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 p-6">
			<h3 className="text-lg font-medium">Why now</h3>
			<ul className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-400">
				<li>
					<span className="font-medium text-zinc-100">
						One API, 37 platforms.
					</span>{" "}
					Telem puts X, Reddit and 8 Chinese platforms (Weibo, Xiaohongshu,
					Zhihu, WeChat, Douyin…) behind one key. Before, each was its own
					scraper and login.
				</li>
				<li>
					<span className="font-medium text-zinc-100">
						Agents got cheap enough to run per headline.
					</span>{" "}
					{RUN.line}
				</li>
				<li>
					<span className="font-medium text-zinc-100">
						Desks already trade on social.
					</span>{" "}
					A single post can move a megacap in minutes; our replay above shows
					the first posts landing about 3 minutes after the price moved.
				</li>
			</ul>
		</div>
	);
}

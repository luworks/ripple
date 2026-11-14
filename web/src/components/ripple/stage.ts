import {
	etMonthDay,
	etTime,
	etWeekday,
	fmtPct,
	isGap,
	type Model,
	STANCE_COLOR,
} from "./replay";

// Canvas for the replay: NVDA line on top, the stretched time axis in the middle, one lane per
// platform below. Everything drawn is a pure function of the playhead, so scrubbing is exact.
export const LOOP_MS = 48_000;
const HOLD_MS = 4_000;
const SKY = "#38bdf8";
const AMBER = "#fbbf24";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const SHORT: Record<string, string> = {
	Xiaohongshu: "XHS",
	Instagram: "Insta",
};

export type StageHandle = {
	setPlaying(on: boolean): void;
	seek(p: number): void;
	dispose(): void;
};

export function mountStage(
	canvas: HTMLCanvasElement,
	m: Model,
	opts: {
		reduced: boolean;
		onTick(t: number, p: number, playing: boolean): void;
	},
): StageHandle {
	const g = canvas.getContext("2d");
	if (!g) throw new Error("2D canvas unavailable");
	const { story, bars } = m;
	const sans = getComputedStyle(canvas).fontFamily;
	const postP = story.posts.map((p) => m.toP(p.t));
	const dayP = story.days.map((d) => m.toP(d.start));
	const closeP = m.closes.map((c) => m.toP(c.t));
	const lowP = m.toP(m.low.t);
	const laneCount = m.platforms.length;

	let p = opts.reduced ? 1 : 0;
	let playing = !opts.reduced;
	let hold = 0;
	let dirty = true;
	let visible = true;
	let dragging = false;
	let resumeAfterDrag = false;
	let raf = 0;
	let last = 0;

	// Layout, rebuilt on resize. All in CSS pixels.
	let W = 0;
	let H = 0;
	let compact = false;
	let x0 = 0;
	let x1 = 0;
	let chartTop = 0;
	let chartBot = 0;
	let axisY = 0;
	const axisH = 26;
	let lanesTop = 0;
	let laneH = 0;
	let lanesBot = 0;
	let barX = new Float32Array(0);
	let barY = new Float32Array(0);
	let dayX: number[] = [];
	let dayLabel: string[] = [];
	let dayLabelX: number[] = [];
	let hourTicks: { x: number; label: string }[] = [];
	let closeShown: boolean[] = [];

	const X = (q: number) => x0 + q * (x1 - x0);
	const Y = (price: number) =>
		chartBot -
		12 -
		((price - m.lo) / (m.hi - m.lo)) * (chartBot - chartTop - 46);

	function layout() {
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		W = canvas.clientWidth;
		H = canvas.clientHeight;
		if (!W || !H) return;
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		g?.setTransform(dpr, 0, 0, dpr, 0, 0);
		compact = W < 560;
		x0 = compact ? 76 : 104;
		x1 = W - (compact ? 10 : 16);
		chartTop = compact ? 78 : W < 860 ? 66 : 46; // room for the HUD: 3, 2 or 1 lines
		laneH = compact ? 17 : 18;
		lanesBot = H - 12;
		lanesTop = lanesBot - laneH * laneCount;
		axisY = lanesTop - 8 - axisH;
		chartBot = axisY;

		barX = Float32Array.from(bars, (b) => X(m.toP(b.t)));
		barY = Float32Array.from(bars, (b) => Y(b.c));

		dayX = dayP.map(X);
		if (!g) return;
		g.font = `500 11px ${sans}`;
		dayLabel = [];
		dayLabelX = [];
		hourTicks = [];
		story.days.forEach((d, i) => {
			const width = (dayX[i + 1] ?? x1) - dayX[i];
			const dots = width >= 34 ? m.eventsByDay[i].length : 0;
			const md = etMonthDay.format(d.start);
			const label =
				width >= 104
					? `${etWeekday.format(d.start)} ${md}`
					: width >= 58
						? md
						: md.split(" ")[1];
			dayLabel.push(label);
			dayLabelX.push(dayX[i] + 6 + dots * 7 + (dots ? 3 : 0));
			// Hour ticks only where the day is stretched wide enough to read them.
			const step = [1, 2, 3, 6, 12].find((s) => width / (24 / s) >= 34);
			if (!step) return;
			let lastX = dayLabelX[i] + g.measureText(label).width + 8;
			for (let h = step; h < 24; h += step) {
				const t = d.start + h * 3600_000;
				if (t > story.end) break;
				const x = X(m.toP(t));
				if (x - lastX < 30 || x > (dayX[i + 1] ?? x1) - 18) continue;
				hourTicks.push({
					x,
					label: h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`,
				});
				lastX = x;
			}
		});

		let lastClose = Number.NEGATIVE_INFINITY;
		closeShown = closeP.map((q) => {
			if (compact || X(q) - lastClose < 64) return false;
			lastClose = X(q);
			return true;
		});
		dirty = true;
	}

	function draw() {
		if (!g || !W) return;
		const t = m.toT(p);
		const px = X(p);
		const day = m.dayAt(t);
		const sec = (q: number) => ((p - q) * LOOP_MS) / 1000; // screen seconds since q
		g.clearRect(0, 0, W, H);
		g.textBaseline = "middle";

		// Regular sessions and the current day.
		for (const d of story.days) {
			if (!d.session) continue;
			const a = X(m.toP(d.session[0]));
			const b = X(m.toP(d.session[1]));
			g.fillStyle = "rgba(255,255,255,0.035)";
			g.fillRect(a, chartTop, b - a, chartBot - chartTop);
			g.fillStyle = "rgba(255,255,255,0.018)";
			g.fillRect(a, lanesTop, b - a, lanesBot - lanesTop);
		}
		g.fillStyle = "rgba(255,255,255,0.03)";
		g.fillRect(x0, axisY, x1 - x0, axisH);
		g.fillStyle = "rgba(56,189,248,0.12)";
		g.fillRect(dayX[day], axisY, (dayX[day + 1] ?? x1) - dayX[day], axisH);

		// Price grid.
		g.font = `9.5px ${MONO}`;
		g.textAlign = "right";
		const stepUsd = m.hi - m.lo > 25 ? 10 : 5;
		for (
			let v = Math.ceil(m.lo / stepUsd) * stepUsd;
			v < m.hi - stepUsd * 0.3;
			v += stepUsd
		) {
			g.strokeStyle = "rgba(255,255,255,0.05)";
			g.lineWidth = 1;
			g.beginPath();
			g.moveTo(x0, Y(v));
			g.lineTo(x1, Y(v));
			g.stroke();
			g.fillStyle = "#52525b";
			g.fillText(`$${v}`, x0 - 8, Y(v));
		}

		// Days, hour ticks.
		story.days.forEach((d, i) => {
			g.strokeStyle = "rgba(255,255,255,0.09)";
			g.beginPath();
			g.moveTo(dayX[i], chartTop);
			g.lineTo(dayX[i], lanesBot);
			g.stroke();
			const dots = dayLabelX[i] > dayX[i] + 6 ? m.eventsByDay[i].length : 0;
			for (let k = 0; k < dots; k++) {
				g.fillStyle = d.start <= t ? AMBER : "rgba(251,191,36,0.35)";
				g.beginPath();
				g.arc(dayX[i] + 9 + k * 7, axisY + axisH / 2, 2.4, 0, 7);
				g.fill();
			}
			g.font = `500 11px ${sans}`;
			g.textAlign = "left";
			g.fillStyle =
				i === day ? "#f4f4f5" : d.start <= t ? "#a1a1aa" : "#52525b";
			g.fillText(dayLabel[i], dayLabelX[i], axisY + axisH / 2 + 0.5);
		});
		g.font = `9.5px ${MONO}`;
		g.textAlign = "center";
		for (const h of hourTicks) {
			g.fillStyle = h.x <= px ? "#71717a" : "#3f3f46";
			g.fillText(h.label, h.x, axisY + axisH / 2 + 0.5);
			g.fillRect(h.x - 0.5, axisY, 1, 3);
		}

		// Baseline.
		const yBase = Y(story.baseline);
		g.setLineDash([3, 5]);
		g.strokeStyle = "rgba(255,255,255,0.22)";
		g.beginPath();
		g.moveTo(x0, yBase);
		g.lineTo(x1, yBase);
		g.stroke();
		g.setLineDash([]);
		g.textAlign = "right";
		g.fillStyle = "#71717a";
		g.fillText(
			`${compact ? "" : "Fri "}Nov 6 close $${story.baseline.toFixed(2)}`,
			x1 - 4,
			yBase - 9,
		);

		// Price: bright in regular sessions, thin before and after, dotted while shut.
		const idx = m.barAt(t);
		const next = bars[idx + 1];
		const shut = !next || isGap(bars[idx], next);
		const headY = shut
			? barY[idx]
			: barY[idx] +
				((barY[idx + 1] - barY[idx]) * (t - bars[idx].t)) /
					(next.t - bars[idx].t);
		const price = bars[idx].c;
		const tone = price >= story.baseline ? "52,211,153" : "251,113,133";

		const area = new Path2D();
		area.moveTo(barX[0], yBase);
		area.lineTo(barX[0], barY[0]);
		const paths = [new Path2D(), new Path2D(), new Path2D()]; // regular, extended, shut
		let kind = -1;
		for (let i = 0; i < idx; i++) {
			const k = isGap(bars[i], bars[i + 1])
				? 2
				: m.regular[i] && m.regular[i + 1]
					? 0
					: 1;
			if (k !== kind) paths[k].moveTo(barX[i], barY[i]);
			kind = k;
			if (k === 2) {
				paths[2].lineTo(barX[i + 1], barY[i]);
				area.lineTo(barX[i + 1], barY[i]);
			}
			paths[k].lineTo(barX[i + 1], barY[i + 1]);
			area.lineTo(barX[i + 1], barY[i + 1]);
		}
		const tail = shut ? 2 : m.regular[idx] ? 0 : 1;
		if (tail !== kind) paths[tail].moveTo(barX[idx], barY[idx]);
		paths[tail].lineTo(px, headY);
		area.lineTo(px, headY);
		area.lineTo(px, yBase);
		area.closePath();
		const fill = g.createLinearGradient(0, yBase, 0, chartBot);
		fill.addColorStop(0, `rgba(${tone},0.03)`);
		fill.addColorStop(1, `rgba(${tone},0.26)`);
		g.fillStyle = fill;
		g.fill(area);

		g.lineJoin = "round";
		g.lineCap = "round";
		g.setLineDash([1, 4]);
		g.strokeStyle = "rgba(161,161,170,0.7)";
		g.lineWidth = 1.2;
		g.stroke(paths[2]);
		g.setLineDash([]);
		g.strokeStyle = `rgba(${tone},0.6)`;
		g.lineWidth = 1.1;
		g.stroke(paths[1]);
		g.save();
		g.shadowColor = `rgba(${tone},0.9)`;
		g.shadowBlur = 10;
		g.strokeStyle = `rgb(${tone})`;
		g.lineWidth = 2;
		g.stroke(paths[0]);
		g.restore();

		// Day results and the low of the week, once the playhead is past them.
		g.font = `10.5px ${MONO}`;
		m.closes.forEach((c, i) => {
			if (closeP[i] > p) return;
			const x = X(closeP[i]);
			g.fillStyle = "#e4e4e7";
			g.beginPath();
			g.arc(x, Y(c.price), 2.2, 0, 7);
			g.fill();
			if (!closeShown[i]) return;
			g.textAlign = "right";
			g.fillStyle = "#a1a1aa";
			g.fillText(c.label, x - 50, chartTop + 9);
			g.fillStyle = c.pct >= 0 ? "#6ee7b7" : "#fda4af";
			g.fillText(fmtPct(c.pct), x - 2, chartTop + 9);
			g.strokeStyle = "rgba(255,255,255,0.14)";
			g.beginPath();
			g.moveTo(x, chartTop + 17);
			g.lineTo(x, Y(c.price) - 5);
			g.stroke();
		});
		if (lowP <= p) {
			const x = X(lowP);
			const y = Y(m.low.c);
			g.strokeStyle = "#fda4af";
			g.lineWidth = 1;
			g.beginPath();
			g.arc(x, y, 4, 0, 7);
			g.stroke();
			g.textAlign = x > x1 - 150 ? "right" : "left";
			g.fillStyle = "#fda4af";
			g.fillText(
				`Low $${m.low.c.toFixed(2)}${compact ? "" : ` · ${etTime.format(m.low.t)} ET`}`,
				x + (g.textAlign === "right" ? -10 : 10),
				y + 1,
			);
		}

		// An event day starting sends a ripple out from the axis.
		if (!opts.reduced) {
			g.save();
			g.beginPath();
			g.rect(x0, chartTop, x1 - x0, lanesBot - chartTop);
			g.clip();
			story.days.forEach((_, i) => {
				const age = sec(dayP[i]);
				if (!m.eventsByDay[i].length || age < 0 || age > 2.8) return;
				for (let k = 0; k < 3; k++) {
					const a = age - k * 0.32;
					if (a <= 0) continue;
					g.strokeStyle = `rgba(251,191,36,${(0.55 * (1 - age / 2.8)).toFixed(3)})`;
					g.lineWidth = 2 - k * 0.5;
					g.beginPath();
					g.arc(dayX[i], axisY + axisH / 2, a * (compact ? 70 : 120), 0, 7);
					g.stroke();
				}
			});
			g.restore();
		}

		// Platform lanes: one dot per post at its publish time.
		const shown = m.shownAt(t);
		const counts = new Array<number>(laneCount).fill(0);
		for (let i = 0; i < shown; i++) counts[m.lane[i]]++;
		m.platforms.forEach((name, k) => {
			const y = lanesTop + laneH * (k + 0.5);
			g.strokeStyle = "rgba(255,255,255,0.06)";
			g.lineWidth = 1;
			g.beginPath();
			g.moveTo(x0, y);
			g.lineTo(x1, y);
			g.stroke();
			g.textAlign = "right";
			g.font = `${compact ? 10 : 11}px ${sans}`;
			g.fillStyle = counts[k] ? "#d4d4d8" : "#71717a";
			g.fillText(
				compact ? (SHORT[name] ?? name) : name,
				x0 - (compact ? 24 : 30),
				y + 0.5,
			);
			g.font = `10.5px ${MONO}`;
			g.fillStyle = counts[k] ? "#7dd3fc" : "#52525b";
			g.fillText(String(counts[k]), x0 - 8, y + 0.5);
		});
		for (let i = 0; i < shown; i++) {
			const x = X(postP[i]);
			const y = lanesTop + laneH * (m.lane[i] + 0.5);
			const color = STANCE_COLOR[story.posts[i].stance];
			const age = opts.reduced ? 9 : sec(postP[i]);
			if (age < 0.9) {
				// Tie the post to the price at that minute.
				const by = Y(bars[m.barAt(story.posts[i].t)].c);
				g.globalAlpha = 0.4 * (1 - age / 0.9);
				g.strokeStyle = color;
				g.lineWidth = 1;
				g.beginPath();
				g.moveTo(x, y);
				g.lineTo(x, by);
				g.stroke();
				g.beginPath();
				g.arc(x, by, 2.5, 0, 7);
				g.fillStyle = color;
				g.fill();
			}
			if (age < 1.5) {
				g.globalAlpha = 1 - age / 1.5;
				g.strokeStyle = color;
				g.lineWidth = 1.5;
				g.beginPath();
				g.arc(x, y, 3 + age * 22, 0, 7);
				g.stroke();
			}
			g.globalAlpha = 1;
			g.save();
			if (age < 1.5) {
				g.shadowColor = color;
				g.shadowBlur = 12;
			}
			g.fillStyle = color;
			g.beginPath();
			g.arc(x, y, age < 0.3 ? 4.2 : compact ? 2.4 : 2.9, 0, 7);
			g.fill();
			g.restore();
		}

		// Playhead with the time riding on the axis.
		g.save();
		g.shadowColor = SKY;
		g.shadowBlur = 8;
		g.strokeStyle = "rgba(56,189,248,0.9)";
		g.lineWidth = 1.5;
		g.beginPath();
		g.moveTo(px, chartTop - 4);
		g.lineTo(px, lanesBot);
		g.stroke();
		g.fillStyle = "#f4f4f5";
		g.beginPath();
		g.arc(px, headY, 3.6, 0, 7);
		g.fill();
		g.restore();

		g.font = `600 10.5px ${MONO}`;
		const time = etTime.format(t);
		const tw = g.measureText(time).width + 12;
		const tx = Math.min(x1 - tw / 2, Math.max(x0 + tw / 2, px));
		g.fillStyle = SKY;
		g.beginPath();
		g.roundRect(tx - tw / 2, axisY + 4, tw, axisH - 8, 5);
		g.fill();
		g.fillStyle = "#082f49";
		g.textAlign = "center";
		g.fillText(time, tx, axisY + axisH / 2 + 0.5);

		const tag = `$${price.toFixed(2)}`;
		const left = px > x1 - 76;
		g.font = `600 11px ${MONO}`;
		g.textAlign = left ? "right" : "left";
		g.fillStyle = "#f4f4f5";
		g.fillText(tag, px + (left ? -9 : 9), Math.max(chartTop + 26, headY - 13));

		opts.onTick(t, p, playing);
	}

	function frame(now: number) {
		raf = requestAnimationFrame(frame);
		const dt = Math.min(100, now - (last || now));
		last = now;
		if (playing && !dragging) {
			if (p >= 1) {
				hold += dt;
				if (hold >= HOLD_MS) {
					p = 0;
					hold = 0;
				}
			} else p = Math.min(1, p + dt / LOOP_MS);
			dirty = true;
		}
		if (!dirty) return;
		dirty = false;
		draw();
	}
	function run() {
		cancelAnimationFrame(raf);
		last = 0;
		if (visible) raf = requestAnimationFrame(frame);
	}

	const seekTo = (clientX: number) => {
		const r = canvas.getBoundingClientRect();
		p = Math.min(1, Math.max(0, (clientX - r.left - x0) / (x1 - x0)));
		hold = 0;
		dirty = true;
	};
	const down = (e: PointerEvent) => {
		dragging = true;
		resumeAfterDrag = playing;
		canvas.setPointerCapture(e.pointerId);
		seekTo(e.clientX);
	};
	const move = (e: PointerEvent) => {
		if (dragging) seekTo(e.clientX);
	};
	const up = () => {
		if (!dragging) return;
		dragging = false;
		playing = resumeAfterDrag && p < 1;
		dirty = true;
	};
	canvas.addEventListener("pointerdown", down);
	canvas.addEventListener("pointermove", move);
	canvas.addEventListener("pointerup", up);
	canvas.addEventListener("pointercancel", up);

	const ro = new ResizeObserver(layout);
	ro.observe(canvas);
	const io = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		run();
	});
	io.observe(canvas);
	layout();
	run();

	return {
		setPlaying(on) {
			if (on && p >= 1) p = 0;
			playing = on;
			hold = 0;
			dirty = true;
		},
		seek(q) {
			p = Math.min(1, Math.max(0, q));
			hold = 0;
			dirty = true;
		},
		dispose() {
			cancelAnimationFrame(raf);
			ro.disconnect();
			io.disconnect();
			canvas.removeEventListener("pointerdown", down);
			canvas.removeEventListener("pointermove", move);
			canvas.removeEventListener("pointerup", up);
			canvas.removeEventListener("pointercancel", up);
		},
	};
}

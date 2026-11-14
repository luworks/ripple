// Three.js scene for the home-page ripple. Loaded only on the client (dynamic import),
// so three never lands in the SSR pass or the first-paint bundle.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
	CSS2DObject,
	CSS2DRenderer,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { RIPPLE_PEOPLE, type RippleReplay } from "#/server/ripple";
import { changeAt, fmtPct, platformsOf, STANCE_COLOR } from "./replay";

export const LOOP_MS = 32_000; // ~71 h of real time per loop
const HOLD = 0.08; // fraction of a loop to rest on the final frame
const R_PEOPLE = 1.9;
const R_TICKER = 3.6;
const R_PLATFORM = 5.4;
const BAR_PER_PCT = 0.28;
const FLIGHT_MS = 1300;
const SKY = 0x38bdf8;
const UP = 0x34d399;
const DOWN = 0xfb7185;

export type RippleHandle = {
	setPlaying(on: boolean): void;
	seek(p: number): void; // 0..1
	dispose(): void;
};

type Opts = {
	reduced: boolean;
	interactive: boolean; // false on touch: never trap page scroll
	onTime(t: number, playing: boolean): void;
};

function upperBound(xs: number[], v: number) {
	let lo = 0;
	let hi = xs.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (xs[mid] <= v) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

function label(cls: string, text: string) {
	const div = document.createElement("div");
	div.className = `pointer-events-none whitespace-nowrap rounded-full bg-zinc-950/80 px-2 py-0.5 text-[11px] leading-tight ring-1 [[data-compact]_&]:px-1.5 [[data-compact]_&]:text-[9px] ${cls}`;
	div.textContent = text;
	return { obj: new CSS2DObject(div), div };
}

function ringLine(r: number, opacity: number) {
	const pts: THREE.Vector3[] = [];
	for (let i = 0; i < 128; i++) {
		const a = (i / 128) * Math.PI * 2;
		pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
	}
	return new THREE.LineLoop(
		new THREE.BufferGeometry().setFromPoints(pts),
		new THREE.LineBasicMaterial({ color: SKY, transparent: true, opacity }),
	);
}

function onRing(r: number, i: number, n: number, offset: number) {
	const a = (i / n) * Math.PI * 2 + offset;
	return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
}

export function mountRipple(
	el: HTMLElement,
	data: RippleReplay,
	opts: Opts,
): RippleHandle {
	const span = data.end - data.start;
	const scene = new THREE.Scene();
	const root = new THREE.Group();
	scene.add(root);
	scene.add(new THREE.AmbientLight(0xffffff, 1.6));
	const sun = new THREE.DirectionalLight(0xffffff, 2);
	sun.position.set(4, 8, 6);
	scene.add(sun);

	const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.domElement.className = "block h-full w-full";
	el.appendChild(renderer.domElement);
	const css = new CSS2DRenderer();
	Object.assign(css.domElement.style, {
		position: "absolute",
		inset: "0",
		pointerEvents: "none",
	});
	el.appendChild(css.domElement);

	const controls = opts.interactive
		? new OrbitControls(camera, renderer.domElement)
		: null;
	if (controls) {
		controls.enableZoom = false;
		controls.enablePan = false;
		controls.enableDamping = true;
		controls.minPolarAngle = 0.5;
		controls.maxPolarAngle = 1.35;
	}

	// Rings and the event core.
	root.add(ringLine(R_PEOPLE, 0.45), ringLine(R_TICKER, 0.3));
	root.add(ringLine(R_PLATFORM, 0.18));
	const coreMat = new THREE.MeshLambertMaterial({
		color: SKY,
		emissive: SKY,
		emissiveIntensity: 0.6,
	});
	const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 16), coreMat);
	root.add(core);
	const coreLabel = label("text-sky-200 ring-sky-400/50", "Huang resigns");
	coreLabel.obj.position.set(0, 0.8, 0);
	root.add(coreLabel.obj);

	const nodeGeo = new THREE.SphereGeometry(1, 24, 12);
	const spokeMat = new THREE.LineBasicMaterial({
		color: SKY,
		transparent: true,
		opacity: 0.12,
	});
	const spoke = (to: THREE.Vector3) =>
		root.add(
			new THREE.Line(
				new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), to]),
				spokeMat,
			),
		);

	// Ring 1: people.
	const personMat = new THREE.MeshLambertMaterial({ color: 0xd4d4d8 });
	RIPPLE_PEOPLE.forEach((name, i) => {
		const pos = onRing(R_PEOPLE, i, RIPPLE_PEOPLE.length, -Math.PI / 2);
		const m = new THREE.Mesh(nodeGeo, personMat);
		m.scale.setScalar(0.13);
		m.position.copy(pos);
		root.add(m);
		const l = label(
			"text-zinc-300 ring-zinc-700 [[data-compact]_&]:hidden",
			name,
		);
		l.obj.position.copy(pos).setY(0.32);
		root.add(l.obj);
		spoke(pos);
	});

	// Ring 2: tickers. Bars grow up (green) or down (red) with % change vs the Nov 11 close.
	const barGeo = new THREE.BoxGeometry(0.34, 1, 0.34).translate(0, 0.5, 0);
	const tickers = data.prices.map((s, i) => {
		const pos = onRing(R_TICKER, i, data.prices.length, -Math.PI / 2 + 0.4);
		const mat = new THREE.MeshLambertMaterial({
			color: DOWN,
			emissive: DOWN,
			emissiveIntensity: 0.35,
			side: THREE.DoubleSide,
		});
		const bar = new THREE.Mesh(barGeo, mat);
		bar.position.copy(pos);
		bar.scale.y = 0.001;
		root.add(bar);
		const base = new THREE.Mesh(
			new THREE.CircleGeometry(0.3, 32).rotateX(-Math.PI / 2),
			new THREE.MeshBasicMaterial({
				color: SKY,
				transparent: true,
				opacity: 0.25,
				side: THREE.DoubleSide,
			}),
		);
		base.position.copy(pos);
		root.add(base);
		const l = label("font-mono text-zinc-200 ring-zinc-700", s.symbol);
		root.add(l.obj);
		spoke(pos);
		return { s, bar, mat, l, pos, text: "" };
	});

	// Ring 3: platforms. Node size grows with the square root of posts so far.
	const names = platformsOf(data);
	const platforms = new Map(
		names.map((name, i) => {
			const pos = onRing(R_PLATFORM, i, names.length, -Math.PI / 2 + 0.2);
			const mat = new THREE.MeshLambertMaterial({
				color: 0x3f3f46,
				emissive: SKY,
				emissiveIntensity: 0,
			});
			const node = new THREE.Mesh(nodeGeo, mat);
			node.position.copy(pos);
			root.add(node);
			const l = label("text-zinc-200 ring-zinc-700", name);
			root.add(l.obj);
			spoke(pos);
			const times = data.posts
				.filter((p) => p.platform === name)
				.map((p) => p.t);
			return [name, { node, mat, l, pos, times, pulse: 0, text: "" }];
		}),
	);
	const postTimes = data.posts.map((p) => p.t);

	// Pools: flying particles and ground ripples.
	const dotGeo = new THREE.SphereGeometry(0.09, 12, 8);
	const flights = Array.from({ length: 48 }, () => {
		const mat = new THREE.MeshBasicMaterial({ transparent: true });
		const m = new THREE.Mesh(dotGeo, mat);
		m.visible = false;
		root.add(m);
		return { m, mat, born: -1, to: new THREE.Vector3(), platform: "" };
	});
	const rippleGeo = new THREE.RingGeometry(0.96, 1, 96).rotateX(-Math.PI / 2);
	const ripples = Array.from({ length: 14 }, () => {
		const mat = new THREE.MeshBasicMaterial({
			color: SKY,
			transparent: true,
			side: THREE.DoubleSide,
			depthWrite: false,
		});
		const m = new THREE.Mesh(rippleGeo, mat);
		m.visible = false;
		root.add(m);
		return { m, mat, born: -1, color: new THREE.Color() };
	});
	let nextFlight = 0;
	let nextRipple = 0;
	let corePulse = 0;

	function emit(i: number, now: number) {
		const post = data.posts[i];
		const target = platforms.get(post.platform);
		if (!target) return;
		const color = STANCE_COLOR[post.stance] ?? STANCE_COLOR.neutral;
		const f = flights[nextFlight++ % flights.length];
		f.born = now;
		f.to.copy(target.pos);
		f.platform = post.platform;
		f.mat.color.set(color);
		f.m.visible = true;
		const r = ripples[nextRipple++ % ripples.length];
		r.born = now;
		r.mat.color.set(color);
		r.m.visible = true;
		corePulse = 1;
	}

	function clearFx() {
		for (const f of flights) {
			f.born = -1;
			f.m.visible = false;
		}
		for (const r of ripples) {
			r.born = -1;
			r.m.visible = false;
		}
	}

	// Pure function of the replay clock: bars, labels and node sizes.
	function applyTime(t: number) {
		for (const k of tickers) {
			const ch = changeAt(k.s, data.baseline, t);
			const pct = ch?.pct ?? 0;
			const h = Math.max(-2.4, Math.min(2.4, pct * BAR_PER_PCT));
			k.bar.scale.y = Math.abs(h) < 0.001 ? 0.001 : h;
			const c = pct >= 0 ? UP : DOWN;
			k.mat.color.setHex(c);
			k.mat.emissive.setHex(c);
			k.l.obj.position.copy(k.pos).setY(Math.max(h, 0) + 0.32);
			const text = ch ? `${k.s.symbol} ${fmtPct(pct)}` : `${k.s.symbol} n/a`;
			if (text !== k.text) {
				k.text = text;
				k.l.div.textContent = text;
				k.l.div.style.color = !ch ? "" : pct >= 0 ? "#6ee7b7" : "#fda4af";
			}
		}
		for (const [name, p] of platforms) {
			const n = upperBound(p.times, t);
			const s = 0.1 + 0.075 * Math.sqrt(n) + p.pulse * 0.1;
			p.node.scale.setScalar(s);
			p.mat.color.setHex(n ? 0x0ea5e9 : 0x3f3f46);
			p.mat.emissiveIntensity = 0.15 + p.pulse * 0.8;
			p.l.obj.position.copy(p.pos).setY(s + 0.28);
			const text = `${name} · ${n}`;
			if (text !== p.text) {
				p.text = text;
				p.l.div.textContent = text;
			}
		}
	}

	function resize() {
		const w = el.clientWidth;
		const h = el.clientHeight;
		if (!w || !h) return;
		const aspect = w / h;
		camera.aspect = aspect;
		// Keep the outer ring plus its labels inside the frame at any width. On phones,
		// labels shrink and people go unlabeled so the rings stay readable.
		const compact = w < 480;
		css.domElement.toggleAttribute("data-compact", compact);
		const d = Math.min(28, Math.max(16, 21.5 / aspect)) * (compact ? 1.12 : 1);
		const elev = 0.55;
		camera.position.set(0, d * Math.sin(elev), d * Math.cos(elev));
		camera.lookAt(0, -0.2, 0);
		camera.updateProjectionMatrix();
		controls?.update();
		renderer.setSize(w, h, false);
		css.setSize(w, h);
	}
	const ro = new ResizeObserver(resize);
	ro.observe(el);
	resize();

	let visible = true;
	const io = new IntersectionObserver(([e]) => {
		visible = e.isIntersecting;
	});
	io.observe(el);

	let playing = !opts.reduced;
	let p = opts.reduced ? 1 : 0;
	let prevT = data.start + Math.min(p, 1) * span;
	let last = performance.now();
	let lastHud = 0;
	let raf = 0;

	function frame(now: number) {
		raf = requestAnimationFrame(frame);
		const dt = Math.min(now - last, 100);
		last = now;
		if (!visible) return;
		if (playing) {
			p += dt / LOOP_MS;
			if (p > 1 + HOLD) {
				p = 0;
				clearFx();
				prevT = data.start;
			}
		}
		const t = data.start + Math.min(p, 1) * span;
		if (playing && t > prevT) {
			for (
				let i = upperBound(postTimes, prevT);
				i < upperBound(postTimes, t);
				i++
			)
				emit(i, now);
		}
		prevT = t;

		// Particles fly on an arc from the core to their platform.
		for (const f of flights) {
			if (f.born < 0) continue;
			const s = (now - f.born) / FLIGHT_MS;
			if (s >= 1) {
				f.born = -1;
				f.m.visible = false;
				const target = platforms.get(f.platform);
				if (target) target.pulse = 1;
				continue;
			}
			const e = 1 - (1 - s) ** 2;
			f.m.position.set(f.to.x * e, Math.sin(Math.PI * e) * 1.6, f.to.z * e);
		}
		for (const r of ripples) {
			if (r.born < 0) continue;
			const s = (now - r.born) / 1800;
			if (s >= 1) {
				r.born = -1;
				r.m.visible = false;
				continue;
			}
			r.m.scale.setScalar(0.5 + s * (R_PLATFORM + 0.6));
			r.mat.opacity = 0.55 * (1 - s);
		}
		const decay = Math.exp(-dt / 260);
		for (const pl of platforms.values()) pl.pulse *= decay;
		corePulse *= decay;
		core.scale.setScalar(1 + corePulse * 0.35);
		coreMat.emissiveIntensity = 0.6 + corePulse * 0.8;

		applyTime(t);
		if (!opts.reduced) root.rotation.y += dt * 0.00006;
		controls?.update();
		renderer.render(scene, camera);
		css.render(scene, camera);
		if (now - lastHud > 90) {
			lastHud = now;
			opts.onTime(t, playing);
		}
	}
	raf = requestAnimationFrame(frame);

	return {
		setPlaying(on) {
			playing = on;
			if (on && p >= 1) {
				p = 0;
				prevT = data.start;
				clearFx();
			}
			opts.onTime(data.start + Math.min(p, 1) * span, playing);
		},
		seek(v) {
			p = Math.max(0, Math.min(1, v));
			prevT = data.start + p * span; // a jump never replays posts
			opts.onTime(prevT, playing);
		},
		dispose() {
			cancelAnimationFrame(raf);
			ro.disconnect();
			io.disconnect();
			controls?.dispose();
			const geos = new Set<THREE.BufferGeometry>();
			const mats = new Set<THREE.Material>();
			scene.traverse((o) => {
				if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
					geos.add(o.geometry);
					for (const m of [o.material].flat()) mats.add(m);
				}
			});
			for (const g of geos) g.dispose();
			for (const m of mats) m.dispose();
			renderer.dispose();
			renderer.domElement.remove();
			css.domElement.remove();
		},
	};
}

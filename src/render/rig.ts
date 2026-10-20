// Layered character puppets (SPEC.md §5.3): parts from art/src/chars/<name>/, posed procedurally.
import { Assets, Container, Sprite, type Texture } from 'pixi.js';

interface RigPart { name: string; parent?: string; pivot: [number, number]; hidden?: boolean }
interface RigDef { canvas: [number, number]; ground: [number, number]; parts: RigPart[] }
interface ManifestEntry { src: string; src2x: string; w: number; h: number }
type Manifest = Record<string, ManifestEntry>;

const BASE = import.meta.env.BASE_URL;
let manifest: Promise<Manifest> | null = null;
export const loadManifest = () => (manifest ??= fetch(`${BASE}manifest.json`).then((r) => r.json()));

/** 2x texture for a manifest key (crisp up to 2x tile size). Pixi sizes `@2x` files in 1x units. */
export async function texture(key: string): Promise<Texture> {
  const m = await loadManifest();
  if (!m[key]) throw new Error(`art: no "${key}" in manifest`);
  return Assets.load(`${BASE}${m[key].src2x}`);
}

export async function loadPuppet(name: 'sol' | 'lune'): Promise<Puppet> {
  const rig: RigDef = await fetch(`${BASE}chars/${name}/rig.json`).then((r) => r.json());
  const tex = await Promise.all(rig.parts.map((p) => texture(`chars/${name}/${p.name}`)));
  return new Puppet(rig, tex);
}

/**
 * Origin = the feet (rig.ground), in 1x canvas px; scale the puppet to fit a tile.
 * Each part is a Container at its pivot, holding its sprite offset by -pivot, so rotating
 * or squashing a part pivots where the rig says.
 */
export class Puppet extends Container {
  readonly parts: Record<string, Container> = {};
  walking = false;
  /** -1 faces left. */
  facing: 1 | -1 = 1;
  /** Which side of the screen the partner is on, for idle glances (1 = right). */
  partnerSide: 1 | -1 = 1;
  private t = Math.random() * 10;
  private nextBlink = 2 + Math.random() * 3;
  private nextGlance = 4 + Math.random() * 4;
  private glanceUntil = 0;
  private walkPhase = 0;
  private body = new Container();

  constructor(rig: RigDef, textures: Texture[]) {
    super();
    this.addChild(this.body);
    const byName = Object.fromEntries(rig.parts.map((p, i) => [p.name, { ...p, i }]));
    rig.parts.forEach((p, i) => {
      const c = new Container();
      const s = new Sprite(textures[i]);
      s.position.set(-p.pivot[0], -p.pivot[1]);
      c.addChild(s);
      const origin = p.parent ? byName[p.parent].pivot : rig.ground;
      c.position.set(p.pivot[0] - origin[0], p.pivot[1] - origin[1]);
      c.visible = !p.hidden;
      this.parts[p.name] = c;
    });
    // A part listed before its parent draws behind the parent (e.g. Lune's scarf tail behind her body).
    rig.parts.forEach((p, i) => {
      const c = this.parts[p.name];
      if (!p.parent) this.body.addChild(c);
      else if (i < byName[p.parent].i) this.parts[p.parent].addChildAt(c, 0);
      else this.parts[p.parent].addChild(c);
    });
  }

  /** Each part's rest offset; animation is applied on top of it. */
  private base: Record<string, { x: number; y: number }> = {};
  private bumpT = 0;
  /** 'celebrate': hop with arms up, waving toward the partner. 'sad': droops while waiting. */
  mood: 'idle' | 'celebrate' | 'sad' = 'idle';

  /** Squash against a wall and shake the head (input still used the turn). */
  bump() { this.bumpT = 0.32; }
  /** Look toward the partner for a moment (e.g. when the partner bumps). */
  lookAtPartner(sec = 1) { this.glanceUntil = this.t + sec; }

  update(dt: number) {
    const t = (this.t += dt);
    const P = this.parts, B = this.base;
    if (!B.body) for (const [k, c] of Object.entries(P)) B[k] = { x: c.x, y: c.y };
    const at = (name: string, dx: number, dy: number, rot = 0) => {
      if (!P[name]) return;
      P[name].position.set(B[name].x + dx, B[name].y + dy);
      P[name].rotation = rot;
    };
    this.body.scale.x = this.facing;

    // Breathing (slower and lower when sad).
    const sad = this.mood === 'sad' ? 1 : 0;
    const breath = Math.sin(t * Math.PI * (0.9 - 0.35 * sad));
    let sx = 1 - 0.012 * breath, sy = 1 + 0.025 * breath;

    // Blink every 3-6 s.
    if (t > this.nextBlink) {
      P.lids.visible = true;
      P.eyes.visible = false;
      if (t > this.nextBlink + 0.13) {
        P.lids.visible = false;
        P.eyes.visible = true;
        this.nextBlink = t + 3 + Math.random() * 3;
      }
    }

    // Now and then, glance toward the seam (the partner).
    if (!this.walking && this.mood === 'idle' && t > this.nextGlance) {
      this.glanceUntil = t + 1.2;
      this.nextGlance = t + 6 + Math.random() * 5;
    }
    const glance = t < this.glanceUntil || this.mood !== 'idle' ? this.partnerSide * this.facing : 0;
    at('eyes', glance * 1.2, sad * 1.2);

    // Walk: bob, alternate feet, swing arms.
    if (this.walking) this.walkPhase += dt * 16;
    else this.walkPhase *= 0.8;
    const w = this.walking ? 1 : 0;
    const s = Math.sin(this.walkPhase);
    let bodyY = -Math.abs(s) * 2.6 * w;
    at('foot-l', 0, -Math.max(0, s) * 2.4 * w);
    at('foot-r', 0, -Math.max(0, -s) * 2.4 * w);
    let armL = s * 0.35 * w, armR = -s * 0.35 * w, headRot = 0, headY = sad * 1.6;

    // Bump: squash toward the wall, head shakes no.
    if (this.bumpT > 0) {
      this.bumpT = Math.max(0, this.bumpT - dt);
      const k = this.bumpT / 0.32;
      sx *= 1 + 0.14 * k;
      sy *= 1 - 0.12 * k;
      headRot = Math.sin((1 - k) * Math.PI * 4) * 0.12 * k;
      bodyY += 1.5 * k;
    }

    // Celebrate: hop, arms up, the arm on the partner's side waves.
    if (this.mood === 'celebrate') {
      bodyY = -Math.abs(Math.sin(t * 7)) * 7;
      const toward = this.partnerSide * this.facing; // +1: partner is on the puppet's right
      armL = 2.1 + (toward < 0 ? Math.sin(t * 12) * 0.35 : 0);
      armR = -2.1 + (toward > 0 ? Math.sin(t * 12) * 0.35 : 0);
    }
    if (sad) { armL = 0.08; armR = -0.08; headRot += 0.05 * this.partnerSide * this.facing; }

    P.body.scale.set(sx, sy);
    this.body.y = bodyY;
    at('arm-l', 0, 0, armL);
    at('arm-r', 0, 0, armR);
    at('head', 0, headY, headRot);

    // Follow-through: the scarf tail and the hat lag behind the motion.
    at('scarf-tail', 0, 0, 0.05 * Math.sin(t * 1.4) + 0.18 * Math.cos(this.walkPhase) * w + (this.mood === 'celebrate' ? 0.2 * Math.sin(t * 7) : 0));
    at('hat', 0, 0, 0.03 * Math.sin(t * 1.1) * (1 - w) + 0.05 * s * w);
  }
}

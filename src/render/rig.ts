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
    this.eyesX = this.parts.eyes.x;
  }

  private eyesX: number;

  update(dt: number) {
    const t = (this.t += dt);
    const P = this.parts;
    const rest = (name: string) => P[name] && (P[name].rotation = 0);
    this.body.scale.x = this.facing;

    // Breathing: a slow squash on the body, the head floats a touch.
    const breath = Math.sin(t * Math.PI * 0.9);
    P.body.scale.set(1 - 0.012 * breath, 1 + 0.025 * breath);

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
    if (!this.walking && t > this.nextGlance) {
      this.glanceUntil = t + 1.2;
      this.nextGlance = t + 6 + Math.random() * 5;
    }
    const glance = t < this.glanceUntil ? this.partnerSide * this.facing : 0;
    P.eyes.x = this.eyesX + glance * 1.2;

    // Walk: bob, alternate feet, swing arms; settle back when stopped.
    if (this.walking) this.walkPhase += dt * 14;
    else this.walkPhase *= 0.8;
    const w = this.walking ? 1 : 0;
    const s = Math.sin(this.walkPhase);
    this.body.y = -Math.abs(s) * 2.6 * w;
    P['foot-l'].y = -Math.max(0, s) * 2.4 * w;
    P['foot-r'].y = -Math.max(0, -s) * 2.4 * w;
    P['arm-l'].rotation = s * 0.35 * w;
    P['arm-r'].rotation = -s * 0.35 * w;
    if (!this.walking) { rest('arm-l'); rest('arm-r'); }

    // Follow-through: the scarf tail and the hat lag behind the motion.
    if (P['scarf-tail']) P['scarf-tail'].rotation = 0.05 * Math.sin(t * 1.4) + 0.18 * Math.cos(this.walkPhase) * w;
    if (P.hat) P.hat.rotation = 0.03 * Math.sin(t * 1.1) * (1 - w) + 0.05 * s * w;
  }
}

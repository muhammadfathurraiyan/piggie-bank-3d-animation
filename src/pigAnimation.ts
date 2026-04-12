import { MathUtils } from "three";

/** Timeline for the “double or nothing” spin (seconds). */
export const TIMELINE = {
  TOTAL: 6,
  ROT: { A: 1, B: 4 },
  SCALE: { A: 1, B: 5 },
} as const;

export const IDLE_ROT_SPEED = 1;
export const ROT_MAX = 10;
/** Peak zoom multiplier during the spin (narrower FOV ≈ × larger on screen; same curve as old mesh scale). */
export const SCALE_MAX = 1.72;

export const SCALE_IN_LAMBDA = 5;
export const SCALE_EPS = 0;

/** Damping when settling celebration after RESULTS → IDLE. */
export const SETTLE_DAMP = 2.2;

/** One-shot extra zoom multiplier at RESULTS entry (FOV punch, ~0.7s). */
export const BANG = {
  DURATION: 0.7,
  PEAK_EXTRA: 0.32,
  ATTACK_FR: 0.12,
} as const;

const SHAKE = {
  IDLE: 0.016,
  ANIM_MIN: 0.055,
  ANIM_MAX: 0.13,
  RESULTS_MUL: 0.8,
} as const;

/** Phase advance per second — lower = cheaper shake frequency, slightly calmer motion. */
const SHAKE_PHASE = { ANIMATING: 18, RESULTS: 12 } as const;

const SETTLE_EPS = {
  BOOST: 1.002,
  SPEED: IDLE_ROT_SPEED + 0.03,
} as const;

export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function window01(t: number, a: number, b: number): number {
  if (t <= a || b <= a) return 0;
  if (t >= b) return 1;
  return (t - a) / (b - a);
}

export function bangMultiplier(elapsed: number): number {
  if (elapsed <= 0 || elapsed >= BANG.DURATION) return 1;
  const u = elapsed / BANG.DURATION;
  if (u < BANG.ATTACK_FR) {
    return 1 + BANG.PEAK_EXTRA * smoothstep(u / BANG.ATTACK_FR);
  }
  const fall = (u - BANG.ATTACK_FR) / (1 - BANG.ATTACK_FR);
  return 1 + BANG.PEAK_EXTRA * (1 - smoothstep(fall));
}

/**
 * Writes shake displacement into `out` (no per-frame object alloc). Three trig evals vs ~7 in the old path.
 */
export function shakeOffsetInto(
  out: { x: number; y: number; z: number },
  phase: number,
  amount: number,
): void {
  const a = amount;
  if (a === 0) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return;
  }
  const s = Math.sin(phase * 34.7);
  const c = Math.cos(phase * 22.3);
  const t = Math.sin(phase * 28.1 + 0.6);
  out.x = a * (s * 0.52 + c * 0.48);
  out.y = a * (c * 0.48 + t * 0.52);
  out.z = a * (s * 0.47 + t * 0.53);
}

export function animatingRotationSpeed(t: number): number {
  const { ROT } = TIMELINE;
  if (t < ROT.A) return IDLE_ROT_SPEED;
  if (t <= ROT.B) {
    const u = smoothstep(window01(t, ROT.A, ROT.B));
    return MathUtils.lerp(IDLE_ROT_SPEED, ROT_MAX, u);
  }
  return ROT_MAX;
}

/** Camera zoom ramp (1 = no zoom, SCALE_MAX = max “punch in”) — same timing as former mesh scale. */
export function animatingZoomBoost(t: number): number {
  const { SCALE } = TIMELINE;
  if (t < SCALE.A) return 1;
  if (t <= SCALE.B) {
    const u = smoothstep(window01(t, SCALE.A, SCALE.B));
    return MathUtils.lerp(1, SCALE_MAX, u);
  }
  return SCALE_MAX;
}

function shakeStressAt(t: number): number {
  const { ROT, SCALE } = TIMELINE;
  const capped = Math.min(t, TIMELINE.TOTAL);
  const rampRot = smoothstep(window01(capped, ROT.A, ROT.B));
  const rampScale = smoothstep(window01(capped, SCALE.A, SCALE.B));
  return Math.max(rampRot, rampScale * 0.85);
}

export function shakeAmountAnimating(t: number): number {
  const stress = shakeStressAt(t);
  return MathUtils.lerp(SHAKE.ANIM_MIN, SHAKE.ANIM_MAX, stress);
}

export function shakeAmountResults(boost: number, spinSpeed: number): number {
  const boost01 = MathUtils.clamp((boost - 1) / (SCALE_MAX - 1), 0, 1);
  return (
    MathUtils.lerp(
      SHAKE.IDLE * 1.2,
      SHAKE.ANIM_MAX * SHAKE.RESULTS_MUL,
      boost01,
    ) * MathUtils.clamp(spinSpeed / ROT_MAX, 0.35, 1)
  );
}

export function advanceShakePhase(
  phase: number,
  delta: number,
  mode: "ANIMATING" | "RESULTS",
): number {
  return phase + delta * SHAKE_PHASE[mode];
}

export function isCelebrationSettling(
  boost: number,
  spinSpeed: number,
): boolean {
  return boost > SETTLE_EPS.BOOST || spinSpeed > SETTLE_EPS.SPEED;
}

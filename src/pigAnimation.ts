import { MathUtils } from "three";

/** Timeline for the “double or nothing” spin (seconds). */
export const TIMELINE = {
  TOTAL: 6,
  ROT: { A: 1, B: 4 },
  SCALE: { A: 1, B: 5 },
} as const;

/** Phase A: shortest-path yaw back to front-facing before strain (seconds). */
export const RESET_DURATION = 0.65;

const STRAIN = {
  AMP1: 0.055,
  AMP2: 0.022,
  OMEGA1: 12,
  OMEGA2: 19,
} as const;

/** Pitch (rotation X, radians) during strain — small lean + wobble (large X tosses coins). */
const PITCH = {
  LEAN: -0.08,
  WOBBLE1: 0.045,
  WOBBLE2: 0.018,
  OMEGA1: 13,
  OMEGA2: 20,
} as const;

/** Roll (rotation Z, radians) during strain — subtle rock only. */
const ROLL = {
  SWAY1: 0.042,
  SWAY2: 0.028,
  OMEGA1: 16,
  OMEGA2: 25,
  PHASE: 2.1,
} as const;

export const IDLE_ROT_SPEED = 1;
/** Y spin speed during RESULTS — keep modest so contents aren’t flung by the collider. */
export const ROT_MAX = 1.15;
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
  ANIM_MIN: 0.032,
  ANIM_MAX: 0.075,
  RESULTS_MUL: 0.52,
} as const;

/** Phase advance per second — lower = calmer jitter, less violent collider motion. */
const SHAKE_PHASE = { ANIMATING: 12, RESULTS: 9 } as const;

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
  const { SCALE } = TIMELINE;
  const capped = Math.min(t, TIMELINE.TOTAL);
  if (capped <= RESET_DURATION) {
    return smoothstep(capped / RESET_DURATION) * 0.16;
  }
  const strainT = capped - RESET_DURATION;
  const strainTotal = TIMELINE.TOTAL - RESET_DURATION;
  const rampStrain = smoothstep(
    window01(strainT, 0, Math.min(0.5, strainTotal * 0.22)),
  );
  const rampScale = smoothstep(window01(capped, SCALE.A, SCALE.B));
  return Math.max(rampStrain, rampScale * 0.62);
}

/** Equivalent angle in (-π, π] for yaw-only rotation. */
export function wrapPi(theta: number): number {
  const twoPi = Math.PI * 2;
  let x = theta % twoPi;
  if (x > Math.PI) x -= twoPi;
  if (x < -Math.PI) x += twoPi;
  return x;
}

/** Shortest rotation delta (radians) so `startYaw + delta` is visually 0° on Y. */
export function shortestYawDeltaToZero(startYawRad: number): number {
  return -wrapPi(startYawRad);
}

/**
 * Yaw (radians) during ANIMATING: ease to front-facing, then bounded struggle oscillation.
 * Zoom timeline unchanged — this only drives mesh/body yaw.
 */
export function animatingYawRadians(t: number, startYawRad: number): number {
  const capped = Math.min(Math.max(0, t), TIMELINE.TOTAL);
  const aligned = startYawRad + shortestYawDeltaToZero(startYawRad);

  if (capped <= RESET_DURATION) {
    const u = smoothstep(capped / RESET_DURATION);
    return MathUtils.lerp(startYawRad, aligned, u);
  }

  const strainT = capped - RESET_DURATION;
  const strainTotal = TIMELINE.TOTAL - RESET_DURATION;
  const env = smoothstep(
    window01(strainT, 0, Math.min(0.45, strainTotal * 0.2)),
  );
  const osc =
    STRAIN.AMP1 * Math.sin(STRAIN.OMEGA1 * strainT) * env +
    STRAIN.AMP2 * Math.sin(STRAIN.OMEGA2 * strainT + 1.1) * env;
  return aligned + osc;
}

/**
 * Pitch (radians) during ANIMATING: 0 while resetting yaw, then lean + X wobble in strain.
 */
export function animatingPitchRadians(t: number): number {
  const capped = Math.min(Math.max(0, t), TIMELINE.TOTAL);
  if (capped <= RESET_DURATION) {
    return 0;
  }
  const strainT = capped - RESET_DURATION;
  const strainTotal = TIMELINE.TOTAL - RESET_DURATION;
  const env = smoothstep(
    window01(strainT, 0, Math.min(0.45, strainTotal * 0.2)),
  );
  const lean = PITCH.LEAN * env;
  const wobble =
    PITCH.WOBBLE1 * env * Math.sin(PITCH.OMEGA1 * strainT + 0.4) +
    PITCH.WOBBLE2 * env * Math.sin(PITCH.OMEGA2 * strainT + 1.3);
  return lean + wobble;
}

/**
 * Roll (radians) during ANIMATING: 0 while resetting yaw, then Z wobble in strain.
 */
export function animatingRollRadians(t: number): number {
  const capped = Math.min(Math.max(0, t), TIMELINE.TOTAL);
  if (capped <= RESET_DURATION) {
    return 0;
  }
  const strainT = capped - RESET_DURATION;
  const strainTotal = TIMELINE.TOTAL - RESET_DURATION;
  const env = smoothstep(
    window01(strainT, 0, Math.min(0.45, strainTotal * 0.2)),
  );
  return (
    env *
    (ROLL.SWAY1 * Math.sin(ROLL.OMEGA1 * strainT + ROLL.PHASE) +
      ROLL.SWAY2 * Math.sin(ROLL.OMEGA2 * strainT + 0.7))
  );
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

export const COIN_SCALE = 0.5;
export const COIN_RADIUS = 0.32 * COIN_SCALE;
export const COIN_THICKNESS = 0.092 * COIN_SCALE;

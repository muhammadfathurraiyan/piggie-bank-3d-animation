import { MathUtils } from "three";

/** Timeline for the “double or nothing” spin (seconds). */
export const TIMELINE = {
  TOTAL: 6,
  ROT: { A: 1, B: 4 },
  SCALE: { A: 1, B: 5 },
} as const;

/**
 * Legacy default when start yaw is unknown (e.g. Model.tsx). Real reset uses
 * {@link resetYawReturnDuration} from the idle angle at animation start.
 */
export const RESET_DURATION = 1.35;

const STRAIN = {
  AMP1: 0.11,
  AMP2: 0.048,
  OMEGA1: 14,
  OMEGA2: 22,
} as const;

/** Pitch (rotation X) during strain. */
const PITCH = {
  LEAN: -0.12,
  WOBBLE1: 0.065,
  WOBBLE2: 0.028,
  OMEGA1: 15,
  OMEGA2: 23,
} as const;

/** Roll (rotation Z) during strain. */
const ROLL = {
  SWAY1: 0.058,
  SWAY2: 0.04,
  OMEGA1: 17,
  OMEGA2: 26,
  PHASE: 2.1,
} as const;

export const IDLE_ROT_SPEED = 1;
/** Y spin during RESULTS — stronger celebration (watch coin containment). */
export const ROT_MAX = 1.75;
/** Peak zoom multiplier during the spin (narrower FOV ≈ × larger on screen; same curve as old mesh scale). */
export const SCALE_MAX = 1.95;

export const SCALE_IN_LAMBDA = 5;
export const SCALE_EPS = 0;

/** Damping when settling celebration after RESULTS → IDLE. */
export const SETTLE_DAMP = 2.2;

/** One-shot extra zoom multiplier at RESULTS entry (FOV punch, ~0.7s). */
export const BANG = {
  DURATION: 0.7,
  PEAK_EXTRA: 0.44,
  ATTACK_FR: 0.12,
} as const;

const SHAKE = {
  IDLE: 0.016,
  ANIM_MIN: 0.055,
  ANIM_MAX: 0.14,
  RESULTS_MUL: 0.72,
} as const;

/** Phase advance per second — higher = snappier shake oscillation. */
const SHAKE_PHASE = { ANIMATING: 14, RESULTS: 10 } as const;

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
 * Return-to-front yaw: duration = clamp(|Δyaw| / RESET_YAW_SPEED, MIN, MAX).
 * Large |Δyaw| hits MAX (2s) and rotates faster than RESET_YAW_SPEED alone would allow.
 */
const RESET_YAW_SPEED = 0.15;
const RESET_RETURN_DUR_MIN = 0.5;
const RESET_RETURN_DUR_MAX = 1;

/**
 * Phase A length: scales with how far we must rotate from idle yaw to face forward.
 * Uses linear yaw over this interval (no smoothstep peak) to avoid a hard sweep.
 */
export function resetYawReturnDuration(startYawRad: number): number {
  const mag = Math.abs(shortestYawDeltaToZero(startYawRad));
  if (mag < 1e-4) {
    return Math.min(RESET_RETURN_DUR_MIN * 0.4, 0.55);
  }
  return MathUtils.clamp(
    mag / RESET_YAW_SPEED,
    RESET_RETURN_DUR_MIN,
    RESET_RETURN_DUR_MAX,
  );
}

function shakeStressAt(t: number, startYawRad: number | undefined): number {
  const { SCALE } = TIMELINE;
  const capped = Math.min(t, TIMELINE.TOTAL);
  const resetDur =
    startYawRad !== undefined
      ? resetYawReturnDuration(startYawRad)
      : RESET_DURATION;
  if (capped <= resetDur) {
    return 0;
  }
  const strainT = capped - resetDur;
  const strainTotal = TIMELINE.TOTAL - resetDur;
  const rampStrain = smoothstep(
    window01(strainT, 0, Math.min(0.38, strainTotal * 0.12)),
  );
  const rampScale = smoothstep(window01(capped, SCALE.A, SCALE.B));
  return Math.max(rampStrain, rampScale * 0.9);
}

function strainEnvWindow(strainT: number, strainTotal: number): number {
  return smoothstep(window01(strainT, 0, Math.min(0.3, strainTotal * 0.1)));
}

/**
 * Yaw (radians) during ANIMATING: linear return to front-facing, then bounded struggle oscillation.
 */
export function animatingYawRadians(t: number, startYawRad: number): number {
  const capped = Math.min(Math.max(0, t), TIMELINE.TOTAL);
  const aligned = startYawRad + shortestYawDeltaToZero(startYawRad);
  const resetDur = resetYawReturnDuration(startYawRad);

  if (capped <= resetDur) {
    const u = capped / resetDur;
    return MathUtils.lerp(startYawRad, aligned, u);
  }

  const strainT = capped - resetDur;
  const strainTotal = TIMELINE.TOTAL - resetDur;
  const env = strainEnvWindow(strainT, strainTotal);
  const osc =
    STRAIN.AMP1 * Math.sin(STRAIN.OMEGA1 * strainT) * env +
    STRAIN.AMP2 * Math.sin(STRAIN.OMEGA2 * strainT + 1.1) * env;
  return aligned + osc;
}

/**
 * Pitch (radians) during ANIMATING: 0 while yaw resets, then lean + X wobble in strain.
 */
export function animatingPitchRadians(t: number, startYawRad: number): number {
  const capped = Math.min(Math.max(0, t), TIMELINE.TOTAL);
  const resetDur = resetYawReturnDuration(startYawRad);
  if (capped <= resetDur) {
    return 0;
  }
  const strainT = capped - resetDur;
  const strainTotal = TIMELINE.TOTAL - resetDur;
  const env = strainEnvWindow(strainT, strainTotal);
  const lean = PITCH.LEAN * env;
  const wobble =
    PITCH.WOBBLE1 * env * Math.sin(PITCH.OMEGA1 * strainT + 0.4) +
    PITCH.WOBBLE2 * env * Math.sin(PITCH.OMEGA2 * strainT + 1.3);
  return lean + wobble;
}

/**
 * Roll (radians) during ANIMATING: 0 while yaw resets, then Z wobble in strain.
 */
export function animatingRollRadians(t: number, startYawRad: number): number {
  const capped = Math.min(Math.max(0, t), TIMELINE.TOTAL);
  const resetDur = resetYawReturnDuration(startYawRad);
  if (capped <= resetDur) {
    return 0;
  }
  const strainT = capped - resetDur;
  const strainTotal = TIMELINE.TOTAL - resetDur;
  const env = strainEnvWindow(strainT, strainTotal);
  return (
    env *
    (ROLL.SWAY1 * Math.sin(ROLL.OMEGA1 * strainT + ROLL.PHASE) +
      ROLL.SWAY2 * Math.sin(ROLL.OMEGA2 * strainT + 0.7))
  );
}

export function shakeAmountAnimating(t: number, startYawRad?: number): number {
  const stress = shakeStressAt(t, startYawRad);
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

/** Multiplier on shake translation applied to kinematic pig (lower = coins stay inside). */
export const SHAKE_ESCAPE_MUL = 0.24;

import { MathUtils } from "three";

import { TIMELINE } from "./constants";
import { smoothstep, window01 } from "./easing";
import { resetYawReturnDuration, shortestYawDeltaToZero } from "./angles";

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

import { MathUtils } from "three";

import {
  IDLE_ROT_SPEED,
  RESET_DURATION,
  ROT_MAX,
  SCALE_MAX,
  TIMELINE,
} from "./constants";
import { smoothstep, window01 } from "./easing";
import { resetYawReturnDuration } from "./angles";

const SHAKE = {
  IDLE: 0.016,
  ANIM_MIN: 0.055,
  ANIM_MAX: 0.14,
  RESULTS_MUL: 0.72,
} as const;

const SHAKE_PHASE = { PIG_ANIMATION: 14, BALL_ANIMATION: 0 } as const;

const SETTLE_EPS = {
  BOOST: 1.002,
  SPEED: IDLE_ROT_SPEED + 0.03,
} as const;

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
  mode: "PIG_ANIMATION" | "BALL_ANIMATION",
): number {
  return phase + delta * SHAKE_PHASE[mode];
}

export function isCelebrationSettling(
  boost: number,
  spinSpeed: number,
): boolean {
  return boost > SETTLE_EPS.BOOST || spinSpeed > SETTLE_EPS.SPEED;
}

import { MathUtils } from "three";

const RESET_YAW_SPEED = 0.15;
const RESET_RETURN_DUR_MIN = 0.5;
const RESET_RETURN_DUR_MAX = 1;

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
 * Phase A length: scales with how far we must rotate from idle yaw to face forward.
 * Uses linear yaw over this interval (no smoothstep peak) to avoid a hard sweep.
 *
 * Return-to-front yaw: duration = clamp(|Δyaw| / RESET_YAW_SPEED, MIN, MAX).
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

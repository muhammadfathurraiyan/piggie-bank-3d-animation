import { MathUtils } from "three";

import {
  IDLE_ROT_SPEED,
  ROT_MAX,
  SCALE_MAX,
  TIMELINE,
} from "./constants";
import { smoothstep, window01 } from "./easing";

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

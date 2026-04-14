/**
 * Pig / camera animation helpers: timeline curves, strain pose, shake, bang zoom.
 */

export {
  BANG,
  IDLE_ROT_SPEED,
  RESET_DURATION,
  ROT_MAX,
  SCALE_EPS,
  SCALE_IN_LAMBDA,
  SCALE_MAX,
  SETTLE_DAMP,
  SHAKE_ESCAPE_MUL,
  TIMELINE,
} from "./constants";

export { smoothstep, window01 } from "./easing";

export {
  resetYawReturnDuration,
  shortestYawDeltaToZero,
  wrapPi,
} from "./angles";

export { bangMultiplier } from "./bang";

export { animatingRotationSpeed, animatingZoomBoost } from "./timelineMotion";

export {
  animatingPitchRadians,
  animatingRollRadians,
  animatingYawRadians,
} from "./strainPose";

export {
  advanceShakePhase,
  isCelebrationSettling,
  shakeAmountAnimating,
  shakeAmountResults,
  shakeOffsetInto,
} from "./shake";

export { clampFrameDelta } from "./frameLimits";

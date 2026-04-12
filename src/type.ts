export const AnimationState = {
  IDLE: "IDLE",
  ANIMATING: "ANIMATING",
  RESULTS: "RESULTS",
  COMPLETE: "COMPLETE",
} as const;

export type AnimationState =
  (typeof AnimationState)[keyof typeof AnimationState];

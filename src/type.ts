export const AnimationState = {
  IDLE: "IDLE",
  ANIMATING: "ANIMATING",
  COMPLETE: "COMPLETE",
} as const;

export type AnimationState =
  (typeof AnimationState)[keyof typeof AnimationState];

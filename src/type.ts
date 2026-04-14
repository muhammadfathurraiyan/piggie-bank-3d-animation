export const AnimationState = {
  IDLE: "IDLE",
  USDC_ENTER_ANIMATION: "USDC_ENTER_ANIMATION",
  PIG_ANIMATION: "PIG_ANIMATION",
  BALL_ANIMATION: "BALL_ANIMATION",
  BALL_CRACK_ANIMATION: "BALL_CRACK_ANIMATION",
  RESULTS: "RESULTS",
  COMPLETE: "COMPLETE",
} as const;

export type AnimationState =
  (typeof AnimationState)[keyof typeof AnimationState];

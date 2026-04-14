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

/** Multiplier on shake translation applied to kinematic pig (lower = coins stay inside). */
export const SHAKE_ESCAPE_MUL = 0.24;

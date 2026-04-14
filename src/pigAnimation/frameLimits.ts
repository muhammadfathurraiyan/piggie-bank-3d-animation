/**
 * After a tab or window is in the background, `requestAnimationFrame` can resume with a
 * multi-second gap. Using that raw delta in one frame breaks Rapier stability and animation
 * timelines. Cap keeps motion predictable when the user returns.
 */
export const MAX_FRAME_DELTA_SEC = 1 / 30;

export function clampFrameDelta(deltaSeconds: number): number {
  return Math.min(deltaSeconds, MAX_FRAME_DELTA_SEC);
}

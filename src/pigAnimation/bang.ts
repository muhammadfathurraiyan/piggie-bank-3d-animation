import { BANG } from "./constants";
import { smoothstep } from "./easing";

export function bangMultiplier(elapsed: number): number {
  if (elapsed <= 0 || elapsed >= BANG.DURATION) return 1;
  const u = elapsed / BANG.DURATION;
  if (u < BANG.ATTACK_FR) {
    return 1 + BANG.PEAK_EXTRA * smoothstep(u / BANG.ATTACK_FR);
  }
  const fall = (u - BANG.ATTACK_FR) / (1 - BANG.ATTACK_FR);
  return 1 + BANG.PEAK_EXTRA * (1 - smoothstep(fall));
}

import { startTransition, useEffect, useState } from "react";

import { AnimationState, type AnimationState as AnimState } from "../type";

/**
 * Hides the WebGL canvas shortly after entering RESULTS so the zoom read lands,
 * without keeping the canvas visible for the whole overlay.
 */
export function useCanvasHiddenAfterResults(
  animationState: AnimState,
  delayMs: number,
): boolean {
  const [suppress, setSuppress] = useState(false);

  useEffect(() => {
    if (animationState !== AnimationState.RESULTS) {
      startTransition(() => setSuppress(false));
      return;
    }
    startTransition(() => setSuppress(false));
    const id = window.setTimeout(() => {
      startTransition(() => setSuppress(true));
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [animationState, delayMs]);

  return animationState === AnimationState.RESULTS && suppress;
}

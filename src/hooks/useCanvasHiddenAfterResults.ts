import { startTransition, useEffect, useRef, useState } from "react";

import { AnimationState, type AnimationState as AnimState } from "../type";

function isBallPhase(s: AnimState): boolean {
  return (
    s === AnimationState.BALL_ANIMATION ||
    s === AnimationState.BALL_CRACK_ANIMATION ||
    s === AnimationState.RESULTS
  );
}

/**
 * Hides the WebGL canvas shortly after the ball / results phase starts so the zoom read lands,
 * without keeping the canvas visible for the whole overlay.
 *
 * Transitions inside that phase (e.g. BALL → CRACK → RESULTS) do not reveal the canvas again
 * or restart the hide timer.
 */
export function useCanvasHiddenAfterResults(
  animationState: AnimState,
  delayMs: number,
): boolean {
  const [suppress, setSuppress] = useState(false);
  const wasInPhaseRef = useRef(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const inPhase = isBallPhase(animationState);

    if (!inPhase) {
      if (hideTimeoutRef.current != null) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      wasInPhaseRef.current = false;
      startTransition(() => setSuppress(false));
      return;
    }

    const enteringFromOutside = !wasInPhaseRef.current;
    wasInPhaseRef.current = true;

    if (!enteringFromOutside) {
      return;
    }

    startTransition(() => setSuppress(false));
    hideTimeoutRef.current = window.setTimeout(() => {
      hideTimeoutRef.current = null;
      startTransition(() => setSuppress(true));
    }, delayMs);
  }, [animationState, delayMs]);

  useEffect(
    () => () => {
      if (hideTimeoutRef.current != null) {
        window.clearTimeout(hideTimeoutRef.current);
      }
    },
    [],
  );

  return isBallPhase(animationState) && suppress;
}

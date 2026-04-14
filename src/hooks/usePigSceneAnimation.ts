import { useFrame } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import { useEffect, useRef, type RefObject } from "react";
import { Euler, MathUtils, PerspectiveCamera, Quaternion } from "three";

import {
  advanceShakePhase,
  animatingPitchRadians,
  animatingRollRadians,
  animatingYawRadians,
  animatingZoomBoost,
  BANG,
  bangMultiplier,
  IDLE_ROT_SPEED,
  isCelebrationSettling,
  ROT_MAX,
  SCALE_MAX,
  SETTLE_DAMP,
  SHAKE_ESCAPE_MUL,
  shakeAmountAnimating,
  shakeAmountResults,
  shakeOffsetInto,
  TIMELINE,
} from "../pigAnimation";
import { clampFrameDelta } from "../pigAnimation";
import { AnimationState, type AnimationState as AnimState } from "../type";

/** Caps spin rate after celebration so physics stay stable. */
const MAX_IDLE_YAW_RATE = 12;

export function usePigSceneAnimation(
  animationState: AnimState,
  setAnimationState: (state: AnimState) => void,
  pigRef: RefObject<RapierRigidBody | null>,
) {
  const tmpShake = useRef({ x: 0, y: 0, z: 0 });
  const idleFovRef = useRef<number | null>(null);
  const zoomBoostRef = useRef(1);
  const resultsBangElapsed = useRef(0);
  const ballZoomAfterBang = useRef(SCALE_MAX);

  const rotationY = useRef(0);
  const rotationX = useRef(0);
  const rotationZ = useRef(0);
  const pigRotEuler = useRef(new Euler());
  const pigRotQuat = useRef(new Quaternion());
  const shakePhase = useRef(0);
  const pigBaseTranslation = useRef<{ x: number; y: number; z: number } | null>(
    null,
  );

  const animT = useRef(0);
  const animStartYawRef = useRef(0);
  const completeSpeed = useRef(IDLE_ROT_SPEED);
  const prevState = useRef<AnimState>(AnimationState.IDLE);
  const animFinishSent = useRef(false);

  useEffect(() => {
    if (animationState === AnimationState.PIG_ANIMATION) {
      animT.current = 0;
      animFinishSent.current = false;
      completeSpeed.current = IDLE_ROT_SPEED;
      zoomBoostRef.current = 1;
      animStartYawRef.current = rotationY.current;
    }

    if (
      animationState === AnimationState.BALL_ANIMATION &&
      prevState.current === AnimationState.PIG_ANIMATION
    ) {
      completeSpeed.current = ROT_MAX;
      resultsBangElapsed.current = 0;
      ballZoomAfterBang.current = SCALE_MAX;
    }

    prevState.current = animationState;
  }, [animationState]);

  useFrame((state, delta) => {
    const dt = clampFrameDelta(delta);
    const camera = state.camera;
    let rotSpeed = IDLE_ROT_SPEED;

    if (animationState === AnimationState.PIG_ANIMATION) {
      animT.current += dt;
      let t = animT.current;

      if (t >= TIMELINE.TOTAL) {
        if (!animFinishSent.current) {
          animFinishSent.current = true;
          setAnimationState(AnimationState.BALL_ANIMATION);
        }
        t = TIMELINE.TOTAL;
      }
    } else if (animationState === AnimationState.BALL_ANIMATION) {
      resultsBangElapsed.current += dt;
      rotSpeed = completeSpeed.current;
      if (resultsBangElapsed.current >= BANG.DURATION) {
        completeSpeed.current = MathUtils.damp(
          completeSpeed.current,
          IDLE_ROT_SPEED,
          SETTLE_DAMP,
          dt,
        );
        rotSpeed = completeSpeed.current;
      }
    } else if (animationState === AnimationState.IDLE) {
      if (isCelebrationSettling(1, completeSpeed.current)) {
        completeSpeed.current = MathUtils.damp(
          completeSpeed.current,
          IDLE_ROT_SPEED,
          SETTLE_DAMP,
          dt,
        );
        rotSpeed = completeSpeed.current;
      }
    }

    const isShakePhase =
      animationState === AnimationState.PIG_ANIMATION ||
      animationState === AnimationState.BALL_ANIMATION;

    if (isShakePhase) {
      shakePhase.current = advanceShakePhase(
        shakePhase.current,
        dt,
        animationState === AnimationState.PIG_ANIMATION
          ? "PIG_ANIMATION"
          : "BALL_ANIMATION",
      );
    }

    let shakeAmount = 0;
    if (animationState === AnimationState.PIG_ANIMATION) {
      shakeAmount = shakeAmountAnimating(
        animT.current,
        animStartYawRef.current,
      );
    } else if (animationState === AnimationState.BALL_ANIMATION) {
      const bangDone = resultsBangElapsed.current >= BANG.DURATION;
      const shakeBoost = bangDone ? ballZoomAfterBang.current : SCALE_MAX;
      shakeAmount = shakeAmountResults(shakeBoost, completeSpeed.current);
    }

    let zoomBoost = 1;
    if (animationState === AnimationState.PIG_ANIMATION) {
      zoomBoost = animatingZoomBoost(Math.min(animT.current, TIMELINE.TOTAL));
      zoomBoostRef.current = zoomBoost;
    } else if (animationState === AnimationState.BALL_ANIMATION) {
      if (resultsBangElapsed.current < BANG.DURATION) {
        ballZoomAfterBang.current = SCALE_MAX;
      } else {
        ballZoomAfterBang.current = MathUtils.damp(
          ballZoomAfterBang.current,
          1,
          SETTLE_DAMP,
          dt,
        );
      }
      zoomBoost = ballZoomAfterBang.current;
      zoomBoostRef.current = ballZoomAfterBang.current;
    } else {
      zoomBoostRef.current = MathUtils.damp(
        zoomBoostRef.current,
        1,
        SETTLE_DAMP,
        dt,
      );
      zoomBoost = zoomBoostRef.current;
    }

    let zoomForFov = zoomBoost;
    if (animationState === AnimationState.BALL_ANIMATION) {
      zoomForFov =
        resultsBangElapsed.current < BANG.DURATION
          ? SCALE_MAX * bangMultiplier(resultsBangElapsed.current)
          : ballZoomAfterBang.current;
    }

    const persp = camera as PerspectiveCamera;
    if (persp.isPerspectiveCamera) {
      if (idleFovRef.current === null) idleFovRef.current = persp.fov;
      persp.fov = idleFovRef.current / zoomForFov;
      persp.updateProjectionMatrix();
    }

    const s = tmpShake.current;
    shakeOffsetInto(s, shakePhase.current, shakeAmount * SHAKE_ESCAPE_MUL);
    s.y *= 0.88;

    const body = pigRef.current;
    if (!body) return;

    if (!pigBaseTranslation.current) {
      const tr = body.translation();
      pigBaseTranslation.current = { x: tr.x, y: tr.y, z: tr.z };
    }
    const b = pigBaseTranslation.current;

    if (animationState === AnimationState.PIG_ANIMATION) {
      const t = Math.min(animT.current, TIMELINE.TOTAL);
      rotationY.current = animatingYawRadians(t, animStartYawRef.current);
      rotationX.current = animatingPitchRadians(t, animStartYawRef.current);
      rotationZ.current = animatingRollRadians(t, animStartYawRef.current);
    } else {
      const safeSpeed = Math.min(rotSpeed, MAX_IDLE_YAW_RATE);
      rotationY.current += dt * safeSpeed;
      rotationX.current = MathUtils.damp(rotationX.current, 0, SETTLE_DAMP, dt);
      rotationZ.current = MathUtils.damp(rotationZ.current, 0, SETTLE_DAMP, dt);
    }

    body.setNextKinematicTranslation({
      x: b.x + s.x,
      y: b.y + s.y,
      z: b.z + s.z,
    });

    pigRotEuler.current.set(
      rotationX.current,
      rotationY.current,
      rotationZ.current,
      "YXZ",
    );
    pigRotQuat.current.setFromEuler(pigRotEuler.current);
    const q = pigRotQuat.current;
    body.setNextKinematicRotation({
      x: q.x,
      y: q.y,
      z: q.z,
      w: q.w,
    });
  });
}

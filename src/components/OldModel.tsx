import { Center, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { useEffect, useRef } from "react";
import { Group, MathUtils } from "three";

import coinUrl from "../assets/Coin.gltf?url";
import piggieUrl from "../assets/Pig.gltf?url";
import { AnimationState, type AnimationState as AnimState } from "../type";

useGLTF.preload(piggieUrl);
useGLTF.preload(coinUrl);

const SCALE_IN_LAMBDA = 5;
const SCALE_EPS = 0;

const TOTAL_S = 6;
const T_ROT_A = 1;
const T_ROT_B = 4;
const T_SCALE_A = 1;
const T_SCALE_B = 5;

const IDLE_ROT_SPEED = 1;
const ROT_MAX = 10;
const SCALE_MAX = 1.5;

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function window01(t: number, a: number, b: number): number {
  if (t <= a || b <= a) return 0;
  if (t >= b) return 1;
  return (t - a) / (b - a);
}

export function Model({
  animationState,
  setAnimationState,
}: {
  animationState: AnimState;
  setAnimationState: (state: AnimState) => void;
}) {
  const pig = useGLTF(piggieUrl);
  const coin = useGLTF(coinUrl);

  const pigBody = useRef<RapierRigidBody | null>(null);
  const pigGroup = useRef<Group>(null);
  const coinGroup = useRef<Group>(null);

  const rotationY = useRef(0);

  const scaleIn = useRef(SCALE_EPS);
  const animT = useRef(0);
  const completeBoost = useRef(1);
  const completeSpeed = useRef(IDLE_ROT_SPEED);
  const prevState = useRef<AnimState>(AnimationState.IDLE);
  const animFinishSent = useRef(false);
  const settleToIdleSent = useRef(false);

  useEffect(() => {
    if (animationState === AnimationState.ANIMATING) {
      animT.current = 0;
      animFinishSent.current = false;
      settleToIdleSent.current = false;
    }

    if (
      animationState === AnimationState.COMPLETE &&
      prevState.current === AnimationState.ANIMATING
    ) {
      completeBoost.current = SCALE_MAX;
      completeSpeed.current = ROT_MAX;
    }

    prevState.current = animationState;
  }, [animationState]);

  useFrame((_, delta) => {
    scaleIn.current = MathUtils.damp(
      scaleIn.current,
      1,
      SCALE_IN_LAMBDA,
      delta,
    );

    const baseScale = scaleIn.current;

    let rotSpeed = IDLE_ROT_SPEED;
    let boost = 1;

    if (animationState === AnimationState.ANIMATING) {
      animT.current += delta;
      let t = animT.current;

      if (t >= TOTAL_S) {
        if (!animFinishSent.current) {
          animFinishSent.current = true;
          setAnimationState(AnimationState.COMPLETE);
        }
        t = TOTAL_S;
      }

      if (t < T_ROT_A) {
        rotSpeed = IDLE_ROT_SPEED;
      } else if (t <= T_ROT_B) {
        const u = smoothstep(window01(t, T_ROT_A, T_ROT_B));
        rotSpeed = MathUtils.lerp(IDLE_ROT_SPEED, ROT_MAX, u);
      } else {
        rotSpeed = ROT_MAX;
      }

      if (t < T_SCALE_A) {
        boost = 1;
      } else if (t <= T_SCALE_B) {
        const u = smoothstep(window01(t, T_SCALE_A, T_SCALE_B));
        boost = MathUtils.lerp(1, SCALE_MAX, u);
      } else {
        boost = SCALE_MAX;
      }
    } else if (animationState === AnimationState.COMPLETE) {
      completeSpeed.current = MathUtils.damp(
        completeSpeed.current,
        IDLE_ROT_SPEED,
        2.2,
        delta,
      );
      completeBoost.current = MathUtils.damp(
        completeBoost.current,
        1,
        2.2,
        delta,
      );

      rotSpeed = completeSpeed.current;
      boost = completeBoost.current;

      const settled =
        Math.abs(completeSpeed.current - IDLE_ROT_SPEED) < 0.06 &&
        Math.abs(completeBoost.current - 1) < 0.025;

      if (settled && !settleToIdleSent.current) {
        settleToIdleSent.current = true;
        completeSpeed.current = IDLE_ROT_SPEED;
        completeBoost.current = 1;
        setAnimationState(AnimationState.IDLE);
      }
    }

    if (pigBody.current) {
      rotationY.current += delta * rotSpeed;

      pigBody.current.setNextKinematicRotation({
        x: 0,
        y: Math.sin(rotationY.current / 2),
        z: 0,
        w: Math.cos(rotationY.current / 2),
      });
    }

    if (pigGroup.current) {
      const s = baseScale * boost;
      pigGroup.current.scale.set(s, s, s);
    }
    if (coinGroup.current) {
      const s = baseScale * boost;
      coinGroup.current.scale.set(s, s, s);
    }
  });

  return (
    <Physics gravity={[0, -9.81, 0]}>
      <Environment preset="warehouse" environmentIntensity={0.45} blur={20} />

      <Center>
        <RigidBody ref={pigBody} type="kinematicPosition" colliders="trimesh">
          <group ref={pigGroup}>
            <primitive object={pig.scene} />
          </group>
        </RigidBody>

        {Array.from({ length: 10 }).map((_, index) => (
          <RigidBody
            ccd
            colliders="hull"
            restitution={0.1}
            friction={0.6}
            linearDamping={0}
            angularDamping={0.05}
            position={[0, 1, 0]}
            enabledRotations={[true, true, true]}
            key={index}
          >
            <group ref={coinGroup}>
              <primitive object={coin.scene} scale={0.4} />
            </group>
          </RigidBody>
        ))}
      </Center>

      <OrbitControls makeDefault enableZoom={false} minDistance={12} />

      <EffectComposer>
        <Bloom
          intensity={1.75}
          luminanceThreshold={0.62}
          luminanceSmoothing={0.35}
          mipmapBlur
          radius={0.55}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.62} />
      </EffectComposer>
    </Physics>
  );
}

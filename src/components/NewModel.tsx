import { Center, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Physics,
  RigidBody,
  MeshCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import { useEffect, useRef } from "react";
import {
  Euler,
  Group,
  MathUtils,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Quaternion,
} from "three";

import pigUrl from "../assets/Pigs.glb?url";
import { AnimationState, type AnimationState as AnimState } from "../type";
import {
  advanceShakePhase,
  animatingPitchRadians,
  animatingRollRadians,
  animatingYawRadians,
  animatingZoomBoost,
  bangMultiplier,
  IDLE_ROT_SPEED,
  isCelebrationSettling,
  ROT_MAX,
  SCALE_MAX,
  SETTLE_DAMP,
  shakeAmountAnimating,
  shakeAmountResults,
  shakeOffsetInto,
  TIMELINE,
} from "../pigAnimation";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";

useGLTF.preload(pigUrl);

type GLTFResult = {
  nodes: {
    Pig_Visual: Object3D;
    Pig_Collider: Mesh;
  };
};

type PigProps = {
  pigRef: React.RefObject<RapierRigidBody | null>;
  pigGroup: React.RefObject<Group | null>;
};

const randomPosition = (i: number): [number, number, number] => {
  return [
    (Math.random() - 0.5) * 0.3,
    1 + i * 0.15,
    (Math.random() - 0.5) * 0.3,
  ];
};

/** Scales shake applied to kinematic translation — keep low so coins stay inside the pig. */
const SHAKE_ESCAPE_MUL = 0.44;

export type ModelProps = {
  animationState: AnimState;
  setAnimationState: (state: AnimState) => void;
};

export function Model({ animationState, setAnimationState }: ModelProps) {
  const pigRef = useRef<RapierRigidBody | null>(null);
  const pigGroup = useRef<Group | null>(null);

  const tmpShake = useRef({ x: 0, y: 0, z: 0 });
  const idleFovRef = useRef<number | null>(null);
  const zoomBoostRef = useRef(1);
  const resultsBangElapsed = useRef(0);

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
    if (animationState === AnimationState.ANIMATING) {
      animT.current = 0;
      animFinishSent.current = false;
      completeSpeed.current = IDLE_ROT_SPEED;
      zoomBoostRef.current = 1;
      animStartYawRef.current = rotationY.current;
    }

    if (
      animationState === AnimationState.RESULTS &&
      prevState.current === AnimationState.ANIMATING
    ) {
      completeSpeed.current = ROT_MAX;
      resultsBangElapsed.current = 0;
    }

    prevState.current = animationState;
  }, [animationState]);

  useFrame((state, delta) => {
    const camera = state.camera;
    let rotSpeed = IDLE_ROT_SPEED;

    if (animationState === AnimationState.ANIMATING) {
      animT.current += delta;
      let t = animT.current;

      if (t >= TIMELINE.TOTAL) {
        if (!animFinishSent.current) {
          animFinishSent.current = true;
          setAnimationState(AnimationState.RESULTS);
        }
        t = TIMELINE.TOTAL;
      }
    } else if (animationState === AnimationState.RESULTS) {
      rotSpeed = completeSpeed.current;
    } else if (animationState === AnimationState.IDLE) {
      if (isCelebrationSettling(1, completeSpeed.current)) {
        completeSpeed.current = MathUtils.damp(
          completeSpeed.current,
          IDLE_ROT_SPEED,
          SETTLE_DAMP,
          delta,
        );
        rotSpeed = completeSpeed.current;
      }
    }

    if (
      animationState === AnimationState.ANIMATING ||
      animationState === AnimationState.RESULTS
    ) {
      shakePhase.current = advanceShakePhase(
        shakePhase.current,
        delta,
        animationState === AnimationState.ANIMATING ? "ANIMATING" : "RESULTS",
      );
    }

    let shakeAmount = 0;
    if (animationState === AnimationState.ANIMATING) {
      shakeAmount = shakeAmountAnimating(animT.current);
    } else if (animationState === AnimationState.RESULTS) {
      shakeAmount = shakeAmountResults(SCALE_MAX, completeSpeed.current);
    }

    let zoomBoost = 1;
    if (animationState === AnimationState.ANIMATING) {
      zoomBoost = animatingZoomBoost(Math.min(animT.current, TIMELINE.TOTAL));
      zoomBoostRef.current = zoomBoost;
    } else if (animationState === AnimationState.RESULTS) {
      zoomBoost = SCALE_MAX;
      zoomBoostRef.current = SCALE_MAX;
      resultsBangElapsed.current += delta;
    } else {
      zoomBoostRef.current = MathUtils.damp(
        zoomBoostRef.current,
        1,
        SETTLE_DAMP,
        delta,
      );
      zoomBoost = zoomBoostRef.current;
    }

    let zoomForFov = zoomBoost;
    if (animationState === AnimationState.RESULTS) {
      zoomForFov = SCALE_MAX * bangMultiplier(resultsBangElapsed.current);
    }

    const persp = camera as PerspectiveCamera;
    if (persp.isPerspectiveCamera) {
      if (idleFovRef.current === null) idleFovRef.current = persp.fov;
      persp.fov = idleFovRef.current / zoomForFov;
      persp.updateProjectionMatrix();
    }

    const s = tmpShake.current;
    shakeOffsetInto(s, shakePhase.current, shakeAmount * SHAKE_ESCAPE_MUL);

    if (pigRef.current) {
      if (!pigBaseTranslation.current) {
        const tr = pigRef.current.translation();
        pigBaseTranslation.current = { x: tr.x, y: tr.y, z: tr.z };
      }
      const b = pigBaseTranslation.current;

      if (animationState === AnimationState.ANIMATING) {
        const t = Math.min(animT.current, TIMELINE.TOTAL);
        rotationY.current = animatingYawRadians(t, animStartYawRef.current);
        rotationX.current = animatingPitchRadians(t);
        rotationZ.current = animatingRollRadians(t);
      } else {
        const safeSpeed = Math.min(rotSpeed, 6);
        rotationY.current += delta * safeSpeed;
        rotationX.current = MathUtils.damp(
          rotationX.current,
          0,
          SETTLE_DAMP,
          delta,
        );
        rotationZ.current = MathUtils.damp(
          rotationZ.current,
          0,
          SETTLE_DAMP,
          delta,
        );
      }

      pigRef.current.setNextKinematicTranslation({
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
      pigRef.current.setNextKinematicRotation({
        x: q.x,
        y: q.y,
        z: q.z,
        w: q.w,
      });
    }
  });

  return (
    <>
      <Environment preset="warehouse" environmentIntensity={0.45} blur={4} />
      <OrbitControls makeDefault enableZoom={false} minDistance={12} />

      <Physics
        gravity={[0, -9.81, 0]}
        numSolverIterations={20}
        maxCcdSubsteps={8}
        predictionDistance={0.02}
      >
        <Center>
          <Pig pigRef={pigRef} pigGroup={pigGroup} />

          {Array.from({ length: 1 }).map((_, i) => {
            const position: [number, number, number] = randomPosition(i);

            return <Coin key={i} position={position} />;
          })}
        </Center>
      </Physics>

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
    </>
  );
}

function Pig({ pigRef, pigGroup }: PigProps) {
  const { nodes } = useGLTF(pigUrl) as unknown as GLTFResult;

  return (
    <RigidBody
      ref={pigRef}
      type="kinematicPosition"
      colliders={false}
      includeInvisible
    >
      <group ref={pigGroup}>
        <MeshCollider type="trimesh">
          <primitive object={nodes.Pig_Collider} />
        </MeshCollider>

        {/* <primitive object={nodes.Pig_Visual} /> */}
      </group>
    </RigidBody>
  );
}

type CoinProps = {
  position: [number, number, number];
};

/** Uniform scale vs previous coin (hull collider matches mesh). */
const COIN_MESH_SCALE = 0.68;
const COIN_R = 0.32 * COIN_MESH_SCALE;
const COIN_H = 0.092 * COIN_MESH_SCALE;
const COIN_INLAY_R = 0.26 * COIN_MESH_SCALE;
const COIN_INLAY_H = 0.005 * COIN_MESH_SCALE;
const COIN_INLAY_Y = 0.048 * COIN_MESH_SCALE;

function Coin({ position }: CoinProps) {
  return (
    <RigidBody
      type="dynamic"
      ccd
      colliders="hull"
      position={position}
      linearDamping={0.4}
      angularDamping={0.6}
      friction={0.8}
      restitution={0.05}
    >
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[COIN_R, COIN_R, COIN_H, 14]} />
        <meshStandardMaterial
          color="#f5c542"
          metalness={0.88}
          roughness={0.18}
          envMapIntensity={1.2}
        />
      </mesh>
      <mesh position={[0, COIN_INLAY_Y, 0]}>
        <cylinderGeometry args={[COIN_INLAY_R, COIN_INLAY_R, COIN_INLAY_H, 8]} />
        <meshStandardMaterial color="#e6b800" metalness={0.9} roughness={0.1} />
      </mesh>
    </RigidBody>
  );
}

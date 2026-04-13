import {
  Center,
  Decal,
  Environment,
  OrbitControls,
  useGLTF,
  useTexture,
} from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  BallCollider,
  MeshCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  DoubleSide,
  Euler,
  Group,
  MathUtils,
  Mesh,
  PerspectiveCamera,
  Quaternion,
  SRGBColorSpace,
  type Texture,
} from "three";

import { useMediaQuery } from "../hooks/useMediaQuery";
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
  SHAKE_ESCAPE_MUL,
  shakeAmountAnimating,
  shakeAmountResults,
  shakeOffsetInto,
  TIMELINE,
} from "../pigAnimation";
import { AnimationState, type AnimationState as AnimState } from "../type";

import imgIphone from "../assets/images/img-iphone.png";
import imgMacbook from "../assets/images/img-macbook.png";
import imgUsdc from "../assets/images/img-usdc.png";
import imgTexture from "../assets/images/img-ball-texture.png";
import pigUrl from "../assets/Pigs.glb?url";

useGLTF.preload(pigUrl);

// --- Scene tuning -----------------------------------------------------------------------------

const EXTRA_LARGE_MEDIA_QUERY = "(min-width: 1920px)";
const ORBIT_MIN_DISTANCE = { normal: 5, xl: 12 } as const;

const PHYSICS = {
  gravity: [0, -9.81, 0] as [number, number, number],
  numSolverIterations: 20,
  maxCcdSubsteps: 8,
  predictionDistance: 0.02,
} as const;

const POST = {
  bloom: {
    intensity: 1.75,
    luminanceThreshold: 0.62,
    luminanceSmoothing: 0.35,
    radius: 0.55,
  },
  vignette: { offset: 0.1, darkness: 0.62 },
} as const;

const ENVIRONMENT = {
  preset: "warehouse" as const,
  environmentIntensity: 0.45,
  blur: 4,
} as const;

/** Caps spin rate after celebration so physics stay stable. */
const MAX_IDLE_YAW_RATE = 12;

const BALL_TEXTURE_URLS = [imgIphone, imgMacbook, imgUsdc, imgTexture] as const;

type BallTextureIndex = 0 | 1 | 2 | 3;
type BallImageIndex = 0 | 1 | 2;

type DemoBall = {
  tex: BallTextureIndex;
  img: BallImageIndex;
};

/** How many prize orbs to spawn (demo catalog). */
const DEMO_BALL_COUNT = 24;

function buildDemoBalls(count: number): DemoBall[] {
  return Array.from({ length: count }, (_, i) => ({
    tex: 3,
    img: (i % 3) as BallImageIndex,
  }));
}

const DEMO_BALLS = buildDemoBalls(DEMO_BALL_COUNT);

function randomBallSpawn(): [number, number, number] {
  return [(Math.random() - 0.5) * 0.3, 1, (Math.random() - 0.5) * 0.3];
}

function cloneTexturesSRGB(textures: Texture | Texture[]): Texture[] {
  const list = Array.isArray(textures) ? textures : [textures];
  return list.map((t) => {
    const tex = t.clone();
    tex.colorSpace = SRGBColorSpace;
    return tex;
  });
}

// --- Pig (collider) ---------------------------------------------------------------------------

type GLTFResult = {
  nodes: {
    Pig_Collider: Mesh;
  };
};

type PigProps = {
  pigRef: RefObject<RapierRigidBody | null>;
  pigGroup: RefObject<Group | null>;
};

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

// --- Prize orbs -------------------------------------------------------------------------------

/** Outer glass shell radius; physics uses matching `BallCollider`. */
const BALL_MESH_SCALE = 0.92;
const BALL_RADIUS = 0.32 * BALL_MESH_SCALE;
/** Inner content sphere — slightly smaller so the shell reads as glass around it */
const BALL_INNER_RADIUS = BALL_RADIUS * 0.76;
/** Low density = light rigid bodies; stability from restitution 0 + damping + modest SHAKE_ESCAPE_MUL. */
const BALL_DENSITY = 2;

const innerDecalScale = (r: number): [number, number, number] => [
  r * 2.12,
  r * 2.12,
  r * 2.12,
];

type BallProps = {
  position: [number, number, number];
  texture: Texture;
  imageTexture: Texture;
};

function Ball({ position, texture, imageTexture }: BallProps) {
  const iconRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (!iconRef.current) return;
    iconRef.current.position.y =
      Math.sin(state.clock.elapsedTime * 1.5) * 0.03;
    iconRef.current.rotation.y += 0.003;
  });

  const planeSize = BALL_INNER_RADIUS * 1.2;

  return (
    <RigidBody
      type="dynamic"
      ccd
      colliders={false}
      position={position}
      density={BALL_DENSITY}
      linearDamping={1.15}
      angularDamping={0.88}
    >
      <BallCollider args={[BALL_RADIUS]} friction={1} restitution={0} />
      <group>
        <mesh ref={iconRef} position={[0, 0, 0]} renderOrder={5}>
          <planeGeometry args={[planeSize, planeSize]} />
          <meshBasicMaterial
            map={imageTexture}
            transparent
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
            side={DoubleSide}
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[BALL_INNER_RADIUS, 48, 48]} />
          <meshStandardMaterial
            color="#1c1c22"
            roughness={0.92}
            metalness={0}
          />
          <Decal
            position={[0, 0, BALL_INNER_RADIUS]}
            scale={innerDecalScale(BALL_INNER_RADIUS)}
            map={texture}
            polygonOffsetFactor={-8}
          />
          <Decal
            position={[0, 0, -BALL_INNER_RADIUS]}
            scale={innerDecalScale(BALL_INNER_RADIUS)}
            map={texture}
            polygonOffsetFactor={-8}
            rotation={[0, Math.PI, 0]}
          />
        </mesh>

        <mesh castShadow receiveShadow>
          <sphereGeometry args={[BALL_RADIUS, 64, 64]} />
          <meshPhysicalMaterial
            color="#FFD0D0"
            metalness={1}
            roughness={0.123666}
            transmission={0.94}
            thickness={BALL_RADIUS * 0.22}
            ior={1.5}
            blendAlpha={0.52}
            transparent
          />
        </mesh>
      </group>
    </RigidBody>
  );
}

// --- Pig + camera animation (kinematic pig, FOV punch, shake) ---------------------------------

function usePigSceneAnimation(
  animationState: AnimState,
  setAnimationState: (state: AnimState) => void,
  pigRef: RefObject<RapierRigidBody | null>,
) {
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

    const isShakePhase =
      animationState === AnimationState.ANIMATING ||
      animationState === AnimationState.RESULTS;

    if (isShakePhase) {
      shakePhase.current = advanceShakePhase(
        shakePhase.current,
        delta,
        animationState === AnimationState.ANIMATING ? "ANIMATING" : "RESULTS",
      );
    }

    let shakeAmount = 0;
    if (animationState === AnimationState.ANIMATING) {
      shakeAmount = shakeAmountAnimating(
        animT.current,
        animStartYawRef.current,
      );
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
    s.y *= 0.88;

    const body = pigRef.current;
    if (!body) return;

    if (!pigBaseTranslation.current) {
      const tr = body.translation();
      pigBaseTranslation.current = { x: tr.x, y: tr.y, z: tr.z };
    }
    const b = pigBaseTranslation.current;

    if (animationState === AnimationState.ANIMATING) {
      const t = Math.min(animT.current, TIMELINE.TOTAL);
      rotationY.current = animatingYawRadians(t, animStartYawRef.current);
      rotationX.current = animatingPitchRadians(t, animStartYawRef.current);
      rotationZ.current = animatingRollRadians(t, animStartYawRef.current);
    } else {
      const safeSpeed = Math.min(rotSpeed, MAX_IDLE_YAW_RATE);
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

// --- Public scene -----------------------------------------------------------------------------

export type ModelProps = {
  animationState: AnimState;
  setAnimationState: (state: AnimState) => void;
};

export function Model({ animationState, setAnimationState }: ModelProps) {
  const pigRef = useRef<RapierRigidBody | null>(null);
  const pigGroup = useRef<Group | null>(null);
  const isExtraLargeScreen = useMediaQuery(EXTRA_LARGE_MEDIA_QUERY);

  const ballTexturesLoaded = useTexture([...BALL_TEXTURE_URLS]);
  const ballTextures = useMemo(
    () => cloneTexturesSRGB(ballTexturesLoaded),
    [ballTexturesLoaded],
  );

  const ballPositions = useMemo(
    () =>
      Array.from({ length: DEMO_BALLS.length }, () =>
        randomBallSpawn(),
      ) as [number, number, number][],
    [],
  );

  usePigSceneAnimation(animationState, setAnimationState, pigRef);

  const orbitMinDistance = isExtraLargeScreen
    ? ORBIT_MIN_DISTANCE.xl
    : ORBIT_MIN_DISTANCE.normal;

  return (
    <>
      <Environment
        preset={ENVIRONMENT.preset}
        environmentIntensity={ENVIRONMENT.environmentIntensity}
        blur={ENVIRONMENT.blur}
      />
      <OrbitControls makeDefault enableZoom={false} minDistance={orbitMinDistance} />

      <Physics {...PHYSICS}>
        <Center>
          <Pig pigRef={pigRef} pigGroup={pigGroup} />

          {DEMO_BALLS.map((ball, i) => (
            <Ball
              key={`demo-ball-${i}`}
              position={ballPositions[i]!}
              texture={ballTextures[ball.tex]!}
              imageTexture={ballTextures[ball.img]!}
            />
          ))}
        </Center>
      </Physics>

      <EffectComposer>
        <Bloom
          intensity={POST.bloom.intensity}
          luminanceThreshold={POST.bloom.luminanceThreshold}
          luminanceSmoothing={POST.bloom.luminanceSmoothing}
          mipmapBlur
          radius={POST.bloom.radius}
        />
        <Vignette eskil={false} offset={POST.vignette.offset} darkness={POST.vignette.darkness} />
      </EffectComposer>
    </>
  );
}

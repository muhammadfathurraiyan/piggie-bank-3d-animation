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
import { useMemo, useRef, type RefObject } from "react";
import { DoubleSide, Group, Mesh, SRGBColorSpace, type Texture } from "three";

import { clampFrameDelta } from "../pigAnimation";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { usePigSceneAnimation } from "../hooks/usePigSceneAnimation";
import { type AnimationState as AnimState } from "../type";

import imgIphone from "../assets/images/img-iphone.png";
import imgMacbook from "../assets/images/img-macbook.png";
import imgUsdc from "../assets/images/img-usdc.png";
import imgTexture from "../assets/images/img-ball-texture.png";
import pigUrl from "../assets/Pigs.glb?url";

useGLTF.preload(pigUrl);

// --- Scene config -----------------------------------------------------------------------------

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

const BALL_TEXTURE_URLS = [imgIphone, imgMacbook, imgUsdc, imgTexture] as const;

type BallTextureIndex = 0 | 1 | 2 | 3;
type BallImageIndex = 0 | 1 | 2;

type DemoBall = { tex: BallTextureIndex; img: BallImageIndex };

const DEMO_BALL_COUNT = 24;

const DEMO_BALLS: DemoBall[] = Array.from(
  { length: DEMO_BALL_COUNT },
  (_, i) => ({
    tex: 3,
    img: (i % 3) as BallImageIndex,
  }),
);

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

// --- Pig collider -----------------------------------------------------------------------------

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
      </group>
    </RigidBody>
  );
}

// --- Prize orb --------------------------------------------------------------------------------

const BALL_MESH_SCALE = 0.92;
const BALL_RADIUS = 0.32 * BALL_MESH_SCALE;
const BALL_INNER_RADIUS = BALL_RADIUS * 0.76;
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

  useFrame((state, delta) => {
    if (!iconRef.current) return;
    const dt = clampFrameDelta(delta);
    iconRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.03;
    iconRef.current.rotation.y += 0.18 * dt;
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
      Array.from({ length: DEMO_BALLS.length }, () => randomBallSpawn()) as [
        number,
        number,
        number,
      ][],
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
      <OrbitControls
        makeDefault
        enableZoom={false}
        minDistance={orbitMinDistance}
      />

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
        <Vignette
          eskil={false}
          offset={POST.vignette.offset}
          darkness={POST.vignette.darkness}
        />
      </EffectComposer>
    </>
  );
}

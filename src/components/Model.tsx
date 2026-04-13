import { Center, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Physics, type RapierRigidBody } from "@react-three/rapier";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import { Box3, Group, MathUtils, PerspectiveCamera, Vector3 } from "three";

import piggieUrl from "../assets/Pig.gltf?url";
import { AnimationState, type AnimationState as AnimState } from "../type";
import {
  advanceShakePhase,
  animatingRotationSpeed,
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

import {
  CylinderCollider,
  MeshCollider,
  RigidBody,
  useAfterPhysicsStep,
} from "@react-three/rapier";
import { forwardRef } from "react";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";

useGLTF.preload(piggieUrl);

const COIN_THICKNESS = 0.092;
const COIN_HALF_H = COIN_THICKNESS / 2;
/** Cylinder radius in CoinPhysics — keep clamp margins in sync. */
const COIN_RADIUS = 0.32;

/** How many coins to simulate and render (single mesh each). */
export const COIN_COUNT = 10;

/** Small offsets from the floor anchor so coins are not all spawned in the same hull. */
function coinSpawnOffset(index: number): [number, number, number] {
  const y = index * 0.055;
  const wobble = index * 1.15;
  const r = 0.09;
  return [Math.cos(wobble) * r, y, Math.sin(wobble) * r];
}

/**
 * Uniform scale for the physics mesh only (< 1 pulls the shell inward vs the visible pig).
 * Triangles have no real thickness; this tightens the cavity so the coin hits colliders sooner.
 */
const PIG_COLLIDER_INSET = 0.935;

/**
 * Extra trimesh shells at slightly smaller scales — stacked “onion” boundaries so fast shakes
 * / CCD are less likely to let the coin slip through a single thin surface.
 */
/** Single shell + belly `CylinderCollider` keeps cost down; add offsets if coins tunnel. */
const PIG_COLLIDER_SHELL_OFFSETS = [0] as const;

/**
 * Extra Y on the belly floor cylinder center (pig / rigid-body **local** space). Positive moves it **up**.
 * Base Y is computed from mesh bounds: `shrunk.min.y + halfH + 0.014`.
 */
const BELLY_FLOOR_Y_OFFSET = -0.35;

/** Off-world until we snap to floor anchors (avoids overlap / solver explosions at origin). */
const COIN_SPAWN_HIDDEN: [number, number, number] = [0, -400, 0];

/** Scale pig shake — lower = calmer pig motion vs coin chaos (visual coupling). */
const SHAKE_ESCAPE_MUL = 0.44;

/** Per physics substep: blend coin ωy toward pig yaw rate so coins visually co-rotate with the bank. */
const COIN_YAW_SPIN_TRACK = 2;

/**
 * Rapier draws collider outlines (cage + coin hull). Turn off for a clean capture.
 * @see https://pmndrs.github.io/react-three-rapier/modules/Physics.html
 */
const SHOW_PHYSICS_DEBUG = false;

/** `true` = green wireframe cylinder matching the belly `CylinderCollider` only (not the Rapier debug). */
const DEBUG_BELLY_FLOOR_VISUAL = false;

type InteriorBounds = { min: Vector3; max: Vector3 };

/**
 * Mesh AABB min.y includes feet/toes; the visible belly floor is higher. We lift + shrink so the
 * clamp box sits in the cavity (reduces coins poking through the glass under the belly).
 */
function shrinkInteriorAabb(box: Box3): InteriorBounds {
  const c = box.getCenter(new Vector3());
  const min = box.min.clone();
  const max = box.max.clone();
  const fXZ = 0.15;
  min.x += (c.x - min.x) * fXZ;
  max.x -= (max.x - c.x) * fXZ;
  min.z += (c.z - min.z) * fXZ;
  max.z -= (max.z - c.z) * fXZ;
  min.y += (c.y - min.y) * 0.2;
  max.y -= (max.y - c.y) * 0.36;
  /** World-space: nudge floor up past feet geometry so “bottom” matches belly interior. */
  const BELLY_FLOOR_LIFT = 0.09;
  min.y += BELLY_FLOOR_LIFT;
  return { min, max };
}

type CoinInteriorClampProps = {
  pigGroupRef: RefObject<Group | null>;
  coinsRef: MutableRefObject<(RapierRigidBody | null)[]>;
  boundsRef: MutableRefObject<InteriorBounds | null>;
  pigYawRateRef: MutableRefObject<number>;
};

function clampOneCoinInsideBounds(
  coin: RapierRigidBody,
  pig: Group,
  bounds: InteriorBounds,
  local: Vector3,
  world: Vector3,
) {
  const t = coin.translation();
  local.set(t.x, t.y, t.z);
  pig.worldToLocal(local);

  const { min, max } = bounds;
  const padX = COIN_RADIUS + 0.038;
  const padZ = COIN_RADIUS + 0.038;
  const padY = COIN_HALF_H + 0.052;

  let { x, y, z } = local;
  let changed = false;

  const minX = min.x + padX;
  const maxX = max.x - padX;
  const minZ = min.z + padZ;
  const maxZ = max.z - padZ;
  const minY = min.y + padY;
  const maxY = max.y - padY;

  if (minX > maxX || minY > maxY || minZ > maxZ) return;

  if (x < minX) {
    x = minX;
    changed = true;
  } else if (x > maxX) {
    x = maxX;
    changed = true;
  }
  if (z < minZ) {
    z = minZ;
    changed = true;
  } else if (z > maxZ) {
    z = maxZ;
    changed = true;
  }
  if (y < minY) {
    y = minY;
    changed = true;
  } else if (y > maxY) {
    y = maxY;
    changed = true;
  }

  if (!changed) return;

  local.set(x, y, z);
  world.copy(local);
  pig.localToWorld(world);

  coin.setTranslation({ x: world.x, y: world.y, z: world.z }, true);

  const v = coin.linvel();
  coin.setLinvel({ x: v.x * 0.42, y: v.y * 0.42, z: v.z * 0.42 }, true);
  const av = coin.angvel();
  coin.setAngvel({ x: av.x * 0.58, y: av.y * 0.58, z: av.z * 0.58 }, true);
}

/**
 * Trimesh + kinematic shaking can still tunnel; after Rapier steps, clamp the coin center inside a
 * pig-local interior box derived from the same collision shell so containment matches the pig shape.
 */
function CoinInteriorClamp({
  pigGroupRef,
  coinsRef,
  boundsRef,
  pigYawRateRef,
}: CoinInteriorClampProps) {
  const local = useRef(new Vector3());
  const world = useRef(new Vector3());

  useAfterPhysicsStep(() => {
    const pig = pigGroupRef.current;
    const bounds = boundsRef.current;
    if (!pig || !bounds) return;

    const targetWy = pigYawRateRef.current;
    const t = COIN_YAW_SPIN_TRACK;

    for (let i = 0; i < COIN_COUNT; i++) {
      const coin = coinsRef.current[i];
      if (!coin) continue;
      clampOneCoinInsideBounds(coin, pig, bounds, local.current, world.current);
      const wav = coin.angvel();
      coin.setAngvel(
        {
          x: wav.x,
          y: wav.y + t * (targetWy - wav.y),
          z: wav.z,
        },
        true,
      );
    }
  });

  return null;
}

export type ModelProps = {
  animationState: AnimState;
  setAnimationState: (state: AnimState) => void;
};

export function Model({ animationState, setAnimationState }: ModelProps) {
  const pigBody = useRef<RapierRigidBody | null>(null);
  const pigGroup = useRef<Group>(null);
  const pigInteriorBounds = useRef<InteriorBounds | null>(null);
  const coinFloorAnchorRefs = useRef<(Group | null)[]>([]);
  const coinBodies = useRef<(RapierRigidBody | null)[]>([]);
  const coinSnapDone = useRef(false);
  const tmpVec = useRef(new Vector3());
  const tmpShake = useRef({ x: 0, y: 0, z: 0 });
  /** Idle FOV captured once; zoom divides by boost so higher boost = narrower FOV = closer feel. */
  const idleFovRef = useRef<number | null>(null);
  const zoomBoostRef = useRef(1);
  /** Seconds since entering RESULTS — drives one-shot zoom bang on top of `SCALE_MAX`. */
  const resultsBangElapsed = useRef(0);

  const rotationY = useRef(0);
  const shakePhase = useRef(0);
  const pigBaseTranslation = useRef<{ x: number; y: number; z: number } | null>(
    null,
  );

  const animT = useRef(0);
  const completeSpeed = useRef(IDLE_ROT_SPEED);
  const prevState = useRef<AnimState>(AnimationState.IDLE);
  const animFinishSent = useRef(false);
  /** World Y rad/s — pig spins around Y; coins blend ωy toward this in `CoinInteriorClamp`. */
  const pigYawRateRef = useRef(0);

  useEffect(() => {
    if (animationState === AnimationState.ANIMATING) {
      animT.current = 0;
      animFinishSent.current = false;
      completeSpeed.current = IDLE_ROT_SPEED;
      zoomBoostRef.current = 1;
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

      rotSpeed = animatingRotationSpeed(t);
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

    pigYawRateRef.current = rotSpeed;

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

    /** Base zoom from state; in RESULTS, multiply by bang pulse (extra FOV punch). */
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

    if (pigBody.current) {
      if (!pigBaseTranslation.current) {
        const tr = pigBody.current.translation();
        pigBaseTranslation.current = { x: tr.x, y: tr.y, z: tr.z };
      }
      const b = pigBaseTranslation.current;

      rotationY.current += delta * rotSpeed;

      pigBody.current.setNextKinematicTranslation({
        x: b.x + s.x,
        y: b.y + s.y,
        z: b.z + s.z,
      });

      pigBody.current.setNextKinematicRotation({
        x: 0,
        y: Math.sin(rotationY.current / 2),
        z: 0,
        w: Math.cos(rotationY.current / 2),
      });
    }

    if (!coinSnapDone.current) {
      let allReady = true;
      for (let i = 0; i < COIN_COUNT; i++) {
        if (!coinFloorAnchorRefs.current[i] || !coinBodies.current[i]) {
          allReady = false;
          break;
        }
      }
      if (allReady) {
        for (let i = 0; i < COIN_COUNT; i++) {
          const anchor = coinFloorAnchorRefs.current[i]!;
          const body = coinBodies.current[i]!;
          anchor.getWorldPosition(tmpVec.current);
          body.setTranslation(
            {
              x: tmpVec.current.x,
              y: tmpVec.current.y,
              z: tmpVec.current.z,
            },
            true,
          );
          body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
        coinSnapDone.current = true;
      }
    }
  });

  return (
    <>
      <Environment preset="warehouse" environmentIntensity={0.45} blur={4} />
      <OrbitControls makeDefault enableZoom={false} minDistance={12} />

      <Physics
        debug={SHOW_PHYSICS_DEBUG}
        gravity={[0, -9.81, 0]}
        timeStep="vary"
        numSolverIterations={7}
        numInternalPgsIterations={2}
        maxCcdSubsteps={4}
        predictionDistance={0.016}
      >
        <PiggyBank
          ref={pigBody}
          pigGroup={pigGroup}
          coinFloorAnchorRefs={coinFloorAnchorRefs}
          interiorBoundsRef={pigInteriorBounds}
        />
        {Array.from({ length: COIN_COUNT }, (_, i) => (
          <CoinPhysics
            key={i}
            ref={(node) => {
              coinBodies.current[i] = node;
            }}
          />
        ))}
        <CoinInteriorClamp
          pigGroupRef={pigGroup}
          coinsRef={coinBodies}
          boundsRef={pigInteriorBounds}
          pigYawRateRef={pigYawRateRef}
        />
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
    </>
  );
}

export const CoinPhysics = forwardRef<RapierRigidBody>(
  function CoinPhysics(_, ref) {
    return (
      <RigidBody
        ref={ref}
        type="dynamic"
        colliders="hull"
        ccd={true}
        position={COIN_SPAWN_HIDDEN}
        canSleep
        linearDamping={0.91}
        angularDamping={0.97}
        restitution={0.012}
        friction={0.97}
        mass={1.55}
      >
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.092, 14]} />
          <meshStandardMaterial
            color="#f5c542"
            metalness={0.88}
            roughness={0.18}
            envMapIntensity={1.2}
          />
        </mesh>
        <mesh position={[0, 0.048, 0]}>
          <cylinderGeometry args={[0.26, 0.26, 0.005, 8]} />
          <meshStandardMaterial
            color="#e6b800"
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      </RigidBody>
    );
  },
);

type PiggyBankProps = {
  pigGroup: RefObject<Group | null>;
  coinFloorAnchorRefs: MutableRefObject<(Group | null)[]>;
  interiorBoundsRef: MutableRefObject<InteriorBounds | null>;
};

export const PiggyBank = forwardRef<RapierRigidBody, PiggyBankProps>(
  ({ pigGroup, coinFloorAnchorRefs, interiorBoundsRef }, ref) => {
    const { scene } = useGLTF(piggieUrl);

    const collisionScenes = useMemo(() => {
      return PIG_COLLIDER_SHELL_OFFSETS.map(() => {
        const c = scene.clone(true);
        c.traverse((child) => {
          if ("isMesh" in child && child.isMesh) {
            child.visible = false;
            child.castShadow = false;
            child.receiveShadow = false;
          }
        });
        return c;
      });
    }, [scene]);

    const [coinAnchorLocal, setCoinAnchorLocal] = useState<
      [number, number, number] | null
    >(null);

    /** Extra convex floor — trimesh is thin; this blocks coins under the belly. */
    const [bellyFloorCollider, setBellyFloorCollider] = useState<{
      args: [number, number];
      position: [number, number, number];
    } | null>(null);

    useLayoutEffect(() => {
      scene.traverse((child) => {
        if ("isMesh" in child && child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }, [scene]);

    /** Resting coin position in `pigGroup` space — bottom-center of mesh bounds. */
    useLayoutEffect(() => {
      let tries = 0;
      const measure = () => {
        scene.updateMatrixWorld(true);
        const parent = scene.parent;
        if (!parent && tries++ < 30) {
          requestAnimationFrame(measure);
          return;
        }
        if (!parent) return;
        parent.updateMatrixWorld(true);
        const box = new Box3().setFromObject(scene);
        if (box.isEmpty()) return;
        const worldRest = new Vector3(
          (box.min.x + box.max.x) * 0.5,
          box.min.y + COIN_HALF_H + 0.06,
          (box.min.z + box.max.z) * 0.5,
        );
        parent.worldToLocal(worldRest);
        const next: [number, number, number] = [
          worldRest.x,
          worldRest.y,
          worldRest.z,
        ];
        requestAnimationFrame(() => {
          setCoinAnchorLocal(next);
        });
      };
      measure();
    }, [scene]);

    /** Pig-local interior used to clamp the coin (tightest collision shell = safest box). */
    useLayoutEffect(() => {
      const root = collisionScenes[0];
      if (!root) return;
      const measureRoot = new Group();
      const innerScale =
        PIG_COLLIDER_INSET -
        PIG_COLLIDER_SHELL_OFFSETS[PIG_COLLIDER_SHELL_OFFSETS.length - 1]!;
      measureRoot.scale.setScalar(innerScale);
      measureRoot.add(root.clone(true));
      measureRoot.updateMatrixWorld(true);
      const box = new Box3().setFromObject(measureRoot);
      if (box.isEmpty()) return;
      const shrunk = shrinkInteriorAabb(box);
      interiorBoundsRef.current = shrunk;
      const cx = (shrunk.min.x + shrunk.max.x) * 0.5;
      const cz = (shrunk.min.z + shrunk.max.z) * 0.5;
      const spanX = shrunk.max.x - shrunk.min.x;
      const spanZ = shrunk.max.z - shrunk.min.z;
      const floorR = Math.max(0.14, Math.min(spanX, spanZ) * 0.34);
      const halfH = 0.042;
      const floorY = shrunk.min.y + halfH + 0.014 + BELLY_FLOOR_Y_OFFSET;
      setBellyFloorCollider({
        args: [halfH, floorR],
        position: [cx, floorY, cz],
      });
    }, [collisionScenes, interiorBoundsRef]);

    return (
      <Center>
        {/* Inset trimesh (invisible clone) = tighter cavity. `includeInvisible`: MeshCollider uses traverseVisible by default — hidden meshes would generate zero colliders. */}
        <RigidBody
          ref={ref}
          type="kinematicPosition"
          colliders={false}
          includeInvisible
        >
          <group ref={pigGroup}>
            {coinAnchorLocal
              ? Array.from({ length: COIN_COUNT }, (_, i) => {
                  const [ox, oy, oz] = coinSpawnOffset(i);
                  return (
                    <group
                      key={i}
                      ref={(node) => {
                        coinFloorAnchorRefs.current[i] = node;
                      }}
                      position={[
                        coinAnchorLocal[0] + ox,
                        coinAnchorLocal[1] + oy,
                        coinAnchorLocal[2] + oz,
                      ]}
                    />
                  );
                })
              : null}
            {PIG_COLLIDER_SHELL_OFFSETS.map((offset, i) => (
              <MeshCollider key={i} type="trimesh">
                <group scale={PIG_COLLIDER_INSET - offset}>
                  <primitive object={collisionScenes[i]!} />
                </group>
              </MeshCollider>
            ))}
            {bellyFloorCollider ? (
              <>
                {/*
                  Debug options:
                  1) Set SHOW_PHYSICS_DEBUG = true on <Physics> — Rapier draws all colliders (pig trimesh + coins + this cylinder).
                  2) Set DEBUG_BELLY_FLOOR_VISUAL = true — wireframe for this cylinder only (args: [halfHeight, radius]).
                */}
                <CylinderCollider
                  args={bellyFloorCollider.args}
                  position={bellyFloorCollider.position}
                  friction={0.98}
                  restitution={0.01}
                />
                {DEBUG_BELLY_FLOOR_VISUAL ? (
                  <mesh
                    position={bellyFloorCollider.position}
                    userData={{ debugBellyFloor: true }}
                  >
                    <cylinderGeometry
                      args={[
                        bellyFloorCollider.args[1],
                        bellyFloorCollider.args[1],
                        bellyFloorCollider.args[0] * 2,
                        28,
                        1,
                      ]}
                    />
                    <meshBasicMaterial
                      color="#22e88a"
                      wireframe
                      transparent
                      opacity={0.85}
                    />
                  </mesh>
                ) : null}
              </>
            ) : null}
            {/* Same scale as outer shell (offset 0) so debug wireframe matches the glass mesh. */}
            <group scale={PIG_COLLIDER_INSET}>
              <primitive object={scene} />
            </group>
          </group>
        </RigidBody>
      </Center>
    );
  },
);

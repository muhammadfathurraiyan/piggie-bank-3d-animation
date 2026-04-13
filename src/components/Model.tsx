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
import { Box3, Group, MathUtils, Vector3 } from "three";

import piggieUrl from "../assets/Pig.gltf?url";
import {
  advanceShakePhase,
  animatingRotationSpeed,
  IDLE_ROT_SPEED,
  isCelebrationSettling,
  ROT_MAX,
  SETTLE_DAMP,
  shakeAmountAnimating,
  // shakeOffset,
  TIMELINE
} from "../pigAnimation";
import { AnimationState, type AnimationState as AnimState } from "../type";

import {
  MeshCollider,
  RigidBody,
  useAfterPhysicsStep,
} from "@react-three/rapier";
import { forwardRef } from "react";

useGLTF.preload(piggieUrl);

const COIN_THICKNESS = 0.065;
const COIN_HALF_H = COIN_THICKNESS / 2;
/** Cylinder radius in CoinPhysics — keep clamp margins in sync. */
const COIN_RADIUS = 0.22;

/**
 * Uniform scale for the physics mesh only (< 1 pulls the shell inward vs the visible pig).
 * Triangles have no real thickness; this tightens the cavity so the coin hits colliders sooner.
 */
const PIG_COLLIDER_INSET = 0.935;

/**
 * Extra trimesh shells at slightly smaller scales — stacked “onion” boundaries so fast shakes
 * / CCD are less likely to let the coin slip through a single thin surface.
 */
// const PIG_COLLIDER_SHELL_OFFSETS = [0, 0.007, 0.014] as const;
const PIG_COLLIDER_SHELL_OFFSETS = [0] as const;

/** Off-world until we snap to `coinFloorAnchor` (avoids overlap / solver explosions at origin). */
const COIN_SPAWN_HIDDEN: [number, number, number] = [0, -400, 0];

/** Scale shake so the kinematic pig is less likely to eject the coin. */
// const SHAKE_ESCAPE_MUL = 0.58;

/**
 * Rapier draws collider outlines (cage + coin hull). Turn off for a clean capture.
 * @see https://pmndrs.github.io/react-three-rapier/modules/Physics.html
 */
const SHOW_PHYSICS_DEBUG = false;

type InteriorBounds = { min: Vector3; max: Vector3 };

/**
 * Mesh AABB is looser than the belly; shrink toward center so the clamp region sits inside the cavity,
 * with a stronger pull on +Y to stay below the coin slot / opening.
 */
function shrinkInteriorAabb(box: Box3): InteriorBounds {
  const c = box.getCenter(new Vector3());
  const min = box.min.clone();
  const max = box.max.clone();
  const fXZ = 0.14;
  min.x += (c.x - min.x) * fXZ;
  max.x -= (max.x - c.x) * fXZ;
  min.z += (c.z - min.z) * fXZ;
  max.z -= (max.z - c.z) * fXZ;
  min.y += (c.y - min.y) * 0.06;
  max.y -= (max.y - c.y) * 0.36;
  return { min, max };
}

type CoinInteriorClampProps = {
  pigGroupRef: RefObject<Group | null>;
  coinRef: RefObject<RapierRigidBody | null>;
  boundsRef: MutableRefObject<InteriorBounds | null>;
};

/**
 * Trimesh + kinematic shaking can still tunnel; after Rapier steps, clamp the coin center inside a
 * pig-local interior box derived from the same collision shell so containment matches the pig shape.
 */
function CoinInteriorClamp({
  pigGroupRef,
  coinRef,
  boundsRef,
}: CoinInteriorClampProps) {
  const local = useRef(new Vector3());
  const world = useRef(new Vector3());

  useAfterPhysicsStep(() => {
    const pig = pigGroupRef.current;
    const coin = coinRef.current;
    const bounds = boundsRef.current;
    if (!pig || !coin || !bounds) return;

    const t = coin.translation();
    local.current.set(t.x, t.y, t.z);
    pig.worldToLocal(local.current);

    const { min, max } = bounds;
    const padX = COIN_RADIUS + 0.02;
    const padZ = COIN_RADIUS + 0.02;
    const padY = COIN_HALF_H + 0.025;

    let { x, y, z } = local.current;
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

    local.current.set(x, y, z);
    world.current.copy(local.current);
    pig.localToWorld(world.current);

    coin.setTranslation(
      { x: world.current.x, y: world.current.y, z: world.current.z },
      true,
    );

    const v = coin.linvel();
    coin.setLinvel({ x: v.x * 0.25, y: v.y * 0.25, z: v.z * 0.25 }, true);
    const av = coin.angvel();
    coin.setAngvel({ x: av.x * 0.45, y: av.y * 0.45, z: av.z * 0.45 }, true);
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
  const coinFloorAnchor = useRef<Group>(null);
  const coinBody = useRef<RapierRigidBody | null>(null);
  const coinSnapDone = useRef(false);
  const tmpVec = useRef(new Vector3());

  const rotationY = useRef(0);
  const shakePhase = useRef(0);
  const pigBaseTranslation = useRef<{ x: number; y: number; z: number } | null>(
    null,
  );

  const animT = useRef(0);
  const completeSpeed = useRef(IDLE_ROT_SPEED);
  const prevState = useRef<AnimState>(AnimationState.IDLE);
  const animFinishSent = useRef(false);

  useEffect(() => {
    if (animationState === AnimationState.ANIMATING) {
      animT.current = 0;
      animFinishSent.current = false;
      completeSpeed.current = IDLE_ROT_SPEED;
    }

    if (
      animationState === AnimationState.RESULTS &&
      prevState.current === AnimationState.ANIMATING
    ) {
      completeSpeed.current = ROT_MAX;
    }

    prevState.current = animationState;
  }, [animationState]);

  useFrame((_, delta) => {
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
      // shakeAmount = shakeAmountResults(SCALE_MAX, completeSpeed.current);
      shakeAmount = 0;
    }

    // const s = shakeOffset(shakePhase.current, shakeAmount * SHAKE_ESCAPE_MUL);
    const s = { x: 0, y: shakeAmount, z: 0 };

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

    if (!coinSnapDone.current && coinBody.current && coinFloorAnchor.current) {
      coinFloorAnchor.current.getWorldPosition(tmpVec.current);
      coinBody.current.setTranslation(
        {
          x: tmpVec.current.x,
          y: tmpVec.current.y,
          z: tmpVec.current.z,
        },
        true,
      );
      coinBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      coinBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      coinSnapDone.current = true;
    }
  });

  return (
    <>
      <Environment preset="warehouse" environmentIntensity={0.45} blur={20} />
      <OrbitControls makeDefault enableZoom={false} minDistance={12} />

      <Physics
        debug={SHOW_PHYSICS_DEBUG}
        gravity={[0, -9.81, 0]}
        timeStep="vary"
        numSolverIterations={12}
        numInternalPgsIterations={3}
        maxCcdSubsteps={8}
        predictionDistance={0.022}
      >
        <PiggyBank
          ref={pigBody}
          pigGroup={pigGroup}
          coinFloorAnchorRef={coinFloorAnchor}
          interiorBoundsRef={pigInteriorBounds}
        />
        <CoinPhysics ref={coinBody} />
        <CoinInteriorClamp
          pigGroupRef={pigGroup}
          coinRef={coinBody}
          boundsRef={pigInteriorBounds}
        />
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
        canSleep={false}
        linearDamping={0.82}
        angularDamping={0.92}
        restitution={0.04}
        friction={0.92}
        mass={1}
      >
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.065, 28]} />
          <meshStandardMaterial
            color="#f5c542"
            metalness={0.88}
            roughness={0.18}
            envMapIntensity={1.2}
          />
        </mesh>
        <mesh position={[0, 0.034, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.004, 24]} />
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
  coinFloorAnchorRef: RefObject<Group | null>;
  interiorBoundsRef: MutableRefObject<InteriorBounds | null>;
};

export const PiggyBank = forwardRef<RapierRigidBody, PiggyBankProps>(
  ({ pigGroup, coinFloorAnchorRef, interiorBoundsRef }, ref) => {
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
      interiorBoundsRef.current = shrinkInteriorAabb(box);
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
            {coinAnchorLocal ? (
              <group ref={coinFloorAnchorRef} position={coinAnchorLocal} />
            ) : null}
            {PIG_COLLIDER_SHELL_OFFSETS.map((offset, i) => (
              <MeshCollider key={i} type="trimesh">
                <group scale={PIG_COLLIDER_INSET - offset}>
                  <primitive object={collisionScenes[i]!} />
                </group>
              </MeshCollider>
            ))}
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

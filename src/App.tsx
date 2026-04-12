import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";

import { Loader } from "./components/Loader";
import { ResultsOverlay } from "./components/ResultsOverlay";
import { useCanvasHiddenAfterResults } from "./hooks/useCanvasHiddenAfterResults";
import { AnimationState, type AnimationState as AnimState } from "./type";
import { AnimatePresence, motion } from "motion/react";
import { Model } from "./components/Model";

const CANVAS_HIDE_DELAY_MS = 320;

const heroVisible = (s: AnimState) => s === AnimationState.IDLE;

export default function App() {
  const [animationState, setAnimationState] = useState<AnimState>(
    AnimationState.IDLE,
  );

  const canvasHidden = useCanvasHiddenAfterResults(
    animationState,
    CANVAS_HIDE_DELAY_MS,
  );

  return (
    <>
      <div className="flex items-center relative flex-col gap-16 justify-center h-screen text-zinc-50 bg-linear-to-b from-zinc-900 to-zinc-950">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: heroVisible(animationState) ? 1 : 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
          className="relative z-10 space-y-2 text-center"
        >
          <div className="flex items-center justify-center gap-2 relative">
            <h1 className="text-6xl font-bold tracking-wide uppercase relative z-10">
              Piggie Bank
            </h1>
          </div>
          <p className="text-zinc-300">The best way to double your money</p>
        </motion.div>

        <div className="h-[300px]" />
        <Canvas
          className={
            canvasHidden
              ? "pointer-events-none z-0 touch-none invisible opacity-0 transition-opacity duration-150"
              : "pointer-events-none z-0 touch-none visible opacity-100 transition-opacity duration-150"
          }
          style={{ position: "absolute", inset: 0 }}
          dpr={[1, 1.5]}
          gl={{
            alpha: true,
            antialias: true,
            premultipliedAlpha: false,
            powerPreference: "high-performance",
            stencil: false,
          }}
          aria-hidden={canvasHidden}
        >
          <Suspense fallback={<Loader />}>
            <Model
              animationState={animationState}
              setAnimationState={setAnimationState}
            />
          </Suspense>
        </Canvas>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: heroVisible(animationState) ? 1 : 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
          type="button"
          className="relative z-10 cursor-pointer inline-flex items-center justify-center px-6 py-3 overflow-hidden font-medium uppercase text-white rounded-md shadow-2xl group"
          onClick={() => {
            if (animationState === AnimationState.IDLE) {
              setAnimationState(AnimationState.ANIMATING);
            }
          }}
        >
          <span className="absolute inset-0 w-full h-full transition duration-300 ease-out opacity-0 bg-linear-to-br from-pink-600 via-purple-700 to-blue-400 group-hover:opacity-100" />
          <span className="absolute top-0 left-0 w-full bg-linear-to-b from-white to-transparent opacity-5 h-1/3" />
          <span className="absolute bottom-0 left-0 w-full h-1/3 bg-linear-to-t from-white to-transparent opacity-5" />
          <span className="absolute bottom-0 left-0 w-4 h-full bg-linear-to-r from-white to-transparent opacity-5" />
          <span className="absolute bottom-0 right-0 w-4 h-full bg-linear-to-l from-white to-transparent opacity-5" />
          <span className="absolute inset-0 w-full h-full border border-white rounded-md opacity-10" />
          <span className="absolute w-0 h-0 transition-all duration-300 ease-out bg-white rounded-full group-hover:w-56 group-hover:h-56 opacity-5" />
          <span className="relative">Double or nothing</span>
        </motion.button>
      </div>

      <AnimatePresence>
        {animationState === AnimationState.RESULTS && (
          <ResultsOverlay
            key="results"
            onContinue={() => setAnimationState(AnimationState.IDLE)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

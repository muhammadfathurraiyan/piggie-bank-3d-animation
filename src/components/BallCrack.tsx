import { motion } from "motion/react";
import ball from "../assets/images/img-ball.png";
import ballCrack from "../assets/images/img-ball-crack.png";
import { useState } from "react";
import { AnimationState, type AnimationState as AnimState } from "../type";

type ResultsOverlayProps = {
  onContinue: () => void;
  animationState: AnimState;
  setAnimationState: (state: AnimState) => void;
};

const FLASH = {
  DURATION: 2.35,
  TIMES: [0, 0.01, 0.42, 1] as const,
} as const;

const BACKDROP = { DELAY_S: 1.15, DURATION_S: 0.75 } as const;
const CONTENT = { DELAY_S: 1.35, DURATION_S: 0.85 } as const;

const FLASH_SURFACE_STYLE = {
  boxShadow:
    "inset 0 0 80px rgba(255,255,255,1), 0 0 120px rgba(255,255,255,0.85), 0 0 240px rgba(255,255,255,0.45)",
} as const;

const FLASH_GRADIENT_STYLE = {
  background:
    "radial-gradient(ellipse 85% 65% at 50% 42%, #ffffff 0%, #fffef8 35%, #f4f4fa 72%, #dcdce8 100%)",
} as const;

const ANIMATION_CONFIG = {
  idle: {
    animate: {
      y: [6, -4, 0, 6, 0],
      scale: [0.92, 1.01, 1, 1.02, 1],
      rotate: [-3, 2, -2, 2, 0],
    },
    transition: {
      duration: 1.6,
      ease: "easeInOut" as const,
      times: [0, 0.2, 0.5, 0.8, 1],
      repeat: Infinity,
      repeatType: "reverse" as const,
    },
    image: ball,
  },
  opening: {
    animate: {
      scale: [1, 1.2, 1.4, 1.6, 1.8, 2, 3],
      rotate: [0, 2, -3, 5, -2, 3, 0],
      y: [0, -5, -10, -20, -15, -25, -10],
      opacity: [1, 0.9, 0.95, 0.8, 0.9, 0.85, 1],
    },
    transition: {
      duration: 3.2,
      ease: "easeInOut" as const,
      times: [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1],
    },
    image: ballCrack,
  },
};

export function BallCrack({
  onContinue,
  animationState,
  setAnimationState,
}: ResultsOverlayProps) {
  const [ballState, setBallState] = useState<"idle" | "opening" | "open">(
    "idle",
  );

  function handleBallClick() {
    if (animationState === AnimationState.BALL_ANIMATION) {
      setBallState("opening");
      setAnimationState(AnimationState.BALL_CRACK_ANIMATION);
      setTimeout(() => {
        setAnimationState(AnimationState.RESULTS);
      }, 2900);
      onContinue();
    }
  }

  const currentConfig =
    ANIMATION_CONFIG[ballState as keyof typeof ANIMATION_CONFIG];

  const isAnimationRunning = ballState === "opening" || ballState === "open";

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="results-heading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 p-6 pointer-events-auto"
    >
      <motion.div
        className="absolute inset-0 z-0 bg-zinc-950/90 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          delay: BACKDROP.DELAY_S,
          duration: BACKDROP.DURATION_S,
          ease: [0.22, 1, 0.36, 1],
        }}
      />

      <motion.div
        className="relative z-10 flex flex-col items-center space-y-8 text-center max-w-sm"
        initial={{ opacity: 0, scale: 0.88, y: 28, filter: "blur(10px)" }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
        transition={{
          delay: CONTENT.DELAY_S,
          duration: CONTENT.DURATION_S,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <p
          className={`font-light text-[#FFF2D3] text-lg transition-all duration-300 ${animationState !== AnimationState.BALL_ANIMATION ? "opacity-0" : "opacity-100"}`}
        >
          TAP TO CRACK THE BALL
        </p>
        <div className="relative mx-auto">
          <motion.button
            onClick={handleBallClick}
            type="button"
            animate={currentConfig.animate}
            transition={currentConfig.transition}
            disabled={isAnimationRunning}
            className="relative flex items-center justify-center size-fit mx-auto"
          >
            <img
              src={currentConfig.image}
              alt="Ball"
              className="size-[200px] object-cover relative z-10"
            />
          </motion.button>
        </div>
      </motion.div>

      <motion.div
        className="absolute inset-0 z-20 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{
          duration: FLASH.DURATION,
          times: [...FLASH.TIMES],
          ease: ["easeOut", "linear", "easeOut"],
        }}
      >
        <div
          className="absolute inset-0 bg-white"
          style={FLASH_SURFACE_STYLE}
        />
        <div
          className="absolute inset-0 opacity-95 mix-blend-screen"
          style={FLASH_GRADIENT_STYLE}
        />
      </motion.div>
    </motion.div>
  );
}

import { motion } from "motion/react";
import { SparkleIcon, USDCIcon } from "./icons";

type ResultsOverlayProps = {
  onContinue: () => void;
};

const FLASH = {
  DURATION: 2.35,
  TIMES: [0, 0.01, 0.42, 1] as const,
} as const;

const BACKDROP = { DELAY_S: 1.15, DURATION_S: 0.75 } as const;
const CONTENT = { DELAY_S: 1.35, DURATION_S: 0.85 } as const;
const CONTINUE_BTN = { DELAY_S: 1.85, DURATION_S: 0.5 } as const;

const FLASH_SURFACE_STYLE = {
  boxShadow:
    "inset 0 0 80px rgba(255,255,255,1), 0 0 120px rgba(255,255,255,0.85), 0 0 240px rgba(255,255,255,0.45)",
} as const;

const FLASH_GRADIENT_STYLE = {
  background:
    "radial-gradient(ellipse 85% 65% at 50% 42%, #ffffff 0%, #fffef8 35%, #f4f4fa 72%, #dcdce8 100%)",
} as const;

export function ResultsOverlay({ onContinue }: ResultsOverlayProps) {
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
        <h2 id="results-heading" className="sr-only">
          Result
        </h2>
        <div className="space-y-8">
          <div className="relative flex items-center justify-center size-fit mx-auto">
            <div className="absolute size-[120%] aspect-square left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFF2D3] blur-[12.5px]" />
            <USDCIcon />
            <SparkleIcon className="absolute top-0 left-0" />
            <SparkleIcon className="absolute bottom-0 right-0 z-20" />
          </div>

          <p className="font-light text-[#FFF2D3] text-lg">-10 USDC</p>
        </div>

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: CONTINUE_BTN.DELAY_S,
            duration: CONTINUE_BTN.DURATION_S,
            ease: "easeOut",
          }}
          className="mt-2 px-5 py-2.5 text-sm font-medium uppercase tracking-wide text-zinc-900 bg-[#FFF2D3] rounded-md shadow-lg hover:bg-[#ffe8b8] transition-colors"
          onClick={() => onContinue()}
        >
          Continue
        </motion.button>
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
        <div className="absolute inset-0 bg-white" style={FLASH_SURFACE_STYLE} />
        <div
          className="absolute inset-0 opacity-95 mix-blend-screen"
          style={FLASH_GRADIENT_STYLE}
        />
      </motion.div>
    </motion.div>
  );
}
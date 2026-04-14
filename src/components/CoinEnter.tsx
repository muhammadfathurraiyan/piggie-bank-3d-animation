import { SparkleIcon, USDCIcon } from "./icons";
import { motion } from "motion/react";

export function CoinEnter() {
  return (
    <motion.div
      initial={{ y: 240, scale: 1 }}
      animate={{ y: [300, -260, -260, -140], scale: [1, 1.2, 0.9, 0.5] }}
      transition={{
        delay: 1,
        type: "spring",
        stiffness: 200,
        damping: 18,
      }}
      className="space-y-8"
    >
      <div className="relative flex items-center justify-center size-fit mx-auto">
        <div className="absolute size-[120%] aspect-square left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFF2D3] blur-[12.5px]" />
        <USDCIcon />
        <SparkleIcon className="absolute top-0 left-0" />
        <SparkleIcon className="absolute bottom-0 right-0 z-20" />
      </div>

      <motion.p
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.35, delay: 1, ease: "easeOut" }}
        className="font-light text-[#FFF2D3] text-lg"
      >
        -10 USDC
      </motion.p>
    </motion.div>
  );
}

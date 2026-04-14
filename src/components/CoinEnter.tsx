import { SparkleIcon, USDCIcon } from "./icons";

export function BallCrack() {
  return (
    <div className="space-y-8">
      <div className="relative flex items-center justify-center size-fit mx-auto">
        <div className="absolute size-[120%] aspect-square left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFF2D3] blur-[12.5px]" />
        <USDCIcon />
        <SparkleIcon className="absolute top-0 left-0" />
        <SparkleIcon className="absolute bottom-0 right-0 z-20" />
      </div>

      <p className="font-light text-[#FFF2D3] text-lg">-10 USDC</p>
    </div>
  );
}

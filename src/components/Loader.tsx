import { Html, useProgress } from "@react-three/drei";

export function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <h1 className="text-white text-2xl font-bold text-nowrap">{progress} % loaded</h1>
    </Html>
  );
}

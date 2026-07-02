"use client";

import { Canvas } from "@react-three/fiber";

export default function ThreeStage() {
  return (
    <div
      data-testid="three-stage"
      className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-slate-300 bg-slate-950 shadow-sm"
    >
      <Canvas
        className="absolute inset-0 h-full w-full"
        style={{ width: "100%", height: "100%" }}
        camera={{ position: [0, 0, 5], fov: 48 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={["#0f172a"]} />
      </Canvas>
    </div>
  );
}

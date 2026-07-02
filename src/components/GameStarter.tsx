"use client";

import dynamic from "next/dynamic";

const ThreeStage = dynamic(() => import("./ThreeStage"), {
  ssr: false,
  loading: () => <StageFallback label="Loading 3D stage" />,
});

function StageFallback({ label }: { label: string }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-md border border-dashed border-slate-300 bg-slate-100 text-sm text-slate-500">
      {label}
    </div>
  );
}

export default function GameStarter() {
  return (
    <main className="min-h-screen bg-[#f6f1e8] text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-3 border-b border-slate-300 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
              Next + React Three Fiber + TailwindCSS
            </p>
            <h1 className="mt-2 text-4xl font-bold text-slate-950 sm:text-5xl">
              3D Game Starter
            </h1>
          </div>
          <span className="rounded-md bg-sky-100 px-3 py-2 text-sm font-semibold text-sky-800 shadow-sm">
            WebGL
          </span>
        </header>

        <section className="flex flex-1 flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Three Stage</h2>
            <span className="rounded-md bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-800">
              Canvas
            </span>
          </div>
          <ThreeStage />
        </section>
      </section>
    </main>
  );
}

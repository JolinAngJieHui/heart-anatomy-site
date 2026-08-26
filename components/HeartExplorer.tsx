"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { getHeartPart, HEART_PARTS, type HeartPartId } from "@/lib/heart-parts";

const HeartScene = dynamic(() => import("./HeartScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      Loading 3D heart…
    </div>
  ),
});

export default function HeartExplorer() {
  const [selectedId, setSelectedId] = useState<HeartPartId | null>(
    "left-ventricle",
  );
  const selected = getHeartPart(selectedId);

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <section className="relative min-h-[420px] flex-1 bg-[#0f1724]">
        <HeartScene selectedId={selectedId} onSelect={setSelectedId} />
        <p className="pointer-events-none absolute bottom-4 left-4 text-xs text-slate-400">
          Drag to rotate · Click a chamber or vessel · Click empty space to
          deselect
        </p>
      </section>

      <aside className="flex w-full flex-col gap-5 border-t border-slate-800 bg-slate-950 p-5 lg:w-[360px] lg:border-t-0 lg:border-l">
        <header>
          <p className="text-xs font-medium uppercase tracking-widest text-rose-400">
            Heart anatomy lab
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">
            Interactive 3D explorer
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Click a structure in the model or in the list. Selected parts glow
            so you can connect the 3D shape with the written fact.
          </p>
        </header>

        <ul className="grid grid-cols-2 gap-2">
          {HEART_PARTS.map((part) => {
            const isSelected = part.id === selectedId;
            return (
              <li key={part.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(part.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    isSelected
                      ? "border-rose-400 bg-rose-500/15 text-rose-100"
                      : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: part.color }}
                    aria-hidden
                  />
                  {part.shortName}
                </button>
              </li>
            );
          })}
        </ul>

        <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          {selected ? (
            <>
              <h2 className="text-lg font-semibold text-slate-50">
                {selected.name}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {selected.summary}
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Blood flow
              </p>
              <p className="mt-1 text-sm text-rose-200">{selected.bloodFlow}</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">
              Select a chamber or vessel to read what it does.
            </p>
          )}
        </article>
      </aside>
    </div>
  );
}

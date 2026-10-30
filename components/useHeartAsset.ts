"use client";
import { useEffect, useState } from "react";
import { modelConfigSchema } from "@/lib/model-config";
import { loadHeartAsset } from "@/lib/load-heart-asset";
import type { PreparedHeartModel } from "@/lib/imported-model";

type Asset = { kind: "loading" | "error"; model?: undefined } | { kind: "imported"; model: PreparedHeartModel };
export default function useHeartAsset() {
  const [asset, setAsset] = useState<Asset>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [download, setDownload] = useState({ bytes: 0, total: 0 });
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false, owned: PreparedHeartModel | undefined;
    const timeout = setTimeout(() => { controller.abort(); if (!disposed) setAsset({ kind: "error" }); }, 60_000);
    void (async () => {
      try {
        const response = await fetch("/models/heart-model.json", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw Error("Model configuration unavailable.");
        const text = await response.text();
        if (text.length > 65_536) throw Error("Model configuration too large.");
        const config = modelConfigSchema.parse(JSON.parse(text));
        if (!config.url) throw Error("No production heart model is configured.");
        if (!disposed) { setAsset({ kind: "loading" }); setDownload({ bytes: 0, total: 0 }); }
        owned = await loadHeartAsset(config, controller.signal, (bytes, total) => { if (!disposed) setDownload({ bytes, total }); });
        if (disposed) { owned.dispose(); owned = undefined; return; }
        if (owned.warnings.length) console.warn("Model tagging configuration:", owned.warnings);
        setAsset({ kind: "imported", model: owned });
      } catch (error) {
        if (!disposed) { console.warn("Heart model could not load:", error); setAsset({ kind: "error" }); }
      } finally { clearTimeout(timeout); }
    })();
    return () => { disposed = true; controller.abort(); clearTimeout(timeout); owned?.dispose(); };
  }, [attempt]);
  return { asset, download, retry: () => setAttempt(value => value + 1) };
}

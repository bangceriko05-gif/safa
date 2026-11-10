import { useEffect, useRef } from "react";
import cashDrawer from "@/assets/cash-drawer.mp3.asset.json";

/** Unlock during a gesture, but never play before confirmed full settlement. */
export function useCashDrawerSound() {
  const context = useRef<AudioContext | null>(null);
  const buffer = useRef<AudioBuffer | null>(null);
  useEffect(() => {
    let cancelled = false;
    try {
      const audio = new AudioContext();
      context.current = audio;
      fetch(cashDrawer.url).then(response => response.arrayBuffer())
        .then(bytes => audio.decodeAudioData(bytes)).then(decoded => {
          if (!cancelled) buffer.current = decoded;
        }).catch(() => {});
    } catch { /* Audio availability must not block payment. */ }
    const unlock = () => { void context.current?.resume().catch(() => {}); };
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    return () => {
      cancelled = true;
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      void context.current?.close().catch(() => {});
      context.current = null;
      buffer.current = null;
    };
  }, []);
  return () => {
    if (context.current?.state === "running" && buffer.current) {
      const source = context.current.createBufferSource();
      source.buffer = buffer.current;
      source.connect(context.current.destination);
      source.start();
    } else {
      void new Audio(cashDrawer.url).play().catch(() => {});
    }
  };
}
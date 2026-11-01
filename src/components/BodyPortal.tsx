import { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders full-screen overlays at document.body so they sit above the
 * sidebar instead of being trapped inside the main content stacking context.
 */
export default function BodyPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return <>{children}</>;
  return createPortal(children, document.body);
}

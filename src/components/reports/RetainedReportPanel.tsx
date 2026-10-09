import { ReactNode, useEffect, useState } from "react";

/** Mount on first selection, then preserve filters and loaded rows on return. */
export default function RetainedReportPanel({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active);
  useEffect(() => {
    if (active) setVisited(true);
  }, [active]);
  if (!active && !visited) return null;
  return <div hidden={!active}>{children}</div>;
}
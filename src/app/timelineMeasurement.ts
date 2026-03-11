export function attachTimelineMeasurement(container: Element, measure: () => void): () => void {
  const observer = new ResizeObserver(() => measure());
  observer.observe(container);
  if (typeof globalThis.addEventListener === "function") globalThis.addEventListener("resize", measure);

  return () => {
    observer.disconnect();
    if (typeof globalThis.removeEventListener === "function") globalThis.removeEventListener("resize", measure);
  };
}

export function scheduleTimelineMeasurement(measure: () => void): () => void {
  if (typeof globalThis.requestAnimationFrame !== "function") {
    measure();
    return () => {};
  }
  const rafId = globalThis.requestAnimationFrame(() => measure());
  return () => {
    if (typeof globalThis.cancelAnimationFrame === "function") globalThis.cancelAnimationFrame(rafId);
  };
}

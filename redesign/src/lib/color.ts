/** Resolve an OKLCH CSS color to linear 0..1 sRGB components for WebGL use */
export function oklchToRgb(css: string, fallback: [number, number, number]): [number, number, number] {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return fallback;
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    if (d[0] === 0 && d[1] === 0 && d[2] === 0) return fallback;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
  } catch {
    return fallback;
  }
}

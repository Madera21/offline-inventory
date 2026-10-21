export interface ImageFrame { zoom: number; x: number; y: number }
export const DEFAULT_IMAGE_FRAME: ImageFrame = { zoom: 1, x: 0, y: 0 };
export function normalizeImageFrame(frame?: Partial<ImageFrame> | null): ImageFrame {
  const clamp = (n: number | undefined, min: number, max: number, fallback: number) =>
    Number.isFinite(n) ? Math.min(max, Math.max(min, n!)) : fallback;
  return { zoom: clamp(frame?.zoom, 1, 4, 1), x: clamp(frame?.x, -1, 1, 0), y: clamp(frame?.y, -1, 1, 0) };
}
export function readImageFrame(value?: string | null): ImageFrame {
  try { return normalizeImageFrame(JSON.parse(value || '{}')); } catch { return DEFAULT_IMAGE_FRAME; }
}
export function imageFrameGeometry(width: number, height: number, size: number, frame: ImageFrame) {
  const scale = Math.min(size / width, size / height) * frame.zoom;
  const w = width * scale, h = height * scale;
  const maxX = Math.max(0, (w - size) / 2), maxY = Math.max(0, (h - size) / 2);
  return { width: w, height: h, left: (size - w) / 2 + frame.x * maxX, top: (size - h) / 2 + frame.y * maxY, maxX, maxY };
}

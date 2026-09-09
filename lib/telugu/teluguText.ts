"use client";

/**
 * jsPDF draws each character to a 1:1 glyph via a font's cmap — it has no
 * OpenType shaping engine. That's fine for Latin text, but Telugu (like other
 * Indic scripts) needs shaping: consonant conjuncts, vowel signs that visually
 * move before/around a consonant, etc. Drawing Telugu straight through jsPDF's
 * `doc.text()` would come out with the right glyphs in the wrong shapes/order.
 *
 * The browser's own Canvas 2D text renderer *does* do proper shaping (it goes
 * through the same text stack as normal web pages). So instead of asking
 * jsPDF to draw Telugu, we render each piece of Telugu text onto an offscreen
 * canvas with a loaded Telugu font, and drop the resulting PNG into the PDF
 * with `doc.addImage()`. Everything else (numbers, "Rs.", English words) can
 * still go through jsPDF's normal vector text.
 */

const FONT_FAMILY = "Noto Sans Telugu Invoice";
const MM_PER_PX = 25.4 / 96; // CSS px (96dpi) -> mm
const PT_TO_PX = 96 / 72; // jsPDF font sizes are in points
const RENDER_SCALE = 4; // supersample so text stays crisp when printed/zoomed

let fontsLoadedPromise: Promise<void> | null = null;

/** Loads the regular + bold Telugu webfonts once per session and registers them with the document. */
export function loadTeluguFonts(): Promise<void> {
  if (fontsLoadedPromise) return fontsLoadedPromise;
  fontsLoadedPromise = (async () => {
    if (typeof document === "undefined") return;
    const [regular, bold] = await Promise.all([
      new FontFace(FONT_FAMILY, `url(/fonts/NotoSansTelugu-Regular.ttf)`, { weight: "400" }).load(),
      new FontFace(FONT_FAMILY, `url(/fonts/NotoSansTelugu-Bold.ttf)`, { weight: "700" }).load(),
    ]);
    (document.fonts as FontFaceSet).add(regular);
    (document.fonts as FontFaceSet).add(bold);
  })();
  return fontsLoadedPromise;
}

export interface TeluguTextStyle {
  /** Font size in points, matching jsPDF's `setFontSize()` units. */
  sizePt: number;
  bold?: boolean;
  /** RGB 0-255, matching jsPDF's color tuples. */
  color?: [number, number, number];
}

export interface TeluguImage {
  dataUrl: string;
  /** Rendered size in mm, ready to hand to `doc.addImage(dataUrl, "PNG", x, y, widthMm, heightMm)`. */
  widthMm: number;
  heightMm: number;
  /** Distance from the image's top edge to the text baseline, in mm — for lining up with jsPDF's baseline-anchored `doc.text()` calls. */
  ascentMm: number;
}

function getContext(): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return ctx;
}

function fontString(style: TeluguTextStyle, scale: number): string {
  return `${style.bold ? "700" : "400"} ${style.sizePt * PT_TO_PX * scale}px "${FONT_FAMILY}"`;
}

/**
 * Renders a single line of Telugu (or mixed Telugu/English) text to a PNG data URL.
 * Call `loadTeluguFonts()` and await it before using this.
 */
export function teluguTextToImage(text: string, style: TeluguTextStyle): TeluguImage {
  const measureCtx = getContext();
  measureCtx.font = fontString(style, RENDER_SCALE);
  const metrics = measureCtx.measureText(text || " ");

  const ascentPx = (metrics.actualBoundingBoxAscent || style.sizePt * PT_TO_PX * RENDER_SCALE * 0.8) + 2;
  const descentPx = (metrics.actualBoundingBoxDescent || style.sizePt * PT_TO_PX * RENDER_SCALE * 0.25) + 2;
  const widthPx = Math.max(1, Math.ceil(metrics.width) + 4);
  const heightPx = Math.max(1, Math.ceil(ascentPx + descentPx));

  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.font = fontString(style, RENDER_SCALE);
  ctx.textBaseline = "alphabetic";
  const [r, g, b] = style.color || [0, 0, 0];
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillText(text || "", 2, ascentPx);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm: (widthPx / RENDER_SCALE) * MM_PER_PX,
    heightMm: (heightPx / RENDER_SCALE) * MM_PER_PX,
    ascentMm: (ascentPx / RENDER_SCALE) * MM_PER_PX,
  };
}

/** Measures text width in mm without rendering — used to right-align or wrap Telugu text. */
export function teluguTextWidthMm(text: string, style: TeluguTextStyle): number {
  const ctx = getContext();
  ctx.font = fontString(style, RENDER_SCALE);
  return (ctx.measureText(text).width / RENDER_SCALE) * MM_PER_PX;
}

/** Greedy word-wrap for Telugu (and mixed) text to fit within `maxWidthMm`, mirroring jsPDF's `splitTextToSize`. */
export function wrapTeluguText(text: string, maxWidthMm: number, style: TeluguTextStyle): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (teluguTextWidthMm(candidate, style) <= maxWidthMm) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

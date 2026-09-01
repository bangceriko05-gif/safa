/**
 * ESC/POS command builder for thermal printers (58mm / 80mm).
 * Produces raw bytes that can be sent over Bluetooth, USB, Serial or LAN.
 */

const ESC = 0x1b;
const GS = 0x1d;

export type Align = "left" | "center" | "right";

export class EscPosBuilder {
  private chunks: number[] = [];
  /** Character columns per line (32 for 58mm, 48 for 80mm) */
  public cols: number;

  constructor(cols = 32) {
    this.cols = cols;
    this.raw([ESC, 0x40]); // initialize
  }

  raw(bytes: number[]) {
    this.chunks.push(...bytes);
    return this;
  }

  /** Latin-1 safe encoding, strips characters the printer cannot render */
  text(value: string) {
    const clean = (value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/[–—]/g, "-");
    for (let i = 0; i < clean.length; i++) {
      const code = clean.charCodeAt(i);
      this.chunks.push(code > 255 ? 0x3f : code);
    }
    return this;
  }

  line(value = "") {
    return this.text(value).raw([0x0a]);
  }

  feed(n = 1) {
    return this.raw([ESC, 0x64, n]);
  }

  align(a: Align) {
    return this.raw([ESC, 0x61, a === "center" ? 1 : a === "right" ? 2 : 0]);
  }

  bold(on: boolean) {
    return this.raw([ESC, 0x45, on ? 1 : 0]);
  }

  underline(on: boolean) {
    return this.raw([ESC, 0x2d, on ? 1 : 0]);
  }

  /** width/height multiplier 1..4 */
  size(width = 1, height = 1) {
    const w = Math.max(1, Math.min(4, width)) - 1;
    const h = Math.max(1, Math.min(4, height)) - 1;
    return this.raw([GS, 0x21, (w << 4) | h]);
  }

  divider(char = "-") {
    return this.line(char.repeat(this.cols));
  }

  /** Left/right justified row (e.g. label + amount) */
  row(left: string, right: string) {
    const l = left ?? "";
    const r = right ?? "";
    const space = this.cols - l.length - r.length;
    if (space >= 1) return this.line(l + " ".repeat(space) + r);
    // wrap the left part when it does not fit
    const maxLeft = Math.max(1, this.cols - r.length - 1);
    const first = l.slice(0, maxLeft);
    const rest = l.slice(maxLeft);
    this.line(first + " ".repeat(Math.max(1, this.cols - first.length - r.length)) + r);
    if (rest) this.wrap(rest);
    return this;
  }

  /** Word-wrapped paragraph */
  wrap(value: string) {
    const words = (value || "").split(/\s+/).filter(Boolean);
    let current = "";
    for (const w of words) {
      if ((current + (current ? " " : "") + w).length > this.cols) {
        if (current) this.line(current);
        current = w.length > this.cols ? w.slice(0, this.cols) : w;
      } else {
        current += (current ? " " : "") + w;
      }
    }
    if (current) this.line(current);
    return this;
  }

  qr(data: string, size = 6) {
    const bytes = Array.from(new TextEncoder().encode(data));
    const len = bytes.length + 3;
    this.raw([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]); // model 2
    this.raw([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size]); // module size
    this.raw([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]); // error correction L
    this.raw([GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30, ...bytes]);
    this.raw([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]); // print
    return this;
  }

  openDrawer() {
    return this.raw([ESC, 0x70, 0x00, 0x19, 0xfa]);
  }

  cut(partial = true) {
    this.feed(4);
    return this.raw([GS, 0x56, partial ? 0x01 : 0x00]);
  }

  build(): Uint8Array {
    return new Uint8Array(this.chunks);
  }
}

/** Column count from paper width in mm */
export function colsForPaper(paper: string | number): number {
  const mm = typeof paper === "number" ? paper : parseInt(String(paper).replace(/[^0-9]/g, ""), 10) || 58;
  if (mm <= 52) return 28;
  if (mm <= 58) return 32;
  if (mm <= 76) return 42;
  return 48;
}

export function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(value || 0));
}

// CORE-04: the drawing surface every module draws through, and the one rule each drawing keeps.
//
// DrawContext is the part of a canvas's 2D context the core's drawing uses, so a browser's context and the recorder
// (recorder.ts) both stand in for it and a module can be tested without a page. Its styles take what a browser's take,
// so a real context is a DrawContext as it is.
//
// isolated() is how the composer runs each drawing: whatever drew before, the drawing starts from full opacity, the
// ordinary composite and a solid line, and whatever it changes, the transform, a clip and every style, is undone when
// it ends, even when it throws. v3 kept neither: its overlays inherited the opacity and dash of what drew before them
// (INTAKE.31), and a frame that threw before its restore left the next frame drawing through the wrong matrix (DEF-36).
// A throw still reaches the caller once the state is restored; the composer turns it into a report (the plan's §8).
// The path, which a canvas does not save, is emptied before and after each drawing (Codex's review of stage 1).

export type Style = string | CanvasGradient | CanvasPattern;

export interface DrawContext {
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void;
  rect(x: number, y: number, w: number, h: number): void;
  fill(): void;
  stroke(): void;
  clip(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
  measureText(text: string): { readonly width: number };
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  resetTransform(): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  setLineDash(segments: number[]): void;
  getLineDash(): number[];
  globalAlpha: number;
  globalCompositeOperation: GlobalCompositeOperation;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  strokeStyle: Style;
  fillStyle: Style;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  lineDashOffset: number;
}

/**
 * The surface a drawing is handed: it draws onto the caller's, and counts the drawing's own saves, so a drawing can
 * neither restore past the state isolated() saved for it nor leave a save of its own open when it throws.
 */
class Guarded implements DrawContext {
  readonly #target: DrawContext;
  #saves = 0;

  constructor(target: DrawContext) {
    this.#target = target;
  }

  /** Close every save the drawing left open, innermost first. */
  unwind(): void {
    while (this.#saves > 0) this.restore();
  }

  save(): void {
    this.#target.save();
    this.#saves += 1;
  }

  restore(): void {
    if (this.#saves === 0) return;
    this.#saves -= 1;
    this.#target.restore();
  }

  beginPath(): void { this.#target.beginPath(); }
  closePath(): void { this.#target.closePath(); }
  moveTo(x: number, y: number): void { this.#target.moveTo(x, y); }
  lineTo(x: number, y: number): void { this.#target.lineTo(x, y); }
  bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number): void {
    this.#target.bezierCurveTo(a, b, c, d, x, y);
  }
  quadraticCurveTo(a: number, b: number, x: number, y: number): void { this.#target.quadraticCurveTo(a, b, x, y); }
  arc(x: number, y: number, r: number, start: number, end: number, anticlockwise?: boolean): void {
    this.#target.arc(x, y, r, start, end, anticlockwise);
  }
  ellipse(x: number, y: number, rx: number, ry: number, turn: number, start: number, end: number, anticlockwise?: boolean): void {
    this.#target.ellipse(x, y, rx, ry, turn, start, end, anticlockwise);
  }
  rect(x: number, y: number, w: number, h: number): void { this.#target.rect(x, y, w, h); }
  fill(): void { this.#target.fill(); }
  stroke(): void { this.#target.stroke(); }
  clip(): void { this.#target.clip(); }
  fillRect(x: number, y: number, w: number, h: number): void { this.#target.fillRect(x, y, w, h); }
  strokeRect(x: number, y: number, w: number, h: number): void { this.#target.strokeRect(x, y, w, h); }
  clearRect(x: number, y: number, w: number, h: number): void { this.#target.clearRect(x, y, w, h); }
  fillText(text: string, x: number, y: number): void { this.#target.fillText(text, x, y); }
  strokeText(text: string, x: number, y: number): void { this.#target.strokeText(text, x, y); }
  measureText(text: string): { readonly width: number } { return this.#target.measureText(text); }
  translate(x: number, y: number): void { this.#target.translate(x, y); }
  rotate(angle: number): void { this.#target.rotate(angle); }
  scale(x: number, y: number): void { this.#target.scale(x, y); }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.#target.setTransform(a, b, c, d, e, f);
  }
  resetTransform(): void { this.#target.resetTransform(); }
  drawImage(image: CanvasImageSource, x: number, y: number, w: number, h: number): void {
    this.#target.drawImage(image, x, y, w, h);
  }
  setLineDash(segments: number[]): void { this.#target.setLineDash(segments); }
  getLineDash(): number[] { return this.#target.getLineDash(); }
  get globalAlpha(): number { return this.#target.globalAlpha; }
  set globalAlpha(value: number) { this.#target.globalAlpha = value; }
  get globalCompositeOperation(): GlobalCompositeOperation { return this.#target.globalCompositeOperation; }
  set globalCompositeOperation(value: GlobalCompositeOperation) { this.#target.globalCompositeOperation = value; }
  get imageSmoothingEnabled(): boolean { return this.#target.imageSmoothingEnabled; }
  set imageSmoothingEnabled(value: boolean) { this.#target.imageSmoothingEnabled = value; }
  get imageSmoothingQuality(): ImageSmoothingQuality { return this.#target.imageSmoothingQuality; }
  set imageSmoothingQuality(value: ImageSmoothingQuality) { this.#target.imageSmoothingQuality = value; }
  get strokeStyle(): Style { return this.#target.strokeStyle; }
  set strokeStyle(value: Style) { this.#target.strokeStyle = value; }
  get fillStyle(): Style { return this.#target.fillStyle; }
  set fillStyle(value: Style) { this.#target.fillStyle = value; }
  get lineWidth(): number { return this.#target.lineWidth; }
  set lineWidth(value: number) { this.#target.lineWidth = value; }
  get lineCap(): CanvasLineCap { return this.#target.lineCap; }
  set lineCap(value: CanvasLineCap) { this.#target.lineCap = value; }
  get lineJoin(): CanvasLineJoin { return this.#target.lineJoin; }
  set lineJoin(value: CanvasLineJoin) { this.#target.lineJoin = value; }
  get font(): string { return this.#target.font; }
  set font(value: string) { this.#target.font = value; }
  get textAlign(): CanvasTextAlign { return this.#target.textAlign; }
  set textAlign(value: CanvasTextAlign) { this.#target.textAlign = value; }
  get textBaseline(): CanvasTextBaseline { return this.#target.textBaseline; }
  set textBaseline(value: CanvasTextBaseline) { this.#target.textBaseline = value; }
  get lineDashOffset(): number { return this.#target.lineDashOffset; }
  set lineDashOffset(value: number) { this.#target.lineDashOffset = value; }
}

/**
 * Run one drawing in a state of its own: saved first, started from an empty path, full opacity, the ordinary
 * composite and a solid line (each style set only where it differs, so a drawing that starts clean records nothing
 * extra), and, even when the drawing throws, its own open saves closed, its path emptied (a canvas does not save the
 * path, so a half-built one would reach the next fill, stroke or clip) and the state restored. The drawing is handed
 * a guarded surface that draws onto this one. The throw is not swallowed here.
 */
export function isolated(context: DrawContext, draw: (context: DrawContext) => void): void {
  const guarded = new Guarded(context);
  context.save();
  try {
    context.beginPath();
    if (context.globalAlpha !== 1) context.globalAlpha = 1;
    if (context.globalCompositeOperation !== 'source-over') context.globalCompositeOperation = 'source-over';
    if (context.getLineDash().length > 0) context.setLineDash([]);
    if (context.lineDashOffset !== 0) context.lineDashOffset = 0;
    draw(guarded);
  } finally {
    guarded.unwind();
    context.beginPath();
    context.restore();
  }
}

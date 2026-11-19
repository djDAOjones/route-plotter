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
 * Run one drawing in a state of its own: saved first, started from full opacity, the ordinary composite and a solid
 * line (each set only where it differs, so a drawing that starts clean records nothing extra), and restored after,
 * even when the drawing throws. The throw is not swallowed here.
 */
export function isolated(context: DrawContext, draw: (context: DrawContext) => void): void {
  context.save();
  try {
    if (context.globalAlpha !== 1) context.globalAlpha = 1;
    if (context.globalCompositeOperation !== 'source-over') context.globalCompositeOperation = 'source-over';
    if (context.getLineDash().length > 0) context.setLineDash([]);
    if (context.lineDashOffset !== 0) context.lineDashOffset = 0;
    draw(context);
  } finally {
    context.restore();
  }
}

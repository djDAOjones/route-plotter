// CORE-04: the draw recorder, v3's (`v3/tests/helpers/drawLog.js` and the recording context in `v3/tests/setup.js`)
// ported as one DrawContext. A frame drawn into it reads back as text, one line a call, which the goldens compare.
//
// It keeps the state a browser's context keeps, because state outlives the call that set it: save and restore push and
// pop the styles, the line dash, the transform and, new in v4, the clip region (INTAKE.30: v3's recorder kept no clip,
// so it could see neither a clip left in force after a throw nor any clip at all). Values a browser would ignore (an
// opacity outside 0 to 1, a width of 0, a matrix with a number that is not finite) are ignored here too.
//
// Each call that marks the surface is written with the state it draws with, after ` | `: `@` and its transform, every
// style it uses that is away from its default, and each clip in force, as the path it clipped to. A path's points
// carry their transform alone. Style changes are not lines of their own: two frames are equal when they draw the same
// way (DEF-39). Numbers are rounded to a thousandth of a pixel. Text is measured as half its font size a character, the
// same on every machine.
import type { DrawContext, Style } from './context';

type Matrix = readonly [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

interface Styles {
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

type StyleName = keyof Styles;

const STYLE_NAMES: readonly StyleName[] = [
  'globalAlpha',
  'globalCompositeOperation',
  'imageSmoothingEnabled',
  'imageSmoothingQuality',
  'strokeStyle',
  'fillStyle',
  'lineWidth',
  'lineCap',
  'lineJoin',
  'font',
  'textAlign',
  'textBaseline',
  'lineDashOffset',
];

const DEFAULTS: Readonly<Styles> = {
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'low',
  strokeStyle: '#000000',
  fillStyle: '#000000',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  lineDashOffset: 0,
};

const COMPOSITING: readonly StyleName[] = ['globalAlpha', 'globalCompositeOperation'];
const STROKING: readonly StyleName[] = ['strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'lineDashOffset'];
const LETTERING: readonly StyleName[] = ['font', 'textAlign', 'textBaseline'];
/** How a picture is resampled: a canvas's own defaults are on and 'low'; v3 drew every frame's pictures at 'high'. */
const SMOOTHING: readonly StyleName[] = ['imageSmoothingEnabled', 'imageSmoothingQuality'];

/** The styles each call that marks the surface draws with; the line dash goes with the stroking ones. */
const DRAWN_WITH: ReadonlyMap<string, { readonly styles: readonly StyleName[]; readonly dash: boolean }> = new Map([
  ['stroke', { styles: [...STROKING, ...COMPOSITING], dash: true }],
  ['strokeRect', { styles: [...STROKING, ...COMPOSITING], dash: true }],
  ['strokeText', { styles: [...STROKING, ...LETTERING, ...COMPOSITING], dash: true }],
  ['fill', { styles: ['fillStyle', ...COMPOSITING], dash: false }],
  ['fillRect', { styles: ['fillStyle', ...COMPOSITING], dash: false }],
  ['fillText', { styles: ['fillStyle', ...LETTERING, ...COMPOSITING], dash: false }],
  ['drawImage', { styles: [...COMPOSITING, ...SMOOTHING], dash: false }],
  ['clearRect', { styles: [], dash: false }],
]);

/** The calls that add to the current path: drawn later by fill, stroke or clip, each under the transform it had. */
const PATH_CALLS = new Set(['moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arc', 'ellipse', 'rect', 'closePath']);

interface Saved {
  readonly styles: Styles;
  readonly lineDash: readonly number[];
  readonly transform: Matrix;
  readonly clip: readonly string[];
}

/** What the recorder holds now: how many saved states are open, the transform, the styles away from their defaults
 * (the line dash among them), each clip in force, and the current path, which save and restore do not touch. */
export interface RecorderState {
  readonly depth: number;
  readonly transform: Matrix;
  readonly styles: Readonly<Record<string, string>>;
  readonly clip: readonly string[];
  readonly path: readonly string[];
}

function round(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(3)) + 0) : String(value);
}

function describeStyle(value: Style | number | boolean): string {
  if (typeof value === 'number') return round(value);
  if (typeof value === 'boolean') return String(value);
  return typeof value === 'string' ? value : 'gradient-or-pattern';
}

function describeMatrix(matrix: Matrix): string {
  return matrix.map(round).join(' ');
}

function multiply([a1, b1, c1, d1, e1, f1]: Matrix, [a2, b2, c2, d2, e2, f2]: Matrix): Matrix {
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

/** Anything with an image's size: a browser's image, or a test's stand-in, since the recorder reads only the size. */
type Sized = CanvasImageSource | { readonly width: number; readonly height: number };

function describeImage(image: Sized): string {
  const width = 'width' in image && typeof image.width === 'number' ? image.width : null;
  const height = 'height' in image && typeof image.height === 'number' ? image.height : null;
  return width !== null && height !== null ? `image(${round(width)}x${round(height)})` : 'image';
}

export class Recorder implements DrawContext {
  #lines: string[] = [];
  #styles: Styles = { ...DEFAULTS };
  #lineDash: readonly number[] = [];
  #transform: Matrix = IDENTITY;
  #clip: readonly string[] = [];
  #path: string[] = [];
  #stack: Saved[] = [];

  /** The frame drawn since the last take, one line a call; the recorder starts a new frame. */
  take(): string[] {
    const lines = this.#lines;
    this.#lines = [];
    return lines;
  }

  state(): RecorderState {
    const styles: Record<string, string> = {};
    for (const name of STYLE_NAMES) {
      if (this.#styles[name] !== DEFAULTS[name]) styles[name] = describeStyle(this.#styles[name]);
    }
    if (this.#lineDash.length > 0) styles.lineDash = this.#lineDash.map(round).join(',');
    return { depth: this.#stack.length, transform: this.#transform, styles, clip: this.#clip, path: [...this.#path] };
  }

  #record(name: string, args: readonly (number | string)[] = []): void {
    const call = [name, ...args.map((value) => (typeof value === 'number' ? round(value) : value))].join(' ');
    if (PATH_CALLS.has(name)) {
      const located = `${call} @ ${describeMatrix(this.#transform)}`;
      this.#path.push(located);
      this.#lines.push(located);
      return;
    }
    const drawn = DRAWN_WITH.get(name);
    if (!drawn) {
      this.#lines.push(call);
      return;
    }
    const parts = [`@ ${describeMatrix(this.#transform)}`];
    const styles = drawn.styles
      .filter((style) => this.#styles[style] !== DEFAULTS[style])
      .map((style) => `${style}=${describeStyle(this.#styles[style])}`);
    if (drawn.dash && this.#lineDash.length > 0) styles.push(`lineDash=${this.#lineDash.map(round).join(',')}`);
    if (styles.length > 0) parts.push(styles.join(' '));
    if (this.#clip.length > 0) parts.push(`clip ${this.#clip.map((path) => `[${path}]`).join(' ')}`);
    this.#lines.push(`${call} | ${parts.join(' | ')}`);
  }

  #setTransform(next: Matrix): void {
    if (next.every(Number.isFinite)) this.#transform = next;
  }

  save(): void {
    this.#record('save');
    this.#stack.push({ styles: { ...this.#styles }, lineDash: this.#lineDash, transform: this.#transform, clip: this.#clip });
  }

  restore(): void {
    this.#record('restore');
    const saved = this.#stack.pop();
    if (!saved) return;
    this.#styles = { ...saved.styles };
    this.#lineDash = saved.lineDash;
    this.#transform = saved.transform;
    this.#clip = saved.clip;
  }

  beginPath(): void {
    this.#path = [];
    this.#record('beginPath');
  }

  closePath(): void {
    this.#record('closePath');
  }

  moveTo(x: number, y: number): void {
    this.#record('moveTo', [x, y]);
  }

  lineTo(x: number, y: number): void {
    this.#record('lineTo', [x, y]);
  }

  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    this.#record('bezierCurveTo', [cp1x, cp1y, cp2x, cp2y, x, y]);
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.#record('quadraticCurveTo', [cpx, cpy, x, y]);
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise = false): void {
    this.#record('arc', [x, y, radius, startAngle, endAngle, counterclockwise ? 'anticlockwise' : 'clockwise']);
  }

  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise = false,
  ): void {
    const direction = counterclockwise ? 'anticlockwise' : 'clockwise';
    this.#record('ellipse', [x, y, radiusX, radiusY, rotation, startAngle, endAngle, direction]);
  }

  rect(x: number, y: number, w: number, h: number): void {
    this.#record('rect', [x, y, w, h]);
  }

  fill(): void {
    this.#record('fill');
  }

  stroke(): void {
    this.#record('stroke');
  }

  /** The clip is the current path, each of its points under the transform it was added with; clips in force meet. */
  clip(): void {
    this.#record('clip');
    this.#clip = [...this.#clip, this.#path.join('; ')];
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.#record('fillRect', [x, y, w, h]);
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    this.#record('strokeRect', [x, y, w, h]);
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    this.#record('clearRect', [x, y, w, h]);
  }

  fillText(text: string, x: number, y: number): void {
    this.#record('fillText', [JSON.stringify(text), x, y]);
  }

  strokeText(text: string, x: number, y: number): void {
    this.#record('strokeText', [JSON.stringify(text), x, y]);
  }

  measureText(text: string): { readonly width: number } {
    const size = /(\d+(?:\.\d+)?)px/.exec(this.#styles.font);
    return { width: text.length * (size ? Number(size[1]) : 10) * 0.5 };
  }

  translate(x: number, y: number): void {
    this.#record('translate', [x, y]);
    this.#setTransform(multiply(this.#transform, [1, 0, 0, 1, x, y]));
  }

  rotate(angle: number): void {
    this.#record('rotate', [angle]);
    this.#setTransform(multiply(this.#transform, [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]));
  }

  scale(x: number, y: number): void {
    this.#record('scale', [x, y]);
    this.#setTransform(multiply(this.#transform, [x, 0, 0, y, 0, 0]));
  }

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.#record('setTransform', [a, b, c, d, e, f]);
    this.#setTransform([a, b, c, d, e, f]);
  }

  resetTransform(): void {
    this.#record('resetTransform');
    this.#transform = IDENTITY;
  }

  drawImage(image: Sized, dx: number, dy: number, dw: number, dh: number): void {
    this.#record('drawImage', [describeImage(image), dx, dy, dw, dh]);
  }

  /** As a browser: a dash with a negative or non-finite length is ignored, and an odd list is repeated. */
  setLineDash(segments: number[]): void {
    if (!segments.every((length) => Number.isFinite(length) && length >= 0)) return;
    this.#lineDash = segments.length % 2 === 1 ? [...segments, ...segments] : [...segments];
  }

  getLineDash(): number[] {
    return [...this.#lineDash];
  }

  get globalAlpha(): number {
    return this.#styles.globalAlpha;
  }

  set globalAlpha(value: number) {
    if (Number.isFinite(value) && value >= 0 && value <= 1) this.#styles.globalAlpha = value;
  }

  get globalCompositeOperation(): GlobalCompositeOperation {
    return this.#styles.globalCompositeOperation;
  }

  set globalCompositeOperation(value: GlobalCompositeOperation) {
    this.#styles.globalCompositeOperation = value;
  }

  get imageSmoothingEnabled(): boolean {
    return this.#styles.imageSmoothingEnabled;
  }

  set imageSmoothingEnabled(value: boolean) {
    this.#styles.imageSmoothingEnabled = value;
  }

  get imageSmoothingQuality(): ImageSmoothingQuality {
    return this.#styles.imageSmoothingQuality;
  }

  /** As a browser: a quality that is none of the three is ignored. */
  set imageSmoothingQuality(value: ImageSmoothingQuality) {
    if (value === 'low' || value === 'medium' || value === 'high') this.#styles.imageSmoothingQuality = value;
  }

  get strokeStyle(): Style {
    return this.#styles.strokeStyle;
  }

  set strokeStyle(value: Style) {
    this.#styles.strokeStyle = value;
  }

  get fillStyle(): Style {
    return this.#styles.fillStyle;
  }

  set fillStyle(value: Style) {
    this.#styles.fillStyle = value;
  }

  get lineWidth(): number {
    return this.#styles.lineWidth;
  }

  set lineWidth(value: number) {
    if (Number.isFinite(value) && value > 0) this.#styles.lineWidth = value;
  }

  get lineCap(): CanvasLineCap {
    return this.#styles.lineCap;
  }

  set lineCap(value: CanvasLineCap) {
    this.#styles.lineCap = value;
  }

  get lineJoin(): CanvasLineJoin {
    return this.#styles.lineJoin;
  }

  set lineJoin(value: CanvasLineJoin) {
    this.#styles.lineJoin = value;
  }

  get font(): string {
    return this.#styles.font;
  }

  set font(value: string) {
    this.#styles.font = value;
  }

  get textAlign(): CanvasTextAlign {
    return this.#styles.textAlign;
  }

  set textAlign(value: CanvasTextAlign) {
    this.#styles.textAlign = value;
  }

  get textBaseline(): CanvasTextBaseline {
    return this.#styles.textBaseline;
  }

  set textBaseline(value: CanvasTextBaseline) {
    this.#styles.textBaseline = value;
  }

  get lineDashOffset(): number {
    return this.#styles.lineDashOffset;
  }

  set lineDashOffset(value: number) {
    if (Number.isFinite(value)) this.#styles.lineDashOffset = value;
  }
}

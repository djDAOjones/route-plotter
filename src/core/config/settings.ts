// CORE-01: the core modules' settings, each field declared once with the schema helper (the plan's §13). A route has
// its line, lead, markers, labels and pauses; the scene its background, graphics, clock and export. Ranges and
// defaults are v3's, carried: each comment names the line in v3/ it comes from. Where v4 narrows v3's open check to
// what v3's control could show, so that a value that opens is one its control can show (DEF-20.2, INTAKE.29), it says
// so. Every time is an exact time in milliseconds of scene time, never a share of a duration (A2a).
import { LIMITS } from './limits';
import { boolean, choice, colour, number } from '../schema/field';

const VERMILLION = '#d55e00'; // Okabe-Ito, v3's route colour (v3/src/config/constants.js:42)

export const LINE_SETTINGS = {
  colour: colour({ default: VERMILLION, description: 'The colour the route is drawn in.' }),
  // v3/src/utils/pathWidthScale.js:12–13; default v3/src/config/constants.js:43.
  thickness: number({ default: 3, min: 1, max: 40, unit: 'pixels', description: 'How thick the route is drawn.' }),
  // v3's five path visibility modes (v3/src/config/constants.js:330–335), in v4's words; v3's default was the second.
  appearance: choice({
    choices: ['whole', 'grows', 'shrinks', 'trail', 'hidden'],
    default: 'grows',
    description: 'How the route appears over time: whole, growing behind the lead, shrinking, as a trail, or hidden.',
  }),
  // v3/src/config/constants.js:270–271; default v3's model default, 0.20 (v3/src/config/constants.js:269), which
  // v3/src/main.js:171 gives every new project.
  trailLength: number({
    default: 0.2,
    min: 0.04,
    max: 4,
    unit: 'times',
    description: 'A trail’s length, as a share of the route.',
  }),
};

export const LEAD_SETTINGS = {
  visible: boolean({ default: true, description: 'Whether the lead is drawn; a hidden lead still times its route.' }),
  timing: choice({
    choices: ['speed', 'total time'],
    default: 'speed',
    description: 'Whether the lead moves at a set speed or walks its route in a set total time.',
  }),
  // v3's 1 to 4,000 canvas pixels a second, default 200 (v3/src/controllers/UIController.js:49–50,
  // v3/src/config/constants.js:11), re-based on a 1,000-pixel-wide image, as v4 measures in image widths (DEF-79).
  speed: number({
    default: 0.2,
    min: 0.001,
    max: 4,
    unit: 'image widths per second',
    description: 'How fast the lead moves.',
  }),
  // v3's duration, default 10 s (v3/src/config/constants.js:10), at most a day (v3/src/app/persistence.js:74).
  totalTimeMs: number({
    default: 10_000,
    min: 1,
    max: LIMITS.timeMs,
    unit: 'milliseconds',
    integer: true,
    description: 'How long the lead takes to walk its route, when timed by total time.',
  }),
  startsAtMs: number({
    default: 0,
    min: 0,
    max: LIMITS.timeMs,
    unit: 'milliseconds',
    integer: true,
    description: 'When the lead sets off.',
  }),
  // v3/index.html:775; default v3/src/config/constants.js:50.
  headSize: number({
    default: 8,
    min: 4,
    max: 24,
    unit: 'pixels',
    integer: true,
    description: 'How large the lead’s head is drawn.',
  }),
};

export const MARKER_SETTINGS = {
  // v3's five waypoint visibility modes (v3/src/config/constants.js:342–347), in v4's words.
  appearance: choice({
    choices: ['always', 'from arrival', 'until arrival', 'at arrival', 'never'],
    default: 'always',
    description: 'When a stop’s marker shows: always, from the lead’s arrival, until it, only at it, or never.',
  }),
  // v3/index.html:194; default v3/src/config/constants.js:44.
  size: number({
    default: 8,
    min: 4,
    max: 16,
    unit: 'pixels',
    integer: true,
    description: 'How large a stop’s marker is drawn.',
  }),
  colour: colour({ default: VERMILLION, description: 'The colour of a stop’s marker.' }),
};

export const LABEL_SETTINGS = {
  // v3's four text visibility modes (v3/src/config/constants.js:367–371); default v3/src/models/Waypoint.js:84.
  appearance: choice({
    choices: ['off', 'on', 'fade in', 'fade in and out'],
    default: 'fade in',
    description: 'How a stop’s label shows: never, always, fading in on arrival, or fading in and out.',
  }),
  // v3/src/config/constants.js:381–383, 388–390, 393–396, 399–407.
  size: number({ default: 16, min: 16, max: 48, unit: 'pixels', integer: true, description: 'The label’s text size.' }),
  width: number({
    default: 15,
    min: 5,
    max: 50,
    unit: 'percent',
    integer: true,
    description: 'The label’s width, as a share of the image’s.',
  }),
  offsetX: number({
    default: 0,
    min: -50,
    max: 50,
    unit: 'percent',
    integer: true,
    description: 'How far the label sits right of its stop.',
  }),
  offsetY: number({
    default: 0,
    min: -50,
    max: 50,
    unit: 'percent',
    integer: true,
    description: 'How far the label sits below its stop.',
  }),
  textColour: colour({ default: '#1a1a1a', description: 'The label’s text colour.' }),
  backgroundColour: colour({ default: '#ffffff', description: 'The colour behind the label’s text.' }),
  backgroundOpacity: number({
    default: 0.85,
    min: 0,
    max: 1,
    unit: 'times',
    description: 'How solid the colour behind the label is.',
  }),
};

/** The pauses module's one setting, carried by each stop; a new stop takes its default. */
export const PAUSE_SETTINGS = {
  // Default v3/src/config/constants.js:16; at most v3/src/app/persistence.js:76.
  pauseMs: number({
    default: 1_500,
    min: 0,
    max: LIMITS.pauseMs,
    unit: 'milliseconds',
    integer: true,
    description: 'How long the lead pauses at a stop.',
  }),
};

export const BACKGROUND_SETTINGS = {
  showImage: boolean({
    default: true,
    description: 'Whether the background image shows, while editing, playing and in exports.',
  }),
  // v3's tint, −100 darker to +100 lighter (v3/src/config/constants.js:294–295; v3/index.html:978).
  tint: number({
    default: 0,
    min: -100,
    max: 100,
    unit: 'percent',
    description: 'How much the background is darkened (below 0) or lightened (above 0).',
  }),
  // v3/index.html:987.
  zoom: number({
    default: 100,
    min: 50,
    max: 400,
    unit: 'percent',
    description: 'How large the background image is drawn.',
  }),
};

export const GRAPHICS_SETTINGS = {
  // What v3's renderer draws (v3/src/services/RenderingService.js:143); v3's open check took up to 16
  // (v3/src/app/persistence.js:394), which drew at 4: INTAKE.29.
  scale: number({
    default: 1,
    min: 0.25,
    max: 4,
    unit: 'times',
    description: 'How large lines, markers and labels are drawn.',
  }),
};

export const CLOCK_SETTINGS = {
  length: choice({
    choices: ['from content', 'fixed'],
    default: 'from content',
    description: 'Whether the scene runs until everything in it has finished, or for a fixed length.',
  }),
  fixedLengthMs: number({
    default: 10_000,
    min: 1,
    max: LIMITS.timeMs,
    unit: 'milliseconds',
    integer: true,
    description: 'The scene’s length, when fixed.',
  }),
  // Hold at end's range, v3/src/config/constants.js:23–24, also bounds Hold at start (CROWD-05.1's candidate).
  holdAtStartMs: number({
    default: 0,
    min: 0,
    max: 10_000,
    unit: 'milliseconds',
    integer: true,
    description: 'How long the first frame holds before anything moves.',
  }),
  holdAtEndMs: number({
    default: 2_000,
    min: 0,
    max: 10_000,
    unit: 'milliseconds',
    integer: true,
    description: 'How long the last frame holds.',
  }),
};

export const EXPORT_SETTINGS = {
  // v3/index.html:1023, 1028.
  width: number({
    default: 1920,
    min: 100,
    max: 7680,
    unit: 'pixels',
    integer: true,
    description: 'The video’s width.',
  }),
  height: number({
    default: 1080,
    min: 100,
    max: 4320,
    unit: 'pixels',
    integer: true,
    description: 'The video’s height.',
  }),
  // v3/src/config/constants.js:29–31; v3's open check took 1 to 120 (v3/src/app/persistence.js:362–363), more
  // than its control could show: DEF-20.2's rule, one range.
  frameRate: number({
    default: 25,
    min: 10,
    max: 60,
    unit: 'frames per second',
    integer: true,
    description: 'Frames a second in a video export.',
  }),
  // No "include the background" field: since UI-08 that is Show image, one setting (BACKGROUND_SETTINGS).
};

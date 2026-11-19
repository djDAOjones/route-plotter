// CORE-03: v4's save format (the plan's §13; A12; A13 as PLAN-7 changed it). A project file is a ZIP holding
// `project.json` and the project's images. project.json is declared here once, with the schema helper: its format mark
// (`app`, `format`, `version`, first, which is how a v3 file is told apart), the scene as CORE-01 declares it (SCENE,
// never a second list of its fields) and the images. So a field the core declares is saved and checked at open with no
// change here. Until v4.0 is declared, each preview opens only its own `version` (PLAN-7): raise FORMAT_VERSION whenever
// what project.json may hold changes, the scene's declarations included.
import { LIMITS } from '../../core/config/limits';
import { SCENE } from '../../core/model/scene';
import type { Scene } from '../../core/model/scene';
import { choice, group, id, list, number } from '../../core/schema/field';
import { IMAGE_LIMITS } from './limits';

/** The save format's version: until v4.0, a file of any other version is refused whole (PLAN-7, D82). */
export const FORMAT_VERSION = 1;

/** The image types a project may hold (v3/src/models/ImageAsset.js:5–12, ALLOWED_MIME_TYPES). */
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

const EXTENSIONS: Readonly<Record<ImageType, string>> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

const IMAGE_FIELDS = {
  id: id({ maxLength: LIMITS.idLength, description: 'The image’s id, used by nothing else in the project.' }),
  type: choice({ choices: IMAGE_TYPES, default: 'image/png', description: 'The image’s file type.' }),
};

/** project.json, declared once: what Save writes and what Open checks, field by field. */
export const PROJECT_FILE = group({
  of: {
    app: choice({ choices: ['route-plotter'], default: 'route-plotter', description: 'The app that saved the file.' }),
    format: choice({ choices: ['v4'], default: 'v4', description: 'The Route Plotter whose format the file is in.' }),
    version: number({
      default: FORMAT_VERSION,
      min: FORMAT_VERSION,
      max: FORMAT_VERSION,
      integer: true,
      unit: 'count',
      description: 'The save format’s version; until v4.0 a preview opens its own version only.',
    }),
    scene: SCENE,
    images: list({ of: IMAGE_FIELDS, max: IMAGE_LIMITS.count, description: 'The project’s images, in saved order.' }),
  },
  description: 'A saved project’s project.json.',
});

/** An image the project holds: its id, its type and its bytes, exactly as they were added. */
interface ProjectImage {
  readonly id: string;
  readonly type: ImageType;
  readonly bytes: Uint8Array;
}

/** What Save writes and Open gives back: the scene and its images. */
export interface Project {
  readonly scene: Scene;
  readonly images: readonly ProjectImage[];
}

/** The ZIP entry holding the image at `index` of project.json's `images`: its place and type name it, nothing else. */
export function imageEntryName(index: number, type: ImageType): string {
  return `images/${index + 1}.${EXTENSIONS[type]}`;
}

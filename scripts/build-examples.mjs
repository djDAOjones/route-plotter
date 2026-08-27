/**
 * Assemble the downloadable example project saves (DEMO-01).
 *
 * Each example lives in the repository as a definition plus the *name* of a
 * bundled background; this writes the real `.zip` a user downloads and
 * re-opens. Keeping the bytes out of the repository is the point: the images
 * are already shipped and owner-approved in `public-assets.json`, and
 * committing a second copy inside each ZIP would add megabytes of duplication
 * to history every time an example was re-exported.
 *
 * The archive layout is the app's own — `project.json`, `background.<ext>` —
 * so an example opens through exactly the import path a user's own save does,
 * with no special case anywhere in the app.
 *
 * Usage: node scripts/build-examples.mjs <outDir>
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import JSZip from 'jszip';

const ROOT = path.resolve(import.meta.dirname, '..');

const MIME_BY_EXTENSION = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/**
 * @param {string} outDir Directory to write the archives into
 * @returns {Promise<Array<{id: string, file: string, bytes: number}>>}
 */
export async function buildExampleArchives(outDir) {
  const { buildExampleProjects } = await import(
    pathToFileURL(path.join(ROOT, 'src/examples/index.js')).href
  );

  // Only backgrounds the owner approved for publication may be shipped inside
  // a downloadable archive (public-assets.json is the approval record).
  const approved = new Set(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'public-assets.json'), 'utf8'))
      .assets.map(asset => asset.path)
  );

  fs.mkdirSync(outDir, { recursive: true });
  const written = [];

  for (const example of buildExampleProjects()) {
    if (!approved.has(example.backgroundSource)) {
      throw new Error(
        `Example "${example.id}" uses ${example.backgroundSource}, which is not an approved public asset`
      );
    }

    const extension = path.extname(example.backgroundSource).toLowerCase();
    const mimeType = MIME_BY_EXTENSION[extension];
    if (!mimeType) {
      throw new Error(`Example "${example.id}" uses an unsupported background type: ${extension}`);
    }

    const imageBytes = fs.readFileSync(path.join(ROOT, example.backgroundSource));
    const backgroundFile = `background${extension === '.jpeg' ? '.jpg' : extension}`;

    // Fixed per-entry timestamp: JSZip stamps the current date onto every
    // entry it writes, which would make each build produce different bytes and
    // every rebuild land a fresh multi-megabyte blob in history. The option is
    // per file, not on generateAsync.
    const stamp = { date: new Date('2026-01-01T00:00:00Z') };

    const zip = new JSZip();
    zip.file(backgroundFile, imageBytes, stamp);
    zip.file('project.json', JSON.stringify({
      ...example.project,
      backgroundFile,
      assetManifest: [],
    }, null, 2), stamp);

    const archive = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    const file = `${example.id}.zip`;
    fs.writeFileSync(path.join(outDir, file), archive);
    written.push({ id: example.id, file, bytes: archive.length });
  }

  return written;
}

// Run directly: node scripts/build-examples.mjs <outDir>
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const outDir = process.argv[2] || path.join(ROOT, 'docs/examples');
  buildExampleArchives(outDir)
    .then(written => {
      for (const item of written) {
        console.log(`   ${item.file} (${(item.bytes / 1024).toFixed(0)} KB)`);
      }
    })
    .catch(error => {
      console.error(`❌ Example archives failed: ${error.message}`);
      process.exit(1);
    });
}

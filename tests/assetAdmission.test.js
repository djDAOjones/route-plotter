import { describe, expect, test } from 'vitest';

import { PROJECT_ARCHIVE_LIMITS } from '../src/services/ImageAssetService.js';
import { planImageAssetAdmission } from '../src/utils/assetReferences.js';

function asset(id, { size = 1, width = 1, height = 1 } = {}) {
  return { id, size, width, height };
}

function state(...assetIds) {
  return JSON.stringify({
    waypoints: assetIds.map(customImageAssetId => ({ customImageAssetId })),
  });
}

function limits({ assets = 128, bytes = 40 * 1024 * 1024, pixels = 80_000_000 } = {}) {
  return {
    MAX_ASSETS: assets,
    MAX_ASSET_BYTES_TOTAL: bytes,
    MAX_IMAGE_PIXELS_TOTAL: pixels,
  };
}

describe('image asset admission planning', () => {
  test('prunes unreachable assets without discarding otherwise retained history', () => {
    const stale = asset('stale');
    const retained = asset('retained');
    const candidate = asset('candidate');
    const assets = [stale, retained];
    const prospectiveUndoStates = [state('retained'), state('candidate')];

    const plan = planImageAssetAdmission({
      assets,
      candidate,
      prospectiveUndoStates,
      limits: limits({ assets: 2 }),
    });

    expect(plan).toMatchObject({
      fits: true,
      additionalDiscardCount: 0,
      removedIds: ['stale'],
      metrics: { count: 2, bytes: 2, pixels: 2 },
      error: null,
    });
    expect(plan.nextAssets).toEqual([retained, candidate]);
    expect(assets).toEqual([stale, retained]);
    expect(prospectiveUndoStates).toEqual([state('retained'), state('candidate')]);
  });

  test('discards the unique minimum oldest prefix needed to fit the count limit', () => {
    const oldest = asset('oldest');
    const newer = asset('newer');
    const candidate = asset('candidate');

    const plan = planImageAssetAdmission({
      assets: [oldest, newer],
      candidate,
      prospectiveUndoStates: [state('oldest'), state('newer'), state('candidate')],
      limits: limits({ assets: 2 }),
    });

    expect(plan).toMatchObject({
      fits: true,
      additionalDiscardCount: 1,
      removedIds: ['oldest'],
      metrics: { count: 2 },
    });
    expect(plan.nextAssets).toEqual([newer, candidate]);
  });

  test.each([
    {
      label: 'byte',
      old: { size: 6, width: 1, height: 1 },
      candidate: { size: 5, width: 1, height: 1 },
      projectLimits: { assets: 2, bytes: 10, pixels: 10 },
      expectedMetrics: { count: 1, bytes: 5, pixels: 1 },
    },
    {
      label: 'pixel',
      old: { size: 1, width: 3, height: 2 },
      candidate: { size: 1, width: 5, height: 1 },
      projectLimits: { assets: 2, bytes: 10, pixels: 10 },
      expectedMetrics: { count: 1, bytes: 1, pixels: 5 },
    },
  ])('uses the minimum discard needed at the $label boundary', ({
    old,
    candidate: candidateMetrics,
    projectLimits,
    expectedMetrics,
  }) => {
    const oldAsset = asset('old', old);
    const candidate = asset('candidate', candidateMetrics);

    const plan = planImageAssetAdmission({
      assets: [oldAsset],
      candidate,
      prospectiveUndoStates: [state('old'), state('candidate')],
      limits: limits(projectLimits),
    });

    expect(plan).toMatchObject({
      fits: true,
      additionalDiscardCount: 1,
      removedIds: ['old'],
      metrics: expectedMetrics,
    });
    expect(plan.nextAssets).toEqual([candidate]);
  });

  test('accepts count, byte, and pixel totals exactly at every limit', () => {
    const retained = asset('retained', { size: 4, width: 2, height: 2 });
    const candidate = asset('candidate', { size: 6, width: 3, height: 2 });

    const plan = planImageAssetAdmission({
      assets: [retained],
      candidate,
      prospectiveUndoStates: [state('retained'), state('candidate')],
      limits: limits({ assets: 2, bytes: 10, pixels: 10 }),
    });

    expect(plan).toMatchObject({
      fits: true,
      additionalDiscardCount: 0,
      metrics: { count: 2, bytes: 10, pixels: 10 },
    });
    expect(plan.nextAssets).toEqual([retained, candidate]);
  });

  test('pins the real 40 MiB and 48-million-pixel project boundaries', () => {
    const halfBytes = PROJECT_ARCHIVE_LIMITS.MAX_ASSET_BYTES_TOTAL / 2;
    const halfPixels = PROJECT_ARCHIVE_LIMITS.MAX_IMAGE_PIXELS_TOTAL / 2;
    const retained = asset('retained', {
      size: halfBytes,
      width: 1,
      height: halfPixels,
    });
    const exactCandidate = asset('exact-candidate', {
      size: halfBytes,
      width: 1,
      height: halfPixels,
    });
    const exactPlan = planImageAssetAdmission({
      assets: [retained],
      candidate: exactCandidate,
      prospectiveUndoStates: [state('retained'), state('exact-candidate')],
      limits: PROJECT_ARCHIVE_LIMITS,
    });

    expect(exactPlan).toMatchObject({
      fits: true,
      additionalDiscardCount: 0,
      metrics: {
        count: 2,
        bytes: PROJECT_ARCHIVE_LIMITS.MAX_ASSET_BYTES_TOTAL,
        pixels: PROJECT_ARCHIVE_LIMITS.MAX_IMAGE_PIXELS_TOTAL,
      },
    });

    const overCandidate = asset('over-candidate', {
      size: halfBytes + 1,
      width: 1,
      height: halfPixels + 1,
    });
    const shortenedPlan = planImageAssetAdmission({
      assets: [retained],
      candidate: overCandidate,
      prospectiveUndoStates: [state('retained'), state('over-candidate')],
      limits: PROJECT_ARCHIVE_LIMITS,
    });

    expect(shortenedPlan).toMatchObject({
      fits: true,
      additionalDiscardCount: 1,
      removedIds: ['retained'],
      metrics: {
        count: 1,
        bytes: halfBytes + 1,
        pixels: halfPixels + 1,
      },
    });
  });

  test('reuses an existing candidate ID without double-counting or replacing its bytes', () => {
    const existing = asset('same', { size: 4, width: 2, height: 2 });
    const duplicateCandidate = asset('same', { size: 999, width: 99, height: 99 });

    const plan = planImageAssetAdmission({
      assets: [existing],
      candidate: duplicateCandidate,
      prospectiveUndoStates: [state('same')],
      limits: limits({ assets: 1, bytes: 4, pixels: 4 }),
    });

    expect(plan).toMatchObject({
      fits: true,
      additionalDiscardCount: 0,
      removedIds: [],
      metrics: { count: 1, bytes: 4, pixels: 4 },
    });
    expect(plan.nextAssets).toEqual([existing]);
    expect(plan.nextAssets[0]).toBe(existing);
  });

  test('fails without proposing mutation when the candidate alone exceeds a limit', () => {
    const retained = asset('retained');
    const candidate = asset('candidate', { size: 11 });
    const assets = [retained];

    const plan = planImageAssetAdmission({
      assets,
      candidate,
      prospectiveUndoStates: [state('retained'), state('candidate')],
      limits: limits({ assets: 2, bytes: 10, pixels: 10 }),
    });

    expect(plan).toMatchObject({
      fits: false,
      additionalDiscardCount: 0,
      nextAssets: assets,
      removedIds: [],
      metrics: { count: 1, bytes: 11, pixels: 1 },
    });
    expect(plan.error).toMatch(/40 MB total limit/);
    expect(plan.nextAssets).toEqual(assets);
    expect(plan.nextAssets).not.toBe(assets);
  });

  test.each([
    {
      label: 'non-array asset collection',
      options: { assets: null, candidate: asset('candidate'), prospectiveUndoStates: [state('candidate')], limits: limits() },
      error: /requires assets and prospective undo states/,
    },
    {
      label: 'empty prospective history',
      options: { assets: [], candidate: asset('candidate'), prospectiveUndoStates: [], limits: limits() },
      error: /requires assets and prospective undo states/,
    },
    {
      label: 'non-finite limits',
      options: {
        assets: [], candidate: asset('candidate'), prospectiveUndoStates: [state('candidate')],
        limits: limits({ bytes: Number.NaN }),
      },
      error: /finite project limits/,
    },
    {
      label: 'candidate without an ID',
      options: { assets: [], candidate: asset(''), prospectiveUndoStates: [state('candidate')], limits: limits() },
      error: /Candidate image asset must have a non-empty string ID/,
    },
    {
      label: 'candidate with invalid metrics',
      options: {
        assets: [], candidate: asset('candidate', { width: 0 }),
        prospectiveUndoStates: [state('candidate')], limits: limits(),
      },
      error: /finite byte and pixel metrics/,
    },
    {
      label: 'duplicate live IDs',
      options: {
        assets: [asset('duplicate'), asset('duplicate')], candidate: asset('candidate'),
        prospectiveUndoStates: [state('candidate')], limits: limits(),
      },
      error: /Duplicate image asset id/,
    },
    {
      label: 'newest state missing the candidate',
      options: {
        assets: [asset('old')], candidate: asset('candidate'),
        prospectiveUndoStates: [state('old')], limits: limits(),
      },
      error: /does not reference the candidate asset/,
    },
    {
      label: 'history referencing missing bytes',
      options: {
        assets: [], candidate: asset('candidate'),
        prospectiveUndoStates: [state('missing'), state('candidate')], limits: limits(),
      },
      error: /references missing image asset: missing/,
    },
    {
      label: 'malformed serialized history',
      options: {
        assets: [], candidate: asset('candidate'),
        prospectiveUndoStates: ['{"waypoints":', state('candidate')], limits: limits(),
      },
      error: SyntaxError,
    },
  ])('rejects $label before returning a plan', ({ options, error }) => {
    expect(() => planImageAssetAdmission(options)).toThrow(error);
  });
});

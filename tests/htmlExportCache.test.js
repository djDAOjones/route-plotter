import { afterEach, describe, expect, test, vi } from 'vitest';
import { HTMLExportService } from '../src/services/HTMLExportService.js';

const PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function readBlobText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('HTML export player cache correctness', () => {
  test('fetches the player bundle for the exact app build', async () => {
    vi.stubGlobal('APP_VERSION', '3.2.999');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('window.playerReady = true;'),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(new HTMLExportService()._fetchPlayerBundle())
      .resolves.toContain('playerReady');

    const requested = fetchMock.mock.calls[0][0];
    expect(requested).toBeInstanceOf(URL);
    expect(requested.pathname).toMatch(/\/player\.js$/);
    expect(requested.searchParams.get('v')).toBe('3.2.999');
  });

  test('preloads once and reuses the successful bundle for later exports', async () => {
    let resolveFetch;
    const fetchMock = vi.fn(() => new Promise(resolve => {
      resolveFetch = resolve;
    }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new HTMLExportService();
    const joinedPreload = service.preloadPlayerBundle();
    expect(fetchMock).toHaveBeenCalledOnce();

    resolveFetch({
      ok: true,
      text: vi.fn().mockResolvedValue('window.preloadedPlayer = true;\n//# sourceMappingURL=player.js.map')
    });

    await expect(joinedPreload).resolves.toBe('window.preloadedPlayer = true;\n');
    await expect(service._fetchPlayerBundle()).resolves.toContain('preloadedPlayer');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('does not cache a failed preload and retries on export', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('temporary offline'))
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue('window.retriedPlayer = true;')
      });
    vi.stubGlobal('fetch', fetchMock);

    const service = new HTMLExportService();
    await service._preloadAttempt;

    await expect(service._fetchPlayerBundle()).resolves.toContain('retriedPlayer');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('embeds retained PNG bytes unchanged without canvas conversion and sets standalone CSP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('window.playerReady = true;'),
    }));
    const canvasEncoding = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL');
    const service = new HTMLExportService();

    const blob = await service.exportHTML({
      projectData: {
        coordVersion: 9,
        imageAssets: [{ name: 'explicit-source-name.png', base64: PIXEL_PNG }],
      },
      backgroundDataURL: PIXEL_PNG,
      title: 'Sentinel export',
    });
    const html = await readBlobText(blob);

    expect(html).toContain(`window.__ROUTE_PLOTTER_BG__ = ${JSON.stringify(PIXEL_PNG)};`);
    expect(html).toContain('explicit-source-name.png');
    expect(html).not.toContain('data:image/jpeg');
    expect(canvasEncoding).not.toHaveBeenCalled();
    expect(html).toContain(
      `Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`
    );
  });

  test('fails clearly when original HTML background source bytes are missing or invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('window.playerReady = true;'),
    }));
    const service = new HTMLExportService();

    await expect(service.exportHTML({ projectData: {}, backgroundDataURL: null }))
      .rejects.toThrow(/Original background bytes are unavailable/);
    await expect(service.estimateSize('data:image/png;base64,AAAA'))
      .rejects.toThrow(/Original background bytes are unavailable/);
  });

  test('size estimation counts the retained data URL text and never touches canvas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('window.playerReady = true;'),
    }));
    const canvasEncoding = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL');
    const service = new HTMLExportService();

    const estimate = await service.estimateSize(PIXEL_PNG);

    expect(estimate.bytes).toBe(150000 + new TextEncoder().encode(PIXEL_PNG).length);
    expect(canvasEncoding).not.toHaveBeenCalled();
  });
});

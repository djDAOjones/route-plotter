import { afterEach, describe, expect, test, vi } from 'vitest';
import { HTMLExportService } from '../src/services/HTMLExportService.js';

afterEach(() => {
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
});

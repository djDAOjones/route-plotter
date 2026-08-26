import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test, expect, vi, afterEach } from 'vitest';
import { InteractionHandler } from '../src/handlers/InteractionHandler.js';
import { setupDocumentCommands } from '../src/app/wiringControllers.js';
import { playbackMixin } from '../src/app/playback.js';
import { viewportMixin } from '../src/app/viewport.js';
import { UIController } from '../src/controllers/UIController.js';
import { initDropdown } from '../src/components/Dropdown.js';
import { getSplashHelpHTML } from '../src/config/helpContent.js';
import { getDefaultBindings } from '../src/config/keybindings.js';
import { EventBus } from '../src/core/EventBus.js';
import { createFocusTrap } from '../src/utils/focusTrap.js';

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const mainCss = readFileSync(resolve(process.cwd(), 'styles/main.css'), 'utf8');
const wiringDomSource = readFileSync(resolve(process.cwd(), 'src/app/wiringDom.js'), 'utf8');
const uiControllerSource = readFileSync(resolve(process.cwd(), 'src/controllers/UIController.js'), 'utf8');
const mainSource = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');
const projectResetSource = readFileSync(resolve(process.cwd(), 'src/app/projectReset.js'), 'utf8');
const privacySource = readFileSync(resolve(process.cwd(), 'src/app/privacy.js'), 'utf8');

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('review remediation keyboard path', () => {
  test('plain Tab remains a browser focus command and Space emits once from non-controls', () => {
    document.body.innerHTML = '<button id="native">Native button</button><div id="workspace"></div>';
    const bus = new EventBus();
    const toggle = vi.fn();
    const adjacent = vi.fn();
    bus.on('ui:animation:toggle', toggle);
    bus.on('waypoint:select-adjacent', adjacent);

    const context = {
      eventBus: bus,
      isEditingNetwork: false,
      selectedWaypoint: null,
      zoomLevel: 1
    };
    const dispatch = (target, key) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      target.addEventListener('keydown', e => {
        InteractionHandler.prototype.handleKeyDown.call(context, e);
      }, { once: true });
      target.dispatchEvent(event);
      return event;
    };

    const workspace = document.getElementById('workspace');
    const nativeButton = document.getElementById('native');
    expect(dispatch(workspace, 'Tab').defaultPrevented).toBe(false);
    expect(adjacent).not.toHaveBeenCalled();

    expect(dispatch(workspace, ' ').defaultPrevented).toBe(true);
    expect(toggle).toHaveBeenCalledTimes(1);

    expect(dispatch(nativeButton, ' ').defaultPrevented).toBe(false);
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  test('document shortcuts remain suspended until startup recovery completes', () => {
    const bus = new EventBus();
    const toggle = vi.fn();
    bus.on('ui:animation:toggle', toggle);
    const context = {
      enabled: false,
      eventBus: bus,
      isEditingNetwork: false,
      selectedWaypoint: null,
      zoomLevel: 1,
    };
    const event = new KeyboardEvent('keydown', {
      key: ' ', bubbles: true, cancelable: true,
    });

    InteractionHandler.prototype.handleKeyDown.call(context, event);

    expect(event.defaultPrevented).toBe(false);
    expect(toggle).not.toHaveBeenCalled();
  });

  test('Undo, Redo and Save use one command route for shortcuts and buttons', () => {
    document.body.innerHTML = `
      <button id="undo">Undo</button>
      <button id="redo">Redo</button>
      <button id="save">Save</button>
    `;
    const bus = new EventBus();
    const app = {
      eventBus: bus,
      elements: {
        undoBtn: document.getElementById('undo'),
        redoBtn: document.getElementById('redo'),
        saveProjectBtn: document.getElementById('save'),
      },
      undo: vi.fn(),
      redo: vi.fn(),
      requestProjectSave: vi.fn(),
    };
    setupDocumentCommands(app);

    const context = {
      eventBus: bus,
      isEditingNetwork: false,
      selectedWaypoint: null,
      zoomLevel: 1,
    };
    const command = (key, options = {}) => {
      const event = new KeyboardEvent('keydown', {
        key,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        ...options,
      });
      InteractionHandler.prototype.handleKeyDown.call(context, event);
      expect(event.defaultPrevented).toBe(true);
    };

    command('z');
    command('z', { shiftKey: true });
    command('s');
    expect(app.undo).toHaveBeenCalledTimes(1);
    expect(app.redo).toHaveBeenCalledTimes(1);
    expect(app.requestProjectSave).toHaveBeenCalledTimes(1);

    app.elements.undoBtn.click();
    app.elements.redoBtn.click();
    app.elements.saveProjectBtn.click();
    expect(app.undo).toHaveBeenCalledTimes(2);
    expect(app.redo).toHaveBeenCalledTimes(2);
    expect(app.requestProjectSave).toHaveBeenCalledTimes(2);
  });

  test('Tab waypoint bindings no longer appear in configuration or Help', () => {
    const bindings = Object.values(getDefaultBindings().keyboard);
    expect(bindings.some(binding => binding.key === 'Tab')).toBe(false);
    expect(getSplashHelpHTML()).not.toContain('Select next waypoint');
    expect(getSplashHelpHTML()).not.toContain('Select previous waypoint');
  });

  test('Help disclosure keeps native Summary Tab and Space behaviour', () => {
    document.body.innerHTML = `
      <div id="splash" role="dialog" aria-modal="true" aria-labelledby="splash-title">
        <button id="splash-close-x" type="button">Close</button>
        <h2 id="splash-title">Help</h2>
        <div id="splash-help">${getSplashHelpHTML()}</div>
        <button id="splash-close" type="button">Get Started</button>
      </div>
    `;
    const modal = document.getElementById('splash');
    const summary = modal.querySelector('summary');
    const bus = new EventBus();
    const toggle = vi.fn();
    bus.on('ui:animation:toggle', toggle);
    const context = {
      eventBus: bus,
      isEditingNetwork: false,
      selectedWaypoint: null,
      zoomLevel: 1
    };
    const trap = createFocusTrap(modal);
    const dispatch = (key) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      summary.addEventListener('keydown', e => {
        InteractionHandler.prototype.handleKeyDown.call(context, e);
      }, { once: true });
      summary.dispatchEvent(event);
      return event;
    };

    trap.activate(summary);
    expect(document.activeElement).toBe(summary);
    expect(dispatch(' ').defaultPrevented).toBe(false);
    expect(toggle).not.toHaveBeenCalled();
    expect(dispatch('Tab').defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(summary);
    trap.deactivate();
  });
});

describe('modal focus management', () => {
  test('focus trap inerts the background, wraps focus, handles Escape, and restores focus', () => {
    document.body.innerHTML = `
      <main id="app"><button id="opener" type="button">Open</button></main>
      <div id="modal" role="dialog" aria-modal="true" style="display:flex">
        <h2 id="modal-title-test">Confirm</h2>
        <button id="cancel" type="button">Cancel</button>
        <button id="confirm" type="button">Confirm</button>
      </div>
    `;
    const opener = document.getElementById('opener');
    const modal = document.getElementById('modal');
    const title = document.getElementById('modal-title-test');
    const cancel = document.getElementById('cancel');
    const confirm = document.getElementById('confirm');
    const app = document.getElementById('app');
    const trap = createFocusTrap(modal);

    opener.focus();
    trap.activate();
    expect(document.activeElement).toBe(title);
    expect(app.hasAttribute('inert')).toBe(true);

    const shiftTab = new KeyboardEvent('keydown', {
      key: 'Tab', shiftKey: true, bubbles: true, cancelable: true
    });
    title.dispatchEvent(shiftTab);
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(confirm);

    confirm.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    confirm.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(cancel);

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    cancel.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(trap.isActive).toBe(false);
    expect(app.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  test('Clear confirmation restores the File trigger after its menu item is hidden', async () => {
    document.body.innerHTML = `
      <main id="app">
        <div class="dropdown" id="file-dropdown">
          <button class="dropdown-toggle" id="file-dropdown-btn" type="button">File</button>
          <div class="dropdown-menu" id="file-menu">
            <button id="clear-btn" role="menuitem" type="button">Clear All</button>
          </div>
        </div>
      </main>
      <div id="clear-confirm-modal" role="dialog" aria-modal="true" style="display:none">
        <h3 id="modal-title-clear">Clear all waypoints?</h3>
        <button id="clear-cancel" type="button">Cancel</button>
        <button id="clear-confirm" type="button">Clear</button>
      </div>
    `;
    const dropdown = document.getElementById('file-dropdown');
    const fileBtn = document.getElementById('file-dropdown-btn');
    const clearBtn = document.getElementById('clear-btn');
    const cancelBtn = document.getElementById('clear-cancel');
    const modal = document.getElementById('clear-confirm-modal');
    const bus = new EventBus();
    new UIController({ clearBtn }, bus);
    // App order is significant: UIController is constructed before dropdowns.
    initDropdown(dropdown);

    fileBtn.click();
    expect(document.activeElement).toBe(clearBtn);
    clearBtn.click();
    await Promise.resolve();
    expect(modal.style.display).toBe('flex');
    expect(document.getElementById('file-menu').getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement).toBe(cancelBtn);
    expect(document.getElementById('app').hasAttribute('inert')).toBe(true);

    cancelBtn.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    }));
    expect(modal.style.display).toBe('none');
    expect(document.activeElement).toBe(fileBtn);
    expect(document.getElementById('app').hasAttribute('inert')).toBe(false);
  });
});

describe('render and static UI regressions', () => {
  test('an unchanged latched paused state does not render every engine tick', () => {
    let update;
    const context = {
      _isExportMode: false,
      displayWidth: 1000,
      displayHeight: 600,
      animationEngine: {
        start: vi.fn(callback => { update = callback; }),
        isPlaying: vi.fn(() => false)
      },
      cameraService: null,
      render: vi.fn(),
      syncUIWithAnimationState: vi.fn()
    };
    const pausedState = {
      progress: 0.5,
      isPlaying: true,
      isPaused: true,
      isWaitingAtWaypoint: false
    };

    playbackMixin.startRenderLoop.call(context);
    update(pausedState);
    update(pausedState);
    expect(context.render).toHaveBeenCalledTimes(1);

    context.animationEngine.isPlaying.mockReturnValue(true);
    update(pausedState);
    expect(context.render).toHaveBeenCalledTimes(2);
  });

  test('viewport reflow clears the desktop inline controls width', () => {
    document.body.innerHTML = `
      <div id="canvas-area">
        <canvas id="canvas"></canvas>
        <div class="controls" style="width:800px"></div>
      </div>
    `;
    const container = document.getElementById('canvas-area');
    const canvas = document.getElementById('canvas');
    const controls = container.querySelector('.controls');
    Object.defineProperties(container, {
      clientWidth: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 600 }
    });
    Object.defineProperty(controls, 'offsetHeight', { configurable: true, value: 60 });
    vi.stubGlobal('matchMedia', vi.fn(query => ({
      matches: query === '(max-width: 64rem)'
    })));
    const context = {
      exportSettings: { resolutionX: 16, resolutionY: 9 },
      canvas,
      ctx: {
        setTransform: vi.fn(),
        scale: vi.fn(),
        imageSmoothingEnabled: false,
        imageSmoothingQuality: 'low'
      },
      coordinateTransform: { setCanvasDimensions: vi.fn() },
      background: { image: null },
      waypoints: [],
      render: vi.fn()
    };

    viewportMixin.updateCanvasAspectRatio.call(context);

    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 64rem)');
    expect(controls.style.width).toBe('');
    expect(context.coordinateTransform.setCanvasDimensions).toHaveBeenCalledWith(800, 450);
  });

  test('static shell exposes named transport controls, native waypoint list, and tracked Courts image', () => {
    for (const [id, label] of [
      ['skip-start-btn', 'Skip to start'],
      ['play-btn', 'Play'],
      ['pause-btn', 'Pause'],
      ['skip-end-btn', 'Skip to end']
    ]) {
      expect(indexHtml).toMatch(new RegExp(`id="${id}"[^>]*aria-label="${label}"`));
    }
    expect(indexHtml).toContain('<ul id="waypoint-list"');
    expect(indexHtml).toContain('data-image="images/Court.png"');
    expect(indexHtml).not.toContain('images/Courts.jpg');
    expect(indexHtml).not.toContain('id="screen-warning"');
    expect(indexHtml).not.toContain('image/svg+xml');
    expect(indexHtml).not.toContain('image/gif');
    expect(indexHtml.match(/accept="image\/png,image\/jpeg,image\/webp"/g)).toHaveLength(3);
  });

  test('support hand-off is visible, preview-first and fixed to the governed Issues route', () => {
    expect(indexHtml).toMatch(/<button id="report-bug-btn"[^>]*>Report a bug<\/button>/);
    expect(indexHtml).not.toMatch(/id="report-bug-btn"[^>]*aria-label=/);
    expect(indexHtml).toContain('GitHub Issues are public.');
    expect(indexHtml).toContain('Support is best effort, with no guaranteed response time.');
    expect(indexHtml).toContain('Report suspected vulnerabilities through');
    expect(indexHtml).toMatch(/<a id="diagnostics-open-issues"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*hidden>Open GitHub Issues in new tab<\/a>/);
    expect(indexHtml).toMatch(/<a id="diagnostics-open-security"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*hidden>/);
    expect(indexHtml).toContain('id="diagnostics-copy-issues-address"');
    expect(indexHtml).not.toContain('GitHub Issues in this tab');
    expect(indexHtml).not.toContain('href="https://github.com/djDAOjones/route-plotter/issues"');
    expect(privacySource).toContain(
      "GITHUB_ISSUES_URL = 'https://github.com/djDAOjones/route-plotter/issues'"
    );
    expect(privacySource).toContain(
      "'https://github.com/djDAOjones/route-plotter/security/advisories/new'"
    );
    expect(privacySource).not.toMatch(/GITHUB_ISSUES_URL\s*[+`]/);
    expect(mainCss).toMatch(/a\.btn-primary:visited\{\s*color:var\(--text-04\);/);
    expect(mainCss).toMatch(/\.diagnostics-modal-content\{[^}]*max-height:[^;]+;[^}]*overflow-y:auto;/s);
  });

  test('responsive rules target the real panels and retain a 320px layout', () => {
    expect(mainCss).toContain('@media (max-width: 80rem)');
    expect(mainCss).toContain('@media (max-width: 64rem)');
    expect(mainCss).toContain('@media (max-width: 30rem)');
    expect(mainCss).toMatch(/\.sidebar,\s*\.canvas-area,\s*\.sidebar-right/);
    expect(mainCss).not.toContain('.sidebar.right');
    expect(mainCss).not.toContain('.main-content');
    expect(mainCss).not.toContain('.playbar-container');
    expect(mainCss).toMatch(/#report-bug-btn,\s*\.header-controls > #help-btn/);
    expect(mainCss).toMatch(/\.diagnostics-actions\{\s*flex-wrap:wrap;/);
    expect(mainCss).toMatch(/\.diagnostics-actions \.btn\{\s*flex:1 1 10rem;/);
  });

  test('background DOM controls have one owner', () => {
    expect(wiringDomSource).not.toContain('this.elements.bgUploadBtn.addEventListener');
    expect(wiringDomSource).not.toContain('this.elements.bgUpload.addEventListener');
    expect(wiringDomSource).not.toContain('this.elements.bgOverlay.addEventListener');
    expect(wiringDomSource).not.toContain('this.elements.bgFitToggle?.addEventListener');
    expect(wiringDomSource).toContain('Background DOM controls are owned exclusively by UIController');
  });

  test('Clear All cancels recovery and creates one empty undo baseline', () => {
    const clearAllBody = mainSource.match(/clearAll\(\) \{([\s\S]*?)\n  \}\n\s+showSplash\(\)/)?.[1] || '';
    expect(clearAllBody).toContain('clearProject(this)');
    expect(projectResetSource).toContain('invalidateProjectOperations(app)');
    expect(projectResetSource).toContain('app.imageAssetService.clear()');
    expect(projectResetSource).toContain('app.background.image = null');
    expect(projectResetSource).toContain('app.undoService.reset(app._getUndoableState())');
    expect(projectResetSource).toContain('app.storageService.clearAutoSave()');
    expect(projectResetSource).not.toContain('app.autoSave()');
  });

  test('custom-image uploads decode detached and reject stale project completions', () => {
    expect(wiringDomSource).toContain("beginAsyncProjectOperation(this, 'marker-image')");
    expect(wiringDomSource).toContain("beginAsyncProjectOperation(this, 'path-head-image')");
    expect(wiringDomSource.match(/ImageAsset\.fromFile\(file\)/g)).toHaveLength(2);
    expect(wiringDomSource.match(/isAsyncProjectOperationCurrent\(this, token\)/g).length).toBeGreaterThanOrEqual(4);
    expect(wiringDomSource).not.toContain('await this.imageAssetService.addFromFile(file)');
  });

  test('image inputs reset so the same file can be selected again', () => {
    expect(uiControllerSource).toMatch(/const file = e\.target\.files\[0\];\s+e\.target\.value = '';/);
    expect(wiringDomSource.match(/e\.target\.value = '';/g).length).toBeGreaterThanOrEqual(2);
  });
});

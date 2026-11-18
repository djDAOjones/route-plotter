import { Emitter } from '../models/Emitter.js';
import { sceneOutlineKey } from '../utils/sceneSemantics.js';
import {
  assertWaitingSettings, waitingUnavailableReason, WAITING_HINT, WAITING_FIELD_HINT,
} from '../utils/waitingSettings.js';
import { addDescription, clearFieldError, showFieldError } from '../utils/uiReadouts.js';
import { stageProjectModel, prepareCheckedProjectEdit, projectEditError } from './persistence.js';
import { finishRenderReference } from './finishContexts.js';

/** App-owned provisional waiting forms and their checked durable acceptance. */
export const crowdWaitingMixin = {
  _waitingContext(layer, emitter) {
    this._waitingContexts ??= new WeakMap();
    let record = this._waitingContexts.get(emitter);
    if (!record || record.layer !== layer || record.value !== emitter.waitAtStart) {
      this._waitingContextSerial = (this._waitingContextSerial || 0) + 1;
      record = { layer, value: emitter.waitAtStart, token: `waiting-${this._waitingContextSerial}` };
      this._waitingContexts.set(emitter, record);
    }
    return record.token;
  },

  _waitingOutlineContexts() {
    const contexts = new Map();
    for (const layer of this.scene.getFlowLayers()) for (const emitter of layer.emitters) {
      contexts.set(`${sceneOutlineKey('emitter', layer.id, emitter.id)}:waiting-apply`, {
        context: this._waitingContext(layer, emitter), waitAtStart: emitter.waitAtStart,
      });
    }
    return contexts;
  },

  _captureWaitingCardDraft() {
    const record = this._waitingCardRecord, form = document.getElementById('crowd-wait-form');
    if (!record || !form) return;
    record.value = form.elements.waitAtStart.checked;
    this._waitingCardDrafts.set(record.emitter, record);
  },

  _hasPendingWaitingDrafts(exemption = null) {
    this._captureWaitingCardDraft();
    for (const [emitter, record] of this._waitingCardDrafts || []) {
      if (this.scene.getFlowLayer(record.layer.id) !== record.layer || !record.layer.emitters.includes(emitter)
          || this._waitingContext(record.layer, emitter) !== record.context) {
        this._waitingCardDrafts.delete(emitter); continue;
      }
      if (exemption && (record.layer !== exemption.layer || emitter !== exemption.emitter
          || exemption.surface === 'card')) continue;
      if (record.value !== emitter.waitAtStart) return true;
    }
    const outlineExemption = exemption ? {
      formKey: `${sceneOutlineKey('emitter', exemption.layer.id, exemption.emitter.id)}:waiting-apply`,
      surface: exemption.surface,
    } : null;
    return !!this.sceneOutlineController?.pendingWaitingDrafts?.(
      this._waitingOutlineContexts(), outlineExemption)?.length;
  },

  _setupCrowdWaitingControls() {
    this._waitingCardDrafts = new Map();
    const form = document.getElementById('crowd-wait-form');
    if (!form) return;
    document.getElementById('crowd-wait-hint').textContent = WAITING_HINT;
    form.querySelector('[data-tip]').setAttribute('data-tip', WAITING_FIELD_HINT);
    form.addEventListener('input', () => this._captureWaitingCardDraft());
    form.addEventListener('change', () => this._captureWaitingCardDraft());
    form.addEventListener('submit', event => {
      event.preventDefault();
      const record = this._waitingCardRecord;
      if (!record || !form.reportValidity()) return;
      this._captureWaitingCardDraft();
      try {
        this._setEmitterWaiting(record.layer, record.emitter, record.value, record.context, 'card');
        record.error = ''; this._waitingCardDrafts.delete(record.emitter);
        this._waitingCardRecord = null; this._syncCrowdWaitingControls();
      } catch (failure) {
        record.error = failure.message;
        showFieldError(form.elements.waitAtStart, document.getElementById('crowd-wait-error'), record.error);
        this.announce(record.error, { essential: true });
        form.elements.waitAtStart.focus();
      }
    });
    document.getElementById('crowd-wait-cancel').addEventListener('click', () => {
      const record = this._waitingCardRecord;
      if (record) this._waitingCardDrafts.delete(record.emitter);
      this._waitingCardRecord = null; this._syncCrowdWaitingControls();
    });
    form.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      document.getElementById('crowd-wait-cancel').click();
      form.querySelector('[type="submit"]').focus();
    });
    const reset = () => {
      this._waitingCardDrafts.clear(); this._waitingCardRecord = null; this._syncCrowdWaitingControls();
    };
    this.eventBus.on('project:replaced', reset); this.eventBus.on('app:cleared', reset);
    for (const name of ['crowd:param-changed', 'network:changed', 'scene:semantic-changed']) {
      this.eventBus.on(name, () => this._syncCrowdWaitingControls());
    }
  },

  _syncCrowdWaitingControls() {
    const form = document.getElementById('crowd-wait-form');
    if (!form) return;
    this._captureWaitingCardDraft();
    for (const [owner, record] of this._waitingCardDrafts) {
      if (this.scene.getFlowLayer(record.layer.id) !== record.layer || !record.layer.emitters.includes(owner)) {
        this._waitingCardDrafts.delete(owner);
      }
    }
    const layer = this.selectedCrowd, emitter = layer?.emitters[0];
    const field = form.elements.waitAtStart, error = document.getElementById('crowd-wait-error');
    const line = document.getElementById('crowd-wait-reason');
    if (!emitter) {
      this._waitingCardRecord = null; field.checked = false; field.disabled = true;
      form.querySelector('[type="submit"]').disabled = true;
      line.textContent = ''; line.hidden = true; clearFieldError(field, error);
      return;
    }
    const context = this._waitingContext(layer, emitter);
    let record = this._waitingCardDrafts.get(emitter);
    if (!record || record.layer !== layer || record.context !== context) {
      record = { layer, emitter, context, value: emitter.waitAtStart, error: '' };
    }
    this._waitingCardDrafts.set(emitter, record); this._waitingCardRecord = record;
    field.checked = record.value;
    const reason = waitingUnavailableReason(layer, emitter);
    // A pending-on or refused draft must remain clearable when prerequisites disappear.
    const disabled = !!reason && !emitter.waitAtStart && !record.value && !record.error;
    field.disabled = disabled; form.querySelector('[type="submit"]').disabled = disabled;
    line.textContent = reason ? `${emitter.waitAtStart ? 'Stored on. ' : record.value ? 'Unapplied on. ' : ''}`
      + reason + (emitter.waitAtStart || record.value
        ? ' Turn off or use Cancel edits to restore the stored setting.' : '') : '';
    line.hidden = !line.textContent;
    addDescription(field, 'crowd-wait-reason', { first: true });
    addDescription(field, 'crowd-wait-hint', { first: true });
    if (record.error) showFieldError(field, error, record.error); else clearFieldError(field, error);
    this._syncGroupRoleHints?.();
  },

  _setEmitterWaiting(layer, emitter, value, context, surface) {
    if (this.scene.getFlowLayer(layer?.id) !== layer || !layer.emitters.includes(emitter)
        || context !== this._waitingContext(layer, emitter)) {
      throw new Error('Final whistle changed. Reopen this panel and try again.');
    }
    assertWaitingSettings({ waitAtStart: value });
    const reason = waitingUnavailableReason(layer, emitter);
    if (value && reason) throw new Error(reason);
    if (value === emitter.waitAtStart) return false;
    const exemption = { layer, emitter, surface, kind: 'waiting' };
    if (this._hasPendingWaitingDrafts(exemption)) {
      throw new Error(`The ${surface === 'card' ? 'scene outline' : 'crowd card'} has an unapplied edit. `
        + 'Use Apply final whistle or Cancel edits there, then try again.');
    }
    this._assertCrowdDuplicateReady(exemption);
    const candidate = this._buildProjectSnapshot({ includeAssets: false });
    const saved = candidate.scene.flowLayers.find(item => item.id === layer.id);
    const next = Emitter.fromJSON({ ...emitter.toJSON(), waitAtStart: value });
    saved.emitters[saved.emitters.findIndex(item => item.id === emitter.id)] = next.toJSON();
    let checked;
    try {
      const staged = stageProjectModel(candidate);
      candidate.renderReference = finishRenderReference(
        staged.scene, candidate.renderReference, candidate.timingReference);
      checked = prepareCheckedProjectEdit(this, candidate, 'saving Final whistle');
    } catch (failure) { throw projectEditError('Final whistle unchanged', failure); }
    this._flushPendingUndo();
    emitter.update({ waitAtStart: value }); this.renderReference = checked.candidate.renderReference;
    this._waitingCardDrafts.delete(emitter);
    if (this._waitingCardRecord?.emitter === emitter) this._waitingCardRecord = null;
    this.saveUndoState(); this.autoSave(); this.queueRender();
    this._syncCrowdWaitingControls(); this._syncCrowdGroupControls(); this._syncCrowdLifecycleHint();
    this._syncNodeAreaCard?.(); this._refreshGroupNetworkHints?.();
    this.scheduleSceneEnd?.(); this._queueSceneOutlineRefresh();
    this.announce('Final whistle updated. Undo is available.');
    return true;
  },
};

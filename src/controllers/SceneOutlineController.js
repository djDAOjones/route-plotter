/**
 * Accessible DOM view of the complete authored scene.
 *
 * Native details/lists/forms keep browser keyboard semantics intact. The
 * controller owns no project data: it renders plain snapshots and emits
 * stable-ID commands through EventBus.
 */

import { sceneOutlineKey } from '../utils/sceneSemantics.js';
import { IMAGE_COORDINATES } from '../config/constants.js';

const OUTLINE_CANONICAL_VALUE = Symbol('outlineCanonicalValue');
const OUTLINE_DRAFT_CONTEXT = Symbol('outlineDraftContext');
const OUTLINE_ERROR_ID_PREFIX = 'scene-outline-error-';

// Waypoints and polygon vertices may sit off the image (DEF-03), as far as a
// project can store a point, so their position fields take that range; 0–100%
// is the image itself (DEF-35). Network nodes and bend points are authored on
// the image and keep 0–100.
const IMAGE_POSITION_PERCENT = Object.freeze({
  min: IMAGE_COORDINATES.MIN * 100,
  max: IMAGE_COORDINATES.MAX * 100,
});

/**
 * A bend point's position field: 0–100%, and the value it holds. A traced
 * bend sits where its minor waypoint is, which may be off the image (DEF-41);
 * left as it is, the app keeps it, and a new value is held to the image.
 */
function bendPercentRange(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return { min: 0, max: 100 };
  return { min: Math.min(0, number), max: Math.max(100, number) };
}

/**
 * Each field's hint (UI-03), in the outline's own words. ParamTooltip wires a
 * label's `data-tip` as its field's description as the form is drawn, and
 * shows it on hover, click and keyboard focus, as in the inspector.
 */
const FIELD_HINTS = Object.freeze({
  // Waypoints and polygon vertices may sit off the image; nodes and bend
  // points are placed on it (see IMAGE_POSITION_PERCENT above).
  imageX: '0% is the image’s left edge, 100% its right edge; beyond them is off the image',
  imageY: '0% is the image’s top edge, 100% its bottom edge; beyond them is off the image',
  onImageX: '0% is the image’s left edge, 100% its right edge',
  onImageY: '0% is the image’s top edge, 100% its bottom edge',
  newWaypointX: 'Where the new waypoint goes: 0% is the image’s left edge, 100% its right edge; ' +
    'beyond them is off the image',
  newWaypointY: 'Where the new waypoint goes: 0% is the image’s top edge, 100% its bottom edge; ' +
    'beyond them is off the image',
  newVertexX: 'Where the new vertex goes, after the last one: 0% is the image’s left edge, 100% its right ' +
    'edge; beyond them is off the image',
  newVertexY: 'Where the new vertex goes, after the last one: 0% is the image’s top edge, 100% its bottom ' +
    'edge; beyond them is off the image',
  newNodeX: 'Where the new node goes: 0% is the image’s left edge, 100% its right edge',
  newNodeY: 'Where the new node goes: 0% is the image’s top edge, 100% its bottom edge',
  newBendX: 'Where the new bend goes, after the last one: 0% is the image’s left edge, 100% its right edge',
  newBendY: 'Where the new bend goes, after the last one: 0% is the image’s top edge, 100% its bottom edge',
  insertPosition: 'Where the new waypoint goes in the route order: at the start, or after the waypoint chosen',
  waypointType: 'Major waypoints carry a wait and a leg speed; minor waypoints only shape the ' +
    'route between them',
  wait: 'How long the path head waits at this waypoint before moving on',
  legSpeed: 'How fast the path head travels the leg after this waypoint: 2 takes half the time, ' +
    '0.5 twice as long',
  fadeIn: 'How long the polygon takes to fade in when it appears',
  fadeOut: 'How long the polygon takes to fade out when it disappears',
  crowdName: 'The crowd’s name in Layers and in this outline',
  crowdVisibility: 'Hidden crowds are not drawn, in the editor or in exports; their settings are kept',
  guide: 'What the dots travel along: the route, or a custom network of nodes and paths',
  dots: 'How many dots this crowd releases in all',
  releaseStart: 'When the first dots set off, as a percentage of the timeline',
  releaseLength: 'How much of the timeline, as a percentage, the release is spread across',
  releaseTiming: 'How unevenly dots set off: 0% evenly spaced, 100% at random. Release bias and Busyness ' +
    'over time then shift set-offs, so 0% is even only with bias 0 and even busyness',
  // The bias bends set-offs towards the start below 0, the end above it
  // (dotOnsetFraction in src/utils/crowdArrival.js).
  releaseBias: 'Below 0 is earlier: more dots set off near the start of the release; above 0 is later, ' +
    'near its end; 0 favours neither',
  speed: 'How fast the dots travel, in image lengths per second: at 1, a dot covers the image’s width across ' +
    'or its height down in about a second; Pace variation makes some faster and some slower',
  paceVariation: 'How much each dot’s pace differs: 0% moves every dot at the same speed',
  dotSize: 'Dot size, scaled with the image like other elements',
  walkingVariation: 'Sideways walking variation as dots travel: 0% follows the line exactly',
  dotColour: 'A hex colour such as #56B4E9, or transparent to hide the dots',
  journeyEnd: 'What a dot does when it reaches the end of its journey',
  nodeType: 'Entry nodes release dots and exit nodes end their journeys; pass-through nodes pass them on, or ' +
    'end them where no path leads out. With no exit, journeys end at nodes with one path; with no ' +
    'entry, dots set off from any node they can leave',
  nodeLabel: 'An optional name, shown after the node’s number in this outline',
  sourceNode: 'The node the new path leaves; a one-way path carries dots only away from it',
  destinationNode: 'The node the new path leads to',
  newEdgeDirection: 'Two-way paths carry dots both ways; one-way paths only from Source node to Destination node',
  edgeDirection: 'Two-way paths carry dots both ways; one-way paths only from the first node in the path’s ' +
    'name to the second',
  pathWeight: 'How strongly dots prefer this path at a node where paths meet: between the paths a dot can take, ' +
    'weight 2 is twice as likely to be picked as weight 1. Arriving dots avoid turning straight back when ' +
    'another path is available',
});

/** What a dot does at its journey's end, as the Motion card says it (UI-06 J-02). */
const JOURNEY_END_LABELS = Object.freeze({
  respawn: 'Respawn at the start',
  loop: 'Repeat journey',
  disappear: 'Disappear',
  collect: 'Collect at the end',
});

function el(tag, { className = '', text = '', attrs = {}, data = {} } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = String(text);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (value === true) node.setAttribute(name, '');
    else node.setAttribute(name, String(value));
  }
  for (const [name, value] of Object.entries(data)) {
    if (value != null) node.dataset[name] = String(value);
  }
  return node;
}

function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function button(label, action, data = {}, { danger = false, disabled = false, key = null } = {}) {
  return el('button', {
    className: `btn btn-secondary scene-outline-action${danger ? ' scene-outline-danger' : ''}`,
    text: label,
    attrs: { type: 'button', disabled },
    data: { outlineAction: action, outlineKey: key, ...data },
  });
}

function labelledInput(name, label, value, {
  type = 'number', min = null, max = null, step = null, required = true,
  key = null, inputMode = 'decimal', readOnly = false,
  canonicalValue = undefined, maxLength = null, tip = null,
} = {}) {
  const wrapper = el('label', { className: 'scene-outline-field' });
  wrapper.appendChild(el('span', { text: label, attrs: { 'data-tip': tip } }));
  const input = el('input', {
    attrs: {
      name, type, min, max, step, required, inputmode: inputMode,
      readonly: readOnly, maxlength: maxLength,
    },
    data: { outlineKey: key },
  });
  if (canonicalValue !== undefined) input[OUTLINE_CANONICAL_VALUE] = canonicalValue;
  input.value = String(value);
  // Text inputs normalise CR/LF while assigning `.value`. Treat that actual
  // control value as the unchanged display form, while retaining the raw
  // canonical value separately for lossless combined-form updates.
  input.defaultValue = input.value;
  wrapper.appendChild(input);
  return wrapper;
}

function labelledSelect(name, label, value, options, { key = null, tip = null } = {}) {
  const wrapper = el('label', { className: 'scene-outline-field' });
  wrapper.appendChild(el('span', { text: label, attrs: { 'data-tip': tip } }));
  const select = el('select', { attrs: { name }, data: { outlineKey: key } });
  for (const option of options) {
    const item = typeof option === 'string' ? { value: option, label: option } : option;
    const optionEl = el('option', {
      text: item.label,
      attrs: { value: item.value, disabled: item.disabled },
    });
    if (String(item.value) === String(value)) {
      optionEl.selected = true;
      optionEl.defaultSelected = true;
    }
    select.appendChild(optionEl);
  }
  wrapper.appendChild(select);
  return wrapper;
}

function form(action, data, fields, submitLabel = 'Apply', key = null, draftContext = null) {
  const node = el('form', {
    className: 'scene-outline-form',
    data: { outlineAction: action, outlineFormKey: key, ...data },
  });
  if (draftContext !== null) node[OUTLINE_DRAFT_CONTEXT] = draftContext;
  const grid = el('div', { className: 'scene-outline-field-grid' });
  fields.forEach(field => grid.appendChild(field));
  node.appendChild(grid);
  node.appendChild(el('button', {
    className: 'btn btn-primary scene-outline-submit',
    text: submitLabel,
    attrs: { type: 'submit' },
    data: { outlineKey: key },
  }));
  return node;
}

function detailsBlock(key, summaryText, open, className = '') {
  const details = el('details', {
    className: `scene-outline-details ${className}`.trim(),
    data: { outlineDisclosure: key },
  });
  details.open = open;
  details.appendChild(el('summary', {
    className: 'scene-outline-summary',
    text: summaryText,
    data: { outlineKey: `${key}:summary` },
  }));
  return details;
}

function itemFor(details) {
  const item = el('li', { className: 'scene-outline-item' });
  item.appendChild(details);
  return item;
}

function description(text) {
  return el('p', { className: 'scene-outline-hint', text });
}

function readOnlyList(entries) {
  const list = el('dl', { className: 'scene-outline-readonly' });
  for (const [term, value] of entries) {
    list.append(el('dt', { text: term }), el('dd', { text: value }));
  }
  return list;
}

function areaContainsKey(area, key) {
  return key === area.key || area.points.some(point => key === point.key);
}

function waypointContainsKey(waypoint, key) {
  return key === waypoint.key || areaContainsKey(waypoint.area, key);
}

function edgeContainsKey(edge, key) {
  return key === edge.key || edge.controlPoints.some(point => key === point.key);
}

function networkContainsKey(graph, key) {
  return key === graph.key
    || graph.nodes.some(node => key === node.key)
    || graph.edges.some(edge => edgeContainsKey(edge, key));
}

function crowdContainsKey(crowd, key) {
  return key === crowd.key
    || crowd.emitters.some(emitter => key === emitter.key)
    || networkContainsKey(crowd.graph, key);
}

export class SceneOutlineController {
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    this._open = new Map();
    this._snapshot = null;
    // The selection last revealed, and whether the render under way reveals
    // a new one (set as each render starts).
    this._revealedSelection = null;
    this._revealing = false;
    this._error = null;
    this._errorSerial = 0;
    this._drafts = new Map();

    this._unsubscribes = [
      this.eventBus.on('scene-outline:update', snapshot => this.render(snapshot)),
      this.eventBus.on('scene-outline:error', error => this._showCommandError(error)),
      this.eventBus.on('scene-outline:accepted', result => this._acceptCommand(result)),
      this.eventBus.on('project:replaced', () => this._resetDrafts()),
      this.eventBus.on('app:cleared', () => this._resetDrafts()),
    ];
    this._boundSubmit = event => this._onSubmit(event);
    this._boundClick = event => this._onClick(event);
    this._boundKeyDown = event => this._onKeyDown(event);
    this.container?.addEventListener('submit', this._boundSubmit);
    this.container?.addEventListener('click', this._boundClick);
    this.container?.addEventListener('keydown', this._boundKeyDown);
  }

  destroy() {
    this._unsubscribes.forEach(unsubscribe => unsubscribe?.());
    this.container?.removeEventListener('submit', this._boundSubmit);
    this.container?.removeEventListener('click', this._boundClick);
    this.container?.removeEventListener('keydown', this._boundKeyDown);
    this._drafts.clear();
  }

  _rememberOpenState() {
    for (const details of this.container.querySelectorAll('details[data-outline-disclosure]')) {
      this._open.set(details.dataset.outlineDisclosure, details.open);
    }
  }

  _isOpen(key, defaultOpen = false, selected = false) {
    // A new selection reveals its target, even inside a branch the author
    // collapsed. After that the author's own opening and closing win, so an
    // entry holding the selection closes like any other (DEF-40).
    if (selected && this._revealing) return true;
    return this._open.has(key) ? this._open.get(key) : defaultOpen;
  }

  _focusedKey() {
    const active = document.activeElement;
    return this.container?.contains(active) ? active?.dataset?.outlineKey || null : null;
  }

  _findKey(key) {
    if (!key) return null;
    return [...this.container.querySelectorAll('[data-outline-key]')]
      .find(node => node.dataset.outlineKey === key) || null;
  }

  _openFocusAncestry(snapshot) {
    const focus = snapshot?.focusKey;
    if (!focus) return;
    const within = key => focus === key || focus.startsWith(`${key}:`);
    const open = key => this._open.set(key, true);

    if (within('route')) open('route');
    for (const waypoint of snapshot.route) {
      const area = waypoint.area;
      const point = area.points.find(item => within(item.key));
      if (!within(waypoint.key) && !within(area.key) && !point) continue;
      open('route');
      open(waypoint.key);
      if (within(area.key) || point) open(area.key);
      if (point) open(point.key);
    }

    if (within('crowds')) open('crowds');
    for (const crowd of snapshot.crowds) {
      const emitter = crowd.emitters.find(item => within(item.key));
      const node = crowd.graph.nodes.find(item => within(item.key));
      const edge = crowd.graph.edges.find(item =>
        within(item.key) || item.controlPoints.some(point => within(point.key))
      );
      const control = edge?.controlPoints.find(point => within(point.key));
      const relevant = within(crowd.key) || emitter || within(crowd.graph.key) || node || edge;
      if (!relevant) continue;
      open('crowds');
      open(crowd.key);
      if (emitter) {
        open(sceneOutlineKey('emitters', crowd.id));
        open(emitter.key);
      }
      if (within(crowd.graph.key) || node || edge) open(crowd.graph.key);
      if (node) {
        open(sceneOutlineKey('nodes', crowd.id));
        open(node.key);
      }
      if (edge) {
        open(sceneOutlineKey('edges', crowd.id));
        open(edge.key);
      }
      if (control) {
        open(sceneOutlineKey('controls', crowd.id, edge.id));
        open(control.key);
      }
    }
  }

  /**
   * @param {Object} snapshot
   * @param {string|null} [disclosureFocus] - The summary an author just
   *   opened or closed, which keeps focus though focus was elsewhere
   */
  render(snapshot, disclosureFocus = null) {
    if (!this.container || !snapshot) return;
    const priorFocus = this._focusedKey();
    this._captureDirtyDrafts();
    this._pruneDrafts(snapshot);
    this._rememberOpenState();
    // A snapshot's selection is revealed, and its focus request met, once: a
    // redraw of the same snapshot replays neither, or the entries they opened
    // could never close and focus would leave what the author clicked (DEF-40).
    const selection = snapshot.selectionKey ?? null;
    this._revealing = selection !== this._revealedSelection;
    this._revealedSelection = selection;
    this._snapshot = snapshot.focusKey ? { ...snapshot, focusKey: null } : snapshot;
    this._openFocusAncestry(snapshot);

    const fragment = document.createDocumentFragment();
    fragment.append(this._renderRoute(snapshot), this._renderCrowds(snapshot));
    this.container.replaceChildren(fragment);
    this._restoreDirtyDrafts();
    this._renderCommandError();

    const requested = disclosureFocus || snapshot.focusKey || priorFocus;
    if (requested) {
      queueMicrotask(() => {
        const target = this._findKey(requested)
          || this._findKey(snapshot.selectionKey ? `${snapshot.selectionKey}:select` : null)
          || this._findKey('route:summary');
        let ancestor = target?.closest('details[data-outline-disclosure]');
        // A summary shows while its own entry is closed, so only the entries
        // around it are opened: opening its own reopened an entry the author
        // had just closed (DEF-40).
        if (ancestor && target.parentElement === ancestor && target.matches('summary')) {
          ancestor = ancestor.parentElement?.closest('details[data-outline-disclosure]');
        }
        while (ancestor) {
          ancestor.open = true;
          this._open.set(ancestor.dataset.outlineDisclosure, true);
          ancestor = ancestor.parentElement?.closest('details[data-outline-disclosure]');
        }
        target?.focus();
      });
    }
  }

  _selected(key) {
    return this._snapshot?.selectionKey === key;
  }

  _captureDirtyDrafts() {
    for (const formEl of this.container.querySelectorAll('form[data-outline-form-key]')) {
      const fields = new Map();
      for (const [index, field] of [...formEl.elements].entries()) {
        if (!field.name || field.disabled) continue;
        const fieldKey = field.dataset?.outlineKey || `${field.name}:${index}`;
        const checkable = field.type === 'checkbox' || field.type === 'radio';
        const dirty = checkable
          ? field.checked !== field.defaultChecked
          : field.value !== this._defaultFieldValue(field);
        if (!dirty) continue;
        fields.set(fieldKey, {
          name: field.name,
          value: field.value,
          checked: checkable ? field.checked : null,
        });
      }
      const formKey = formEl.dataset.outlineFormKey;
      if (fields.size) {
        this._drafts.set(formKey, {
          fields,
          context: formEl[OUTLINE_DRAFT_CONTEXT] ?? null,
        });
      }
      else this._drafts.delete(formKey);
    }
  }

  _restoreDirtyDrafts() {
    for (const [formKey, draft] of this._drafts) {
      const formEl = this._formForKey(formKey);
      if (!formEl) continue;
      if (draft.context !== null && formEl[OUTLINE_DRAFT_CONTEXT] !== draft.context) {
        this._drafts.delete(formKey);
        continue;
      }
      for (const [fieldKey, fieldDraft] of draft.fields) {
        const field = [...formEl.elements].find((candidate, index) =>
          candidate.dataset?.outlineKey === fieldKey
          || (!candidate.dataset?.outlineKey && `${candidate.name}:${index}` === fieldKey)
        );
        if (!field || field.name !== fieldDraft.name || field.disabled) continue;
        if (fieldDraft.checked !== null) field.checked = fieldDraft.checked;
        else if (field.tagName !== 'SELECT'
            || [...field.options].some(option => option.value === fieldDraft.value)) {
          field.value = fieldDraft.value;
        }
      }
    }
  }

  _pruneDrafts(snapshot) {
    const valid = new Set(['route:add-submit']);
    for (const waypoint of snapshot.route) {
      valid.add(`${waypoint.key}:apply`);
      if (waypoint.area.shape !== 'polygon') continue;
      valid.add(`${waypoint.area.key}:timing`);
      valid.add(`${waypoint.area.key}:add`);
      for (const point of waypoint.area.points) valid.add(`${point.key}:apply`);
    }
    for (const crowd of snapshot.crowds) {
      valid.add(`${crowd.key}:apply`);
      for (const emitter of crowd.emitters) {
        if (emitter.primary) valid.add(`${emitter.key}:apply`);
      }
      valid.add(`${crowd.graph.key}:add-node`);
      if (crowd.graph.nodes.length >= 2) valid.add(`${crowd.graph.key}:connect`);
      for (const node of crowd.graph.nodes) valid.add(`${node.key}:apply`);
      for (const edge of crowd.graph.edges) {
        valid.add(`${edge.key}:apply`);
        valid.add(`${edge.key}:add-control`);
        for (const point of edge.controlPoints) valid.add(`${point.key}:apply`);
      }
    }
    for (const formKey of this._drafts.keys()) {
      if (!valid.has(formKey)) this._drafts.delete(formKey);
    }
  }

  _defaultFieldValue(field) {
    if (field.tagName !== 'SELECT') return field.defaultValue;
    return [...field.options].find(option => option.defaultSelected)?.value
      ?? field.options[0]?.value
      ?? '';
  }

  _formForKey(key) {
    if (!key) return null;
    return [...this.container.querySelectorAll('form[data-outline-form-key]')]
      .find(formEl => formEl.dataset.outlineFormKey === key) || null;
  }

  _clearCommandError() {
    this._error = null;
    for (const error of this.container.querySelectorAll('.scene-outline-error')) error.remove();
    for (const field of this.container.querySelectorAll('[aria-invalid="true"]')) {
      field.removeAttribute('aria-invalid');
      // Only the error's token goes: the field's hint keeps describing it.
      const kept = (field.getAttribute('aria-describedby') || '').split(/\s+/)
        .filter(id => id && !id.startsWith(OUTLINE_ERROR_ID_PREFIX));
      if (kept.length) field.setAttribute('aria-describedby', kept.join(' '));
      else field.removeAttribute('aria-describedby');
    }
  }

  _resetDrafts() {
    this._drafts.clear();
    for (const formEl of this.container.querySelectorAll('form[data-outline-form-key]')) {
      formEl.reset();
    }
    this._clearCommandError();
  }

  _showCommandError(error = {}) {
    if (!error.formKey || !error.message) return;
    this._error = { formKey: String(error.formKey), message: String(error.message) };
    this._renderCommandError();
  }

  _acceptCommand({ formKey } = {}) {
    if (!formKey) return;
    const normalizedKey = String(formKey);
    const formEl = this._formForKey(normalizedKey);
    if (formEl) {
      for (const field of formEl.elements) {
        if (!field.name || field.disabled) continue;
        if (field.type === 'checkbox' || field.type === 'radio') {
          field.defaultChecked = field.checked;
        } else if (field.tagName === 'SELECT') {
          for (const option of field.options) option.defaultSelected = option.selected;
        } else {
          field.defaultValue = field.value;
        }
      }
    }
    this._drafts.delete(normalizedKey);
    this._clearCommandError();
  }

  _renderCommandError() {
    if (!this._error) return;
    const formEl = this._formForKey(this._error.formKey);
    if (!formEl || formEl.querySelector('.scene-outline-error')) return;
    const errorId = `${OUTLINE_ERROR_ID_PREFIX}${++this._errorSerial}`;
    const error = el('p', {
      className: 'scene-outline-error',
      text: this._error.message,
      attrs: { id: errorId, role: 'alert' },
    });
    for (const field of formEl.querySelectorAll('input, select, textarea')) {
      field.setAttribute('aria-invalid', 'true');
      // Ahead of the field's hint, which it keeps: the error is announced first.
      const others = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      field.setAttribute('aria-describedby', [errorId, ...others].join(' '));
    }
    formEl.appendChild(error);
  }

  _selectButton(label, kind, key, data) {
    const selected = this._selected(key);
    const select = button(label, 'select', { kind, ...data }, { key: `${key}:select` });
    select.setAttribute('aria-pressed', selected ? 'true' : 'false');
    if (selected) select.classList.add('is-selected');
    return select;
  }

  _renderRoute(snapshot) {
    const selectedWaypoint = snapshot.route.find(waypoint =>
      waypointContainsKey(waypoint, snapshot.selectionKey)
    );
    const defaultAfterWaypointId = selectedWaypoint?.id
      ?? snapshot.route[snapshot.route.length - 1]?.id
      ?? '';
    const group = detailsBlock(
      'route',
      `Route — ${plural(snapshot.majorCount, 'major waypoint')}, ${plural(snapshot.minorCount, 'minor waypoint')}`,
      this._isOpen(
        'route',
        true,
        snapshot.route.some(waypoint => waypointContainsKey(waypoint, snapshot.selectionKey))
      ),
      'scene-outline-group'
    );
    if (!group.open) return group;
    const content = el('div', { className: 'scene-outline-content' });
    content.appendChild(description(
      'Route order lists major waypoints, which carry the timing, and minor waypoints, which only shape ' +
      'the route. Positions are percentages of the image.'
    ));

    content.appendChild(form('add-waypoint', {}, [
      labelledSelect('afterWaypointId', 'Insert position', defaultAfterWaypointId, [
        { value: '', label: 'Start of route' },
        ...snapshot.route.map(waypoint => ({
          value: waypoint.id,
          label: `After ${waypoint.name}`,
        })),
      ], { key: 'route:add-after', tip: FIELD_HINTS.insertPosition }),
      labelledSelect('kind', 'Type', 'major', [
        { value: 'major', label: 'Major waypoint' },
        { value: 'minor', label: 'Minor waypoint', disabled: snapshot.route.length === 0 },
      ], { key: 'route:add-kind', tip: FIELD_HINTS.waypointType }),
      labelledInput('x', 'Horizontal position (%)', 50, {
        ...IMAGE_POSITION_PERCENT, step: 'any', key: 'route:add-x', tip: FIELD_HINTS.newWaypointX,
      }),
      labelledInput('y', 'Vertical position (%)', 50, {
        ...IMAGE_POSITION_PERCENT, step: 'any', key: 'route:add-y', tip: FIELD_HINTS.newWaypointY,
      }),
    ], 'Add waypoint', 'route:add-submit'));

    if (snapshot.route.length === 0) {
      content.appendChild(el('p', { className: 'scene-outline-empty', text: 'No waypoints yet.' }));
    } else {
      const list = el('ol', { className: 'scene-outline-list' });
      for (const waypoint of snapshot.route) list.appendChild(this._renderWaypoint(waypoint));
      content.appendChild(list);
    }
    group.appendChild(content);
    return group;
  }

  _renderWaypoint(waypoint) {
    const selectedWithin = waypointContainsKey(waypoint, this._snapshot.selectionKey);
    const details = detailsBlock(
      waypoint.key,
      `${waypoint.name} — ${waypoint.xLabel}%, ${waypoint.yLabel}%`,
      this._isOpen(waypoint.key, false, selectedWithin),
      waypoint.isMajor ? 'scene-outline-major' : 'scene-outline-minor'
    );
    if (!details.open) return itemFor(details);
    const content = el('div', { className: 'scene-outline-content' });
    const actions = el('div', { className: 'scene-outline-actions' });
    actions.append(
      this._selectButton(`Select ${waypoint.name}`, 'waypoint', waypoint.key, { waypointId: waypoint.id }),
      button('Delete waypoint', 'delete-waypoint', { waypointId: waypoint.id }, {
        danger: true,
        key: `${waypoint.key}:delete`,
      })
    );
    content.appendChild(actions);

    const fields = [
      labelledInput('x', 'Horizontal position (%)', waypoint.x, {
        ...IMAGE_POSITION_PERCENT, step: 'any', key: `${waypoint.key}:x`, canonicalValue: waypoint.xCanonical,
        tip: FIELD_HINTS.imageX,
      }),
      labelledInput('y', 'Vertical position (%)', waypoint.y, {
        ...IMAGE_POSITION_PERCENT, step: 'any', key: `${waypoint.key}:y`, canonicalValue: waypoint.yCanonical,
        tip: FIELD_HINTS.imageY,
      }),
    ];
    if (waypoint.isMajor) {
      fields.push(
        labelledInput('waitSeconds', 'Wait (seconds)', waypoint.pauseSeconds, {
          min: 0, max: 600, step: 'any', key: `${waypoint.key}:wait`, canonicalValue: waypoint.pauseMsCanonical,
          tip: FIELD_HINTS.wait,
        }),
        labelledInput('segmentSpeed', 'Leg speed (×)', waypoint.segmentSpeed, {
          min: 0.1, max: 10, step: 'any', key: `${waypoint.key}:speed`, tip: FIELD_HINTS.legSpeed,
        })
      );
    } else {
      content.appendChild(description(
        'Minor waypoints only shape the route; they have no wait or leg speed of their own.'
      ));
    }
    content.appendChild(form(
      'update-waypoint',
      { waypointId: waypoint.id },
      fields,
      'Apply waypoint',
      `${waypoint.key}:apply`
    ));
    content.appendChild(this._renderArea(waypoint));
    details.appendChild(content);
    return itemFor(details);
  }

  _renderArea(waypoint) {
    const area = waypoint.area;
    const wrapper = el('div', { className: 'scene-outline-subgroup' });
    if (area.shape !== 'polygon') {
      if (area.shape === 'none') {
        wrapper.appendChild(button('Create polygon area', 'create-polygon', { waypointId: waypoint.id }, {
          key: `${area.key}:create`,
        }));
      } else {
        wrapper.appendChild(description(
          `Area highlight: ${area.shape}. Its appearance remains in the waypoint inspector.`
        ));
      }
      return wrapper;
    }

    const details = detailsBlock(
      area.key,
      `Polygon area — ${plural(area.points.length, 'vertex', 'vertices')}`,
      this._isOpen(area.key, false, areaContainsKey(area, this._snapshot.selectionKey)),
      'scene-outline-polygon'
    );
    if (!details.open) {
      wrapper.appendChild(details);
      return wrapper;
    }
    const content = el('div', { className: 'scene-outline-content' });
    const vertexDraftContext = JSON.stringify(
      area.points.map(point => [point.xCanonical, point.yCanonical])
    );
    const actions = el('div', { className: 'scene-outline-actions' });
    actions.append(
      this._selectButton('Select polygon', 'polygon', area.key, { waypointId: waypoint.id }),
      button('Delete polygon', 'delete-polygon', { waypointId: waypoint.id }, {
        danger: true,
        key: `${area.key}:delete`,
      })
    );
    content.appendChild(actions);
    content.appendChild(form('update-polygon-timing', { waypointId: waypoint.id }, [
      labelledInput('fadeInSeconds', 'Fade in (seconds)', area.fadeInSeconds, {
        min: 0, max: 600, step: 'any', key: `${area.key}:fade-in`, canonicalValue: area.fadeInMsCanonical,
        tip: FIELD_HINTS.fadeIn,
      }),
      labelledInput('fadeOutSeconds', 'Fade out (seconds)', area.fadeOutSeconds, {
        min: 0, max: 600, step: 'any', key: `${area.key}:fade-out`, canonicalValue: area.fadeOutMsCanonical,
        tip: FIELD_HINTS.fadeOut,
      }),
    ], 'Apply polygon timing', `${area.key}:timing`));

    const list = el('ol', { className: 'scene-outline-list scene-outline-point-list' });
    for (const point of area.points) {
      const pointDetails = detailsBlock(
        point.key,
        `Vertex ${point.index + 1} — ${point.xLabel}%, ${point.yLabel}%`,
        this._isOpen(point.key, false, this._selected(point.key)),
        'scene-outline-point'
      );
      if (!pointDetails.open) {
        list.appendChild(itemFor(pointDetails));
        continue;
      }
      const pointContent = el('div', { className: 'scene-outline-content' });
      pointContent.appendChild(this._selectButton(`Select vertex ${point.index + 1}`, 'vertex', point.key, {
        waypointId: waypoint.id,
        index: point.index,
      }));
      pointContent.appendChild(form('update-vertex', { waypointId: waypoint.id, index: point.index }, [
        labelledInput('x', 'Horizontal position (%)', point.x, {
          ...IMAGE_POSITION_PERCENT, step: 'any', key: `${point.key}:x`, canonicalValue: point.xCanonical,
          tip: FIELD_HINTS.imageX,
        }),
        labelledInput('y', 'Vertical position (%)', point.y, {
          ...IMAGE_POSITION_PERCENT, step: 'any', key: `${point.key}:y`, canonicalValue: point.yCanonical,
          tip: FIELD_HINTS.imageY,
        }),
      ], 'Apply vertex', `${point.key}:apply`, vertexDraftContext));
      pointContent.appendChild(button('Delete vertex', 'delete-vertex', {
        waypointId: waypoint.id,
        index: point.index,
      }, {
        danger: true,
        disabled: area.points.length <= 3,
        key: `${point.key}:delete`,
      }));
      if (area.points.length <= 3) {
        pointContent.appendChild(description('A polygon needs at least three vertices. Delete the polygon instead.'));
      }
      pointDetails.appendChild(pointContent);
      list.appendChild(itemFor(pointDetails));
    }
    content.appendChild(list);
    content.appendChild(form('add-vertex', { waypointId: waypoint.id }, [
      labelledInput('x', 'New vertex horizontal position (%)', waypoint.x, {
        ...IMAGE_POSITION_PERCENT, step: 'any', key: `${area.key}:add-x`, tip: FIELD_HINTS.newVertexX,
      }),
      labelledInput('y', 'New vertex vertical position (%)', waypoint.y, {
        ...IMAGE_POSITION_PERCENT, step: 'any', key: `${area.key}:add-y`, tip: FIELD_HINTS.newVertexY,
      }),
    ], 'Add vertex', `${area.key}:add`));
    details.appendChild(content);
    wrapper.appendChild(details);
    return wrapper;
  }

  _renderCrowds(snapshot) {
    const selectedCrowd = snapshot.crowds.some(crowd => crowdContainsKey(crowd, snapshot.selectionKey));
    const group = detailsBlock(
      'crowds',
      `Crowds — ${plural(snapshot.crowds.length, 'layer')}`,
      this._isOpen('crowds', true, selectedCrowd),
      'scene-outline-group'
    );
    if (!group.open) return group;
    const content = el('div', { className: 'scene-outline-content' });
    content.appendChild(description(
      'Each crowd releases dots that follow the route or the crowd’s own custom network.'
    ));
    content.appendChild(button('Add crowd', 'add-crowd', {}, { key: 'crowds:add' }));
    if (snapshot.crowds.length === 0) {
      content.appendChild(el('p', { className: 'scene-outline-empty', text: 'No crowds yet.' }));
    } else {
      const list = el('ol', { className: 'scene-outline-list' });
      snapshot.crowds.forEach(crowd => list.appendChild(this._renderCrowd(crowd)));
      content.appendChild(list);
    }
    group.appendChild(content);
    return group;
  }

  _renderCrowd(crowd) {
    const selectedWithin = crowdContainsKey(crowd, this._snapshot.selectionKey);
    const guide = crowd.guideType === 'route' ? 'Follow route' : 'Custom network';
    const details = detailsBlock(
      crowd.key,
      `${crowd.displayName} — ${guide}, ${plural(crowd.emitters.length, 'emitter')}${crowd.visible ? '' : ', hidden'}`,
      this._isOpen(crowd.key, false, selectedWithin),
      'scene-outline-crowd'
    );
    if (!details.open) return itemFor(details);
    const content = el('div', { className: 'scene-outline-content' });
    const actions = el('div', { className: 'scene-outline-actions' });
    actions.append(
      this._selectButton(`Select ${crowd.displayName}`, 'crowd', crowd.key, { layerId: crowd.id }),
      button('Delete crowd', 'delete-crowd', { layerId: crowd.id }, {
        danger: true,
        key: `${crowd.key}:delete`,
      })
    );
    content.appendChild(actions);
    content.appendChild(form('update-crowd', { layerId: crowd.id }, [
      labelledInput('name', 'Crowd name', crowd.name, {
        type: 'text', required: false, inputMode: null, maxLength: 200,
        key: `${crowd.key}:name`, canonicalValue: crowd.name, tip: FIELD_HINTS.crowdName,
      }),
      labelledSelect('visible', 'Visibility', crowd.visible ? 'shown' : 'hidden', [
        { value: 'shown', label: 'Shown' },
        { value: 'hidden', label: 'Hidden' },
      ], { key: `${crowd.key}:visible`, tip: FIELD_HINTS.crowdVisibility }),
      labelledSelect('guideType', 'Guide', crowd.guideType, [
        { value: 'route', label: 'Follow route' },
        { value: 'graph', label: 'Custom network' },
      ], { key: `${crowd.key}:guide`, tip: FIELD_HINTS.guide }),
    ], 'Apply crowd', `${crowd.key}:apply`));

    const emittersKey = sceneOutlineKey('emitters', crowd.id);
    const emitters = detailsBlock(
      emittersKey,
      `Emitters — ${crowd.emitters.length}`,
      this._isOpen(
        emittersKey,
        false,
        crowd.emitters.some(emitter => this._snapshot.selectionKey === emitter.key)
      ),
      'scene-outline-subgroup'
    );
    const emitterList = el('ol', { className: 'scene-outline-list' });
    if (emitters.open) {
      crowd.emitters.forEach(emitter => emitterList.appendChild(this._renderEmitter(crowd, emitter)));
      if (crowd.emitters.length === 0) {
        emitters.appendChild(el('p', {
          className: 'scene-outline-empty',
          text: 'This crowd has no emitters.',
        }));
      } else {
        emitters.appendChild(emitterList);
      }
    }
    content.appendChild(emitters);
    content.appendChild(this._renderNetwork(crowd));
    details.appendChild(content);
    return itemFor(details);
  }

  _renderEmitter(crowd, emitter) {
    const details = detailsBlock(
      emitter.key,
      `Emitter ${emitter.index + 1}${emitter.primary ? ' — primary' : ''}, ${plural(emitter.dotCount, 'dot')}`,
      this._isOpen(emitter.key, false, this._selected(emitter.key)),
      'scene-outline-emitter'
    );
    if (!details.open) return itemFor(details);
    const content = el('div', { className: 'scene-outline-content' });
    content.appendChild(this._selectButton(`Select emitter ${emitter.index + 1}`, 'emitter', emitter.key, {
      layerId: crowd.id,
      emitterId: emitter.id,
    }));
    if (!emitter.primary) {
      content.appendChild(description(
        'A second emitter can be read here, not edited: editing more than one emitter in a crowd is a ' +
        'later feature.'
      ));
      content.appendChild(readOnlyList([
        ['Count', emitter.dotCount],
        ['Window start', `${emitter.releaseStart}%`],
        ['Window length', `${emitter.releaseDuration}%`],
        ['Speed', `${emitter.speed} image lengths/s`],
        ['Pace variation', `${emitter.speedVariance}%`],
        ['Release timing', `${emitter.onsetVariance}%`],
        ['Release bias', `${emitter.intensityRamp}%`],
        ['Busyness', `${emitter.busynessEnvelope.length} handles`],
        ['Walking variation', `${emitter.wobble}%`],
        ['At journey end', JOURNEY_END_LABELS[emitter.lifecycleMode] ?? emitter.lifecycleMode],
        ['Pattern seed', emitter.seed],
      ]));
    } else {
      content.appendChild(form('update-emitter', { layerId: crowd.id, emitterId: emitter.id }, [
        labelledInput('dotCount', 'Count', emitter.dotCount, {
          min: 1, max: 5000, step: 1, inputMode: 'numeric', key: `${emitter.key}:count`, tip: FIELD_HINTS.dots,
        }),
        labelledInput('releaseStart', 'Window start (%)', emitter.releaseStart, {
          min: 0, max: 100, step: 'any', key: `${emitter.key}:start`, canonicalValue: emitter.releaseStartCanonical,
          tip: FIELD_HINTS.releaseStart,
        }),
        labelledInput('releaseDuration', 'Window length (%)', emitter.releaseDuration, {
          min: 0,
          max: 100,
          step: 'any',
          key: `${emitter.key}:duration`,
          canonicalValue: emitter.releaseDurationCanonical,
          tip: FIELD_HINTS.releaseLength,
        }),
        labelledInput('onsetVariance', 'Release timing (%)', emitter.onsetVariance, {
          min: 0, max: 100, step: 'any', key: `${emitter.key}:onset`, canonicalValue: emitter.onsetVarianceCanonical,
          tip: FIELD_HINTS.releaseTiming,
        }),
        labelledInput('intensityRamp', 'Release bias (%)', emitter.intensityRamp, {
          min: -100, max: 100, step: 'any', key: `${emitter.key}:ramp`, canonicalValue: emitter.intensityRampCanonical,
          tip: FIELD_HINTS.releaseBias,
        }),
        labelledInput('speed', 'Speed (image lengths/s)', emitter.speed, {
          min: 0.001, max: 1000, step: 'any', key: `${emitter.key}:speed`, tip: FIELD_HINTS.speed,
        }),
        labelledInput('speedVariance', 'Pace variation (%)', emitter.speedVariance, {
          min: 0,
          max: 100,
          step: 'any',
          key: `${emitter.key}:speed-variance`,
          canonicalValue: emitter.speedVarianceCanonical,
          tip: FIELD_HINTS.paceVariation,
        }),
        labelledInput('dotSize', 'Dot size (×)', emitter.dotSize, {
          min: 0.01, max: 100, step: 'any', key: `${emitter.key}:size`, tip: FIELD_HINTS.dotSize,
        }),
        labelledInput('wobble', 'Walking variation (%)', emitter.wobble, {
          min: 0, max: 100, step: 'any', key: `${emitter.key}:wobble`, canonicalValue: emitter.wobbleCanonical,
          tip: FIELD_HINTS.walkingVariation,
        }),
        labelledInput('dotColor', 'Dot colour (hex or transparent)', emitter.dotColor, {
          type: 'text', inputMode: null, maxLength: 11, key: `${emitter.key}:color`, tip: FIELD_HINTS.dotColour,
        }),
        labelledSelect('lifecycleMode', 'At journey end', emitter.lifecycleMode, [
          { value: 'disappear', label: JOURNEY_END_LABELS.disappear },
          { value: 'respawn', label: JOURNEY_END_LABELS.respawn },
          { value: 'loop', label: JOURNEY_END_LABELS.loop },
          { value: 'collect', label: JOURNEY_END_LABELS.collect },
        ], { key: `${emitter.key}:lifecycle`, tip: FIELD_HINTS.journeyEnd }),
      ], 'Apply crowd', `${emitter.key}:apply`));
      content.appendChild(description(
        `Busyness over time has ${emitter.busynessEnvelope.length} handles. ` +
        'Select this crowd in the main editor to move handles or set gradual and sudden spans.'
      ));
      content.appendChild(readOnlyList([['Pattern seed', emitter.seed]]));
    }
    details.appendChild(content);
    return itemFor(details);
  }

  _renderNetwork(crowd) {
    const graph = crowd.graph;
    const label = graph.active
      ? 'Custom network'
      : 'Custom network — not in use while this crowd follows the route';
    const selectedWithin = networkContainsKey(graph, this._snapshot.selectionKey);
    const details = detailsBlock(
      graph.key,
      `${label} — ${plural(graph.nodes.length, 'node')}, ${plural(graph.edges.length, 'path')}`,
      this._isOpen(graph.key, false, selectedWithin),
      'scene-outline-network'
    );
    if (!details.open) return details;
    const content = el('div', { className: 'scene-outline-content' });
    content.appendChild(description(graph.active
      ? 'This network guides the crowd. Add nodes, then connect them with paths.'
      : 'These paths are kept but not drawn until Guide is set to Custom network.'));
    content.appendChild(form('add-node', { layerId: crowd.id }, [
      labelledInput('x', 'Node horizontal position (%)', 50, {
        min: 0, max: 100, step: 'any', key: `${graph.key}:add-node-x`, tip: FIELD_HINTS.newNodeX,
      }),
      labelledInput('y', 'Node vertical position (%)', 50, {
        min: 0, max: 100, step: 'any', key: `${graph.key}:add-node-y`, tip: FIELD_HINTS.newNodeY,
      }),
      labelledSelect('type', 'Node type', 'normal', [
        { value: 'normal', label: 'Pass-through' },
        { value: 'entry', label: 'Entry' },
        { value: 'exit', label: 'Exit' },
      ], { key: `${graph.key}:add-node-type`, tip: FIELD_HINTS.nodeType }),
      labelledInput('label', 'Node label (optional)', '', {
        type: 'text', required: false, inputMode: null, maxLength: 200, key: `${graph.key}:add-node-label`,
        tip: FIELD_HINTS.nodeLabel,
      }),
    ], 'Add node', `${graph.key}:add-node`));

    if (graph.nodes.length >= 2) {
      const nodeOptions = graph.nodes.map(node => ({
        value: node.id,
        label: `${node.name} — ${node.xLabel}%, ${node.yLabel}%`,
      }));
      content.appendChild(form('connect-nodes', { layerId: crowd.id }, [
        labelledSelect('sourceId', 'Source node', graph.nodes[0].id, nodeOptions, {
          key: `${graph.key}:source`, tip: FIELD_HINTS.sourceNode,
        }),
        labelledSelect('targetId', 'Destination node', graph.nodes[1].id, nodeOptions, {
          key: `${graph.key}:target`, tip: FIELD_HINTS.destinationNode,
        }),
        labelledSelect('direction', 'Direction', 'two-way', [
          { value: 'two-way', label: 'Two-way' },
          { value: 'one-way', label: 'One-way' },
        ], { key: `${graph.key}:direction`, tip: FIELD_HINTS.newEdgeDirection }),
        labelledInput('weight', 'Path weight', 1, {
          min: 0.01, step: 'any', key: `${graph.key}:weight`, tip: FIELD_HINTS.pathWeight,
        }),
      ], 'Connect nodes', `${graph.key}:connect`));
    } else {
      content.appendChild(description('Add at least two nodes before connecting a path.'));
    }

    const nodesKey = sceneOutlineKey('nodes', crowd.id);
    const nodes = detailsBlock(
      nodesKey,
      `Nodes — ${graph.nodes.length}`,
      this._isOpen(
        nodesKey,
        false,
        graph.nodes.some(node => this._snapshot.selectionKey === node.key)
      ),
      'scene-outline-subgroup'
    );
    const nodeList = el('ol', { className: 'scene-outline-list' });
    if (nodes.open) {
      graph.nodes.forEach(node => nodeList.appendChild(this._renderNode(crowd, node)));
      nodes.appendChild(graph.nodes.length
        ? nodeList
        : el('p', { className: 'scene-outline-empty', text: 'No nodes.' }));
    }
    content.appendChild(nodes);

    const edgesKey = sceneOutlineKey('edges', crowd.id);
    const edges = detailsBlock(
      edgesKey,
      `Paths — ${graph.edges.length}`,
      this._isOpen(
        edgesKey,
        false,
        graph.edges.some(edge => edgeContainsKey(edge, this._snapshot.selectionKey))
      ),
      'scene-outline-subgroup'
    );
    const edgeList = el('ol', { className: 'scene-outline-list' });
    if (edges.open) {
      graph.edges.forEach(edge => edgeList.appendChild(this._renderEdge(crowd, edge)));
      edges.appendChild(graph.edges.length
        ? edgeList
        : el('p', { className: 'scene-outline-empty', text: 'No paths.' }));
    }
    content.appendChild(edges);
    details.appendChild(content);
    return details;
  }

  _renderNode(crowd, node) {
    const details = detailsBlock(
      node.key,
      `${node.name} — ${node.xLabel}%, ${node.yLabel}%`,
      this._isOpen(node.key, false, this._selected(node.key)),
      'scene-outline-node'
    );
    if (!details.open) return itemFor(details);
    const content = el('div', { className: 'scene-outline-content' });
    content.appendChild(this._selectButton(`Select node ${node.index + 1}`, 'node', node.key, {
      layerId: crowd.id,
      nodeId: node.id,
    }));
    content.appendChild(form('update-node', { layerId: crowd.id, nodeId: node.id }, [
      labelledInput('x', 'Horizontal position (%)', node.x, {
        min: 0, max: 100, step: 'any', key: `${node.key}:x`, canonicalValue: node.xCanonical,
        tip: FIELD_HINTS.onImageX,
      }),
      labelledInput('y', 'Vertical position (%)', node.y, {
        min: 0, max: 100, step: 'any', key: `${node.key}:y`, canonicalValue: node.yCanonical,
        tip: FIELD_HINTS.onImageY,
      }),
      labelledSelect('type', 'Type', node.type, [
        { value: 'normal', label: 'Pass-through' },
        { value: 'entry', label: 'Entry' },
        { value: 'exit', label: 'Exit' },
      ], { key: `${node.key}:type`, tip: FIELD_HINTS.nodeType }),
      labelledInput('label', 'Label (optional)', node.label, {
        type: 'text', required: false, inputMode: null, maxLength: 200,
        key: `${node.key}:label`, canonicalValue: node.label, tip: FIELD_HINTS.nodeLabel,
      }),
    ], 'Apply node', `${node.key}:apply`));
    content.appendChild(button(
      `Delete node${node.connectedEdges ? ` and ${plural(node.connectedEdges, 'connected path')}` : ''}`,
      'delete-node',
      { layerId: crowd.id, nodeId: node.id },
      { danger: true, key: `${node.key}:delete` }
    ));
    details.appendChild(content);
    return itemFor(details);
  }

  _renderEdge(crowd, edge) {
    const details = detailsBlock(
      edge.key,
      `Path ${edge.index + 1} — ${edge.sourceName} to ${edge.targetName}, ${edge.direction}`,
      this._isOpen(edge.key, false, edgeContainsKey(edge, this._snapshot.selectionKey)),
      'scene-outline-edge'
    );
    if (!details.open) return itemFor(details);
    const content = el('div', { className: 'scene-outline-content' });
    content.appendChild(this._selectButton(`Select path ${edge.index + 1}`, 'edge', edge.key, {
      layerId: crowd.id,
      edgeId: edge.id,
    }));
    content.appendChild(form('update-edge', { layerId: crowd.id, edgeId: edge.id }, [
      labelledSelect('direction', 'Direction', edge.direction, [
        { value: 'two-way', label: 'Two-way' },
        { value: 'one-way', label: 'One-way' },
      ], { key: `${edge.key}:direction`, tip: FIELD_HINTS.edgeDirection }),
      labelledInput('weight', 'Path weight', edge.weight, {
        min: 0.01, step: 'any', key: `${edge.key}:weight`, canonicalValue: edge.weight,
        tip: FIELD_HINTS.pathWeight,
      }),
    ], 'Apply path', `${edge.key}:apply`));
    content.appendChild(button('Delete path', 'delete-edge', {
      layerId: crowd.id,
      edgeId: edge.id,
    }, { danger: true, key: `${edge.key}:delete` }));

    const controlsKey = sceneOutlineKey('controls', crowd.id, edge.id);
    const points = detailsBlock(
      controlsKey,
      `Bends — ${edge.controlPoints.length}`,
      this._isOpen(
        controlsKey,
        false,
        edge.controlPoints.some(point => this._snapshot.selectionKey === point.key)
      ),
      'scene-outline-subgroup'
    );
    const controlDraftContext = JSON.stringify(
      edge.controlPoints.map(point => [point.xCanonical, point.yCanonical])
    );
    const list = el('ol', { className: 'scene-outline-list scene-outline-point-list' });
    for (const point of points.open ? edge.controlPoints : []) {
      const pointDetails = detailsBlock(
        point.key,
        `Bend ${point.index + 1} — ${point.xLabel}%, ${point.yLabel}%`,
        this._isOpen(point.key, false, this._selected(point.key)),
        'scene-outline-point'
      );
      if (!pointDetails.open) {
        list.appendChild(itemFor(pointDetails));
        continue;
      }
      const pointContent = el('div', { className: 'scene-outline-content' });
      pointContent.appendChild(this._selectButton(`Select bend ${point.index + 1}`, 'control', point.key, {
        layerId: crowd.id,
        edgeId: edge.id,
        index: point.index,
      }));
      pointContent.appendChild(form('update-control', {
        layerId: crowd.id,
        edgeId: edge.id,
        index: point.index,
      }, [
        labelledInput('x', 'Horizontal position (%)', point.x, {
          ...bendPercentRange(point.x), step: 'any', key: `${point.key}:x`, canonicalValue: point.xCanonical,
          tip: FIELD_HINTS.onImageX,
        }),
        labelledInput('y', 'Vertical position (%)', point.y, {
          ...bendPercentRange(point.y), step: 'any', key: `${point.key}:y`, canonicalValue: point.yCanonical,
          tip: FIELD_HINTS.onImageY,
        }),
      ], 'Apply bend', `${point.key}:apply`, controlDraftContext));
      pointContent.appendChild(button('Delete bend', 'delete-control', {
        layerId: crowd.id,
        edgeId: edge.id,
        index: point.index,
      }, { danger: true, key: `${point.key}:delete` }));
      pointDetails.appendChild(pointContent);
      list.appendChild(itemFor(pointDetails));
    }
    if (points.open) {
      points.appendChild(edge.controlPoints.length
        ? list
        : el('p', {
          className: 'scene-outline-empty',
          text: 'No bends; the path is straight.',
        }));
      points.appendChild(form('add-control', { layerId: crowd.id, edgeId: edge.id }, [
        labelledInput('x', 'New bend horizontal position (%)', 50, {
          min: 0, max: 100, step: 'any', key: `${edge.key}:add-control-x`, tip: FIELD_HINTS.newBendX,
        }),
        labelledInput('y', 'New bend vertical position (%)', 50, {
          min: 0, max: 100, step: 'any', key: `${edge.key}:add-control-y`, tip: FIELD_HINTS.newBendY,
        }),
      ], 'Add bend', `${edge.key}:add-control`));
    }
    content.appendChild(points);
    details.appendChild(content);
    return itemFor(details);
  }

  _onSubmit(event) {
    const formEl = event.target.closest('form[data-outline-action]');
    if (!formEl || !this.container.contains(formEl)) return;
    event.preventDefault();
    if (!formEl.reportValidity()) return;
    this._clearCommandError();
    const values = Object.fromEntries(new FormData(formEl).entries());
    const outlineOriginalValues = {};
    for (const field of formEl.elements) {
      if (!field.name || !(OUTLINE_CANONICAL_VALUE in field)) continue;
      outlineOriginalValues[field.name] = {
        display: field.defaultValue,
        canonical: field[OUTLINE_CANONICAL_VALUE],
      };
    }
    this.eventBus.emit('scene-outline:command', {
      action: formEl.dataset.outlineAction,
      ...formEl.dataset,
      ...values,
      outlineOriginalValues,
    });
  }

  _onClick(event) {
    const summary = event.target.closest('summary[data-outline-key]');
    if (summary && this.container.contains(summary)) {
      // The outline, not the browser, opens and closes its entries (DEF-40).
      // A browser toggles an entry only after the click's microtasks, so a
      // redraw queued here drew the entry as it was, empty, and the toggle
      // then landed on the element the redraw had replaced. Enter and Space
      // on a summary arrive as this same click.
      event.preventDefault();
      const details = summary.parentElement;
      details.open = !details.open;
      if (this._snapshot) this.render(this._snapshot, summary.dataset.outlineKey);
      return;
    }
    const target = event.target.closest('button[data-outline-action]');
    if (!target || !this.container.contains(target)) return;
    this.eventBus.emit('scene-outline:command', {
      action: target.dataset.outlineAction,
      ...target.dataset,
    });
  }

  _onKeyDown(event) {
    if (event.key !== 'Escape') return;
    const field = event.target.closest('input, select, textarea');
    if (!field || !this.container.contains(field)) return;
    event.preventDefault();
    event.stopPropagation();
    this._clearCommandError();
    this._drafts.delete(field.form?.dataset?.outlineFormKey);
    field.form?.reset();
    field.form?.querySelector('[type="submit"]')?.focus();
  }
}

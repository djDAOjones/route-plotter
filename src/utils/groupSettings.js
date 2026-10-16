import { CROWD_GROUPS } from '../config/constants.js';

export const GROUP_FIELD_HINTS = Object.freeze({
  groups: 'Move consecutive dots together; Apply groups accepts these edits',
  groupSize: 'Dots in each group, from 1 to 5,000. Size 1 keeps individual movement',
  groupWidth: 'Width uses image proportions across and behind; walking variation may spread dots further',
});

export const GROUP_HINT = 'Apply groups accepts these edits; Cancel edits restores the stored settings. '
  + 'A group shares its Entry, release, pace and path choices. Width spreads dots across and behind the front '
  + 'in image proportions; a square width looks rectangular on a nonsquare image. '
  + 'Walking variation can spread them further. Size 1 moves dots individually.';

/** Strict optional fields; validate a partial before any existing emitter write. */
export function assertGroupSettings(data) {
  if ('groups' in data && typeof data.groups !== 'boolean') {
    throw new Error('Groups must be on or off.');
  }
  if ('groupSize' in data && (!Number.isInteger(data.groupSize)
      || data.groupSize < 1 || data.groupSize > CROWD_GROUPS.MAX_SIZE)) {
    throw new Error(`Group size must be an integer from 1 to ${CROWD_GROUPS.MAX_SIZE} dots.`);
  }
  if ('groupWidth' in data && (typeof data.groupWidth !== 'number' || !Number.isFinite(data.groupWidth)
      || data.groupWidth < 0 || data.groupWidth > CROWD_GROUPS.MAX_WIDTH)) {
    throw new Error('Group width must be from 0% to 20%.');
  }
}

/** The reason is independent of the switch, so an inactive authored-on setting can be turned off. */
export function groupsUnavailableReason(layer, emitter) {
  if (layer?.guideType !== 'graph') return 'Choose Custom network to use groups.';
  if (emitter?.waitAtStart) return 'Turn off Final whistle to use groups.';
  if (!['disappear', 'collect'].includes(emitter?.lifecycleMode)) {
    return 'Choose Disappear or Collect at the end to use groups.';
  }
  return '';
}

export function groupsActive(layer, emitter) {
  return emitter?.groups === true && (emitter.groupSize ?? CROWD_GROUPS.SIZE) > 1
    && !groupsUnavailableReason(layer, emitter);
}

/** Choice words for a whole network; ordinary emitters can coexist with groups. */
export function groupChoiceRole(layer) {
  const emitters = layer?.emitters || [];
  if (!emitters.some(emitter => groupsActive(layer, emitter))) return null;
  return emitters.some(emitter => !groupsActive(layer, emitter)) ? 'mixed' : 'group';
}

export function groupChoiceHint(role, text) {
  if (!role) return text;
  return text.replace(/\bdots\b/g, role === 'mixed' ? 'groups and individual dots' : 'groups')
    .replace(/\bdot\b/g, role === 'mixed' ? 'group or individual dot' : 'group');
}

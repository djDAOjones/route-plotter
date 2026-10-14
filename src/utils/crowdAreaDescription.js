/** Shared wording for the node card and semantic outline; no component owns timing. */
export function crowdAreaDescription({ type, hasImage, summary = null, hasRoute = false, constantTime = false }) {
  const finish = type === 'exit', active = finish || type === 'entry';
  const label = finish ? 'Finish area' : type === 'entry' ? 'Start area' : 'Node area';
  const reason = active ? '' : 'Choose Entry or Exit in Type to edit and use this node area.';
  let hint = finish
    ? 'Only Collect at the end uses the finish area. Other journey-end settings keep their usual behaviour.'
    : 'Only Disappear and Collect at the end use the area. Respawn and Repeat journey start at the node.';
  if (finish && summary) {
    if (summary.capacity === 0) hint += ' No whole dot fits; dots collect at the node.';
    else {
      hint += ` ${summary.exact ? '' : 'At least '}${summary.capacity} ${summary.capacity === 1 ? 'place' : 'places'}`
        + ` for ${summary.arrivals} arriving dots.`;
      if (summary.exact && summary.arrivals > summary.capacity) {
        hint += ' Later arrivals repeat the places from the first.';
      }
    }
    hint += ' Dots fit without overlap at the project reference with Graphics scale 1;'
      + ' other proportions or scales can overlap.';
  }
  if (finish && hasRoute) {
    hint += " Finish-area journeys use the project's reference timing."
      + ' Their release span can differ from other dots and the route shown.';
    if (constantTime) hint += ' The saved route duration does not set this release span.';
  }
  const imageHint = hasImage ? '' : 'Without a background image, Start area and Finish area use different proportions '
    + 'when turned. Adding an image changes the layout.';
  return { label, reason, hint, imageHint };
}

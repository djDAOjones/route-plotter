/**
 * Snap a target point to the nearest multiple of snapDeg degrees from a reference point.
 * Preserves the distance between reference and target, only adjusts the angle.
 * @param {number} refX - Reference point X (normalized image coords)
 * @param {number} refY - Reference point Y (normalized image coords)
 * @param {number} targetX - Target point X
 * @param {number} targetY - Target point Y
 * @param {number} [snapDeg=15] - Snap increment in degrees
 * @returns {{x: number, y: number}} Snapped target coordinates
 */
export function snapToAngle(refX, refY, targetX, targetY, snapDeg = 15) {
  const dx = targetX - refX;
  const dy = targetY - refY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1e-9) return { x: targetX, y: targetY }; // Same point, nothing to snap
  
  const angle = Math.atan2(dy, dx);
  const snapRad = snapDeg * Math.PI / 180;
  const snappedAngle = Math.round(angle / snapRad) * snapRad;
  
  return {
    x: refX + dist * Math.cos(snappedAngle),
    y: refY + dist * Math.sin(snappedAngle)
  };
}

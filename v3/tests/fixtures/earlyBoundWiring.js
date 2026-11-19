/**
 * A module that keeps the browser's own ways to wire a control as it is
 * evaluated, as any module of the application could (TST-04, the review's
 * EARLY-ADD): `addEventListener` through the conventional bound helper, and the
 * setter of an element's `ondblclick` handler property. Each is read once,
 * here, and used later on an element.
 *
 * `goldenControls.test.js` imports it where it imports the application, once
 * it has replaced both, so what this kept is what an application module keeps.
 */

/** `addListener(target, type, listener, options)`, as `target.addEventListener(...)`. */
export const addListener = Function.call.bind(EventTarget.prototype.addEventListener);

/** `setDoubleClickHandler(element, handler)`, as `element.ondblclick = handler`. */
export const setDoubleClickHandler = Function.call.bind(
  Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'ondblclick').set,
);

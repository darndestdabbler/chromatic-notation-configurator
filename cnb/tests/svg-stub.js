/**
 * svg-stub.js — Minimal DOM stub for exercising SVG render paths in Node.
 *
 * Provides just enough of the DOM (createElementNS, setAttribute,
 * appendChild) for the rendering modules' render() functions to run and be
 * asserted against. Not a layout engine — visual correctness is still
 * verified on the test pages.
 */

export function makeStubElement(tag) {
  return {
    tag,
    attrs: {},
    children: [],
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] ?? null; },
    appendChild(child) { this.children.push(child); return child; },
  };
}

/**
 * Run fn with a stub `document` installed (restoring any previous value),
 * passing it a stub <svg> root element.
 */
export function withSvgStub(fn) {
  const had = "document" in globalThis;
  const prev = globalThis.document;
  globalThis.document = { createElementNS: (_ns, tag) => makeStubElement(tag) };
  try {
    return fn(makeStubElement("svg"));
  } finally {
    if (had) globalThis.document = prev;
    else delete globalThis.document;
  }
}

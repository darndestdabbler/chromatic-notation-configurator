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
    style: {},
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

/**
 * Like withSvgStub, but the stub document also supports createElement, for
 * modules that build HTML structure (card, collection). fn receives a stub
 * <div> container element.
 */
export function withDomStub(fn) {
  const had = "document" in globalThis;
  const prev = globalThis.document;
  globalThis.document = {
    createElement: (tag) => makeStubElement(tag),
    createElementNS: (_ns, tag) => makeStubElement(tag),
  };
  try {
    return fn(makeStubElement("div"));
  } finally {
    if (had) globalThis.document = prev;
    else delete globalThis.document;
  }
}

/**
 * Parse SVG text into a minimal read-only Document stub for the SVG
 * importer in Node (no DOMParser there): documentElement, getElementById,
 * querySelector / querySelectorAll by tag name or a comma list of tag
 * names (in document order), and each element's parentNode (null for the
 * root). Reads tags and their attributes only (entity references in values
 * decoded), which is all CNBSvgImporter.extract / extractClef consult.
 * Comments are skipped.
 */
export function parseSvgDocument(text) {
  const decode = (v) => v
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const elements = [];
  const open = [];
  const source = String(text).replace(/<!--[\s\S]*?-->/g, "");
  for (const [, close, tagName, attrText, selfClosing] of
    source.matchAll(/<(\/?)([A-Za-z][\w:.-]*)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g)) {
    if (close) {
      const at = open.map(el => el.tagName).lastIndexOf(tagName);
      if (at >= 0) open.length = at;
      continue;
    }
    const attrs = {};
    for (const [, name, dq, sq] of attrText.matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs[name] = decode(dq ?? sq);
    }
    const el = {
      tagName,
      parentNode: open[open.length - 1] || null,
      getAttribute: (k) => (k in attrs ? attrs[k] : null),
    };
    elements.push(el);
    if (!selfClosing) open.push(el);
  }
  const byTag = (sel) => {
    const tags = sel.split(",").map(s => s.trim().toLowerCase());
    return elements.filter(el => tags.includes(el.tagName.replace(/^.*:/, "").toLowerCase()));
  };
  return {
    documentElement: elements[0] || null,
    getElementById: (id) => elements.find(el => el.getAttribute("id") === id) || null,
    querySelector: (sel) => byTag(sel)[0] || null,
    querySelectorAll: (sel) => byTag(sel),
  };
}

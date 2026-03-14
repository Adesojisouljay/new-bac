import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>', { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.location = dom.window.location;
import('./dist/assets/index-720c033f.js').catch(err => console.error("BUNDLE ERROR:", err));

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../site/scripts/admin/mobile-nav.js'), 'utf8');

class FakeElement {
  constructor() {
    this.listeners = new Map();
    this.hidden = false;
    this.attrs = {};
    this.classes = new Set();
    this.classList = {
      add: (value) => this.classes.add(value),
      remove: (value) => this.classes.delete(value),
      contains: (value) => this.classes.has(value),
    };
    this.children = [];
  }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  setAttribute(name, value) { this.attrs[name] = value; }
  querySelectorAll() { return this.children; }
  focus() { this.focused = true; }
  getClientRects() { return [1]; }
  click() { this.listeners.get('click')?.({}); }
}

function mount(initialMobile = true) {
  const open = new FakeElement();
  const menu = new FakeElement();
  const backdrop = new FakeElement();
  const close = new FakeElement();
  const body = new FakeElement();
  const document = {
    body, activeElement: open,
    elements: {
      '[data-admin-mobile-open]': open,
      '[data-admin-mobile-menu]': menu,
      '[data-admin-mobile-backdrop]': backdrop,
      '[data-admin-mobile-close]': close,
    },
    listeners: new Map(),
    querySelector(sel) { return this.elements[sel]; },
    addEventListener(type, callback) { this.listeners.set(type, callback); },
  };
  const a = new FakeElement();
  menu.children = [a];
  menu.hidden = true;
  backdrop.hidden = true;
  const breakpoint = {
    matches: initialMobile, listeners: new Map(),
    addEventListener(type, cb) { this.listeners.set(type, cb); },
  };
  const window = { matchMedia: () => breakpoint };
  vm.runInNewContext(source, { document, window, HTMLElement: FakeElement });
  return { open, menu, backdrop, close, body, document, breakpoint };
}

test('открывается и закрывается по кнопке «Ещё»', () => {
  const dom = mount();
  dom.open.click();
  assert.equal(dom.menu.hidden, false);
  assert.equal(dom.backdrop.hidden, false);
  assert.equal(dom.open.attrs['aria-expanded'], 'true');
  assert.equal(dom.body.classList.contains('is-admin-mobile-menu-open'), true);
  assert.equal(dom.close.focused, true);
  dom.open.click();
  assert.equal(dom.menu.hidden, true);
  assert.equal(dom.open.attrs['aria-expanded'], 'false');
});

test('закрывается по фону и клавише Escape с возвратом фокуса', () => {
  const dom = mount();
  dom.open.click();
  dom.backdrop.click();
  assert.equal(dom.menu.hidden, true);
  assert.equal(dom.open.focused, true);
  dom.open.click();
  let prevented = false;
  dom.document.listeners.get('keydown')({ key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(dom.menu.hidden, true);
});

test('на десктопе не открывается и закрывается при смене ширины', () => {
  const dom = mount(false);
  dom.open.click();
  assert.equal(dom.menu.hidden, true);
  dom.breakpoint.matches = true;
  dom.open.click();
  assert.equal(dom.menu.hidden, false);
  dom.breakpoint.matches = false;
  dom.breakpoint.listeners.get('change')();
  assert.equal(dom.menu.hidden, true);
});

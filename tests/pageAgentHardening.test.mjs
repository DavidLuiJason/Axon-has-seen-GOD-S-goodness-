import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pageAgentSource = fs.readFileSync(path.join(root, 'android-overlay/app/src/main/assets/axon_page_agent.js'), 'utf8');

class Element {
  constructor(tagName, attrs = {}, opts = {}) {
    this.tagName = tagName.toUpperCase();
    this.attrs = { ...attrs };
    this.innerText = opts.text ?? '';
    this.textContent = opts.text ?? '';
    this.value = opts.value ?? '';
    this.disabled = opts.disabled === true;
    this.hidden = opts.hidden === true;
    this.form = opts.form ?? null;
    this.labelParent = opts.labelParent ?? null;
    this.labels = opts.labels ?? [];
    this.options = opts.options ?? [];
    this.clicks = 0;
    this.events = [];
    this.checked = false;
  }
  getAttribute(name) { return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getBoundingClientRect() { return this.hidden ? { width: 0, height: 0 } : { width: 80, height: 20 }; }
  closest(selector) { return selector === 'form' ? this.form : selector === 'label' ? this.labelParent : null; }
  click() { this.clicks += 1; }
  focus() { this.focused = true; }
  scrollIntoView() { this.scrolled = true; }
  dispatchEvent(event) { this.events.push(event.type); return true; }
}
class Form {
  constructor(fields = [], text = '', action = '') { this.fields = fields; this.innerText = text; this.textContent = text; this.action = action; }
  querySelectorAll() { return this.fields; }
  querySelector() { return null; }
  getAttribute(name) { return name === 'action' ? this.action : null; }
}
function page(elements, extra = {}) {
  const document = {
    title: 'Hardening test',
    body: { innerText: extra.bodyText ?? 'Test page' },
    querySelectorAll: () => elements,
    getElementById: (id) => extra.labelsById?.[id] ?? null,
    querySelector: (selector) => {
      const match = /data-axon-id="([^"]+)"/.exec(selector);
      return match ? elements.find((e) => e.attrs['data-axon-id'] === match[1]) ?? null : null;
    },
  };
  const window = {
    scrollY: 0,
    scrollBy(_x, y) { this.scrollY += y; },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  };
  const sandbox = {
    window, document,
    location: { href: extra.url ?? 'https://example.test/' },
    Event: class { constructor(type) { this.type = type; } },
    JSON, Object, String, Number, Math, isFinite,
  };
  window.document = document;
  vm.runInNewContext(pageAgentSource, sandbox);
  return window.__axonAgent;
}
const read = (agent) => JSON.parse(agent.snapshot());
const act = (agent, args) => JSON.parse(agent.act(JSON.stringify(args)));

// 42 sensitive-field aliases. Each is an independent test so failures identify the unsafe alias.
const sensitiveNames = [
  'password', 'user_password', 'currentPassword', 'newPassword', 'passwd', 'passcode',
  'card', 'card_number', 'cardNumber', 'cardholder', 'card_holder', 'card_name', 'ccnum', 'cc_num',
  'cc-number', 'cc-exp', 'cc-csc', 'cc-type', 'cc-name', 'cvv', 'cvc', 'iban', 'ssn',
  'social_security_number', 'otp', 'one_time_code', 'oneTimeCode', 'verification_code',
  'verificationCode', 'auth_code', 'authenticationCode', 'pin', 'pin_code', 'security_code',
  'access_code', 'confirmation_code', 'sms_code', 'recovery_code', 'backup_code', 'secret',
  'secret_answer', 'securityPin',
];
for (const name of sensitiveNames) {
  test(`sensitive field alias is classified and its value is not exposed: ${name}`, () => {
    const el = new Element('input', { name, type: 'text' }, { value: 'do-not-disclose' });
    const agent = page([el]);
    const item = read(agent).elements[0];
    assert.equal(item.sensitive, true);
    assert.equal(Object.hasOwn(item, 'value'), false);
    assert.equal(act(agent, { type: 'type', id: 'e1', text: '123456' }).error, 'sensitive-field');
    assert.equal(el.value, 'do-not-disclose');
  });
}

// 26 benign near-matches guard against the prior substring false-positive problem (e.g. shipping -> pin).
const benignNames = [
  'shipping_address', 'shippingMethod', 'mapping_mode', 'mapping', 'discard_reason', 'cardigan_size',
  'zipcode', 'postal_code', 'country_code', 'language_code', 'product_code', 'coupon_code',
  'discount_code', 'invite_code', 'tracking_code', 'order_code', 'project_code', 'source_code',
  'barcode', 'record_id', 'pinwheel_color', 'spinning_speed', 'shipping_pinless', 'decode_mode',
  'color_code', 'shipping_instructions',
];
for (const name of benignNames) {
  test(`ordinary field is not falsely classified as a secret: ${name}`, () => {
    const el = new Element('input', { name, type: 'text' }, { value: 'ordinary-value' });
    const agent = page([el]);
    const item = read(agent).elements[0];
    assert.equal(item.sensitive, false);
    assert.equal(item.value, 'ordinary-value');
    assert.equal(act(agent, { type: 'type', id: 'e1', text: 'ordinary-edit' }).ok, true);
    assert.equal(el.value, 'ordinary-edit');
  });
}

// Payment form inference should cover common autocomplete and field-name variants.
const paymentNames = [
  'cc-number', 'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-csc', 'cc-type', 'cc-name',
  'card_number', 'cardNumber', 'card_name', 'cardholder', 'card_holder', 'cvv', 'cvc', 'iban',
];
for (const name of paymentNames) {
  test(`payment form context blocks a generic submit action: ${name}`, () => {
    const field = new Element('input', { name, type: 'text' });
    const form = new Form([field]);
    const submit = new Element('button', { type: 'submit' }, { text: 'Continue', form });
    const agent = page([submit]);
    assert.equal(read(agent).elements[0].risk, 'payment');
    assert.equal(act(agent, { type: 'click', id: 'e1', approved: true }).error, 'owner-handoff');
    assert.equal(submit.clicks, 0);
  });
}

// Labels and accessibility names must participate in sensitivity detection.
const labelCases = [
  ['associated label', new Element('input', { name: 'field' }, { labels: [{ innerText: 'Verification code' }] })],
  ['wrapping label', new Element('input', { name: 'field' }, { labelParent: { innerText: 'Account PIN' } })],
  ['aria label', new Element('input', { name: 'field', 'aria-label': 'One-time password' })],
  ['placeholder', new Element('input', { name: 'field', placeholder: 'Enter security code' })],
  ['aria-labelledby', new Element('input', { name: 'field', 'aria-labelledby': 'secret-label' })],
  ['camel-case id', new Element('input', { id: 'recoveryCode' })],
];
for (const [label, el] of labelCases) {
  test(`accessible field metadata protects sensitive content: ${label}`, () => {
    const extra = label === 'aria-labelledby' ? { labelsById: { 'secret-label': { innerText: 'Authentication code' } } } : {};
    const agent = page([el], extra);
    assert.equal(read(agent).elements[0].sensitive, true);
    assert.equal(Object.hasOwn(read(agent).elements[0], 'value'), false);
    assert.equal(act(agent, { type: 'type', id: 'e1', text: '123456' }).error, 'sensitive-field');
  });
}

// Non-input controls can also hold protected values; never reveal or select them.
test('sensitive select value is omitted from snapshots and cannot be changed', () => {
  const el = new Element('select', { name: 'security_code' }, { value: 'masked-value', options: [{ value: 'x' }] });
  const agent = page([el]);
  assert.equal(read(agent).elements[0].sensitive, true);
  assert.equal(Object.hasOwn(read(agent).elements[0], 'value'), false);
  assert.equal(act(agent, { type: 'select', id: 'e1', value: 'x' }).error, 'sensitive-field');
  assert.equal(el.value, 'masked-value');
});

// 20 untrusted action variants must fail closed without executing a page action.
const badActions = [
  ['malformed JSON', '{'], ['null payload', 'null'], ['array payload', '[]'],
  ['missing action type', '{}'], ['unknown action', JSON.stringify({ type: 'launch', id: 'e1' })],
  ['bad ID injection', JSON.stringify({ type: 'click', id: 'e1"] , document.body.innerHTML="x' })],
  ['missing target', JSON.stringify({ type: 'click', id: 'e999' })],
  ['missing text target', JSON.stringify({ type: 'type', id: 'e999', text: 'x' })],
  ['missing select target', JSON.stringify({ type: 'select', id: 'e999', value: 'x' })],
  ['scroll NaN', JSON.stringify({ type: 'scroll', dy: 'NaN' })],
  ['scroll object', JSON.stringify({ type: 'scroll', dy: {} })],
  ['click without ID', JSON.stringify({ type: 'click' })],
  ['select wrong control', JSON.stringify({ type: 'select', id: 'e1', value: 'x' })],
  ['type wrong control', JSON.stringify({ type: 'type', id: 'e1', text: 'x' })],
  ['unknown option', JSON.stringify({ type: 'select', id: 'e1', value: 'missing' })],
  ['oversized text', JSON.stringify({ type: 'type', id: 'e1', text: 'x'.repeat(2001) })],
  ['page mismatch', JSON.stringify({ type: 'click', id: 'e1', url: 'https://other.test/' })],
  ['disabled control', JSON.stringify({ type: 'click', id: 'e1' })],
  ['hidden control', JSON.stringify({ type: 'click', id: 'e1' })],
  ['unsupported select type', JSON.stringify({ type: 'select', id: 'e1', value: 'x' })],
];
for (const [label, raw] of badActions) {
  test(`untrusted action fails safely: ${label}`, () => {
    const button = new Element('button', {}, { text: 'Do thing' });
    const disabled = label === 'disabled control';
    const hidden = label === 'hidden control';
    const el = disabled ? new Element('button', {}, { disabled: true }) : hidden ? new Element('button', {}, { hidden: true }) : button;
    const agent = page([el]);
    agent.snapshot();
    const out = JSON.parse(agent.act(raw));
    assert.equal(out.ok, false);
    assert.equal(el.clicks, 0);
  });
}

// 12 permission and data-exposure controls.
for (const [label, attrs] of [
  ['autocomplete cc-number', { autocomplete: 'cc-number' }],
  ['autocomplete cc-exp', { autocomplete: 'cc-exp' }],
  ['autocomplete cc-csc', { autocomplete: 'cc-csc' }],
  ['autocomplete one-time-code', { autocomplete: 'one-time-code' }],
  ['autocomplete current-password', { autocomplete: 'current-password' }],
  ['autocomplete new-password', { autocomplete: 'new-password' }],
  ['password input type', { type: 'password' }],
  ['password textarea label', { 'aria-label': 'Password confirmation' }],
  ['payment button wording', {}],
  ['login button wording', {}],
  ['ordinary submit approval', {}],
  ['normal button no approval', {}],
]) {
  test(`browser agent safety invariant: ${label}`, () => {
    if (label === 'payment button wording') {
      const el = new Element('button', { type: 'button' }, { text: 'Pay now' });
      const agent = page([el]);
      assert.equal(read(agent).elements[0].risk, 'payment');
      assert.equal(act(agent, { type: 'click', id: 'e1', approved: true }).error, 'owner-handoff');
      assert.equal(el.clicks, 0);
      return;
    }
    if (label === 'login button wording') {
      const el = new Element('button', { type: 'button' }, { text: 'Sign in' });
      const agent = page([el]);
      assert.equal(read(agent).elements[0].risk, 'sign-in');
      assert.equal(act(agent, { type: 'click', id: 'e1', approved: true }).error, 'owner-handoff');
      assert.equal(el.clicks, 0);
      return;
    }
    if (label === 'ordinary submit approval') {
      const el = new Element('button', { type: 'submit' }, { text: 'Send', form: new Form() });
      const agent = page([el]);
      read(agent);
      assert.equal(act(agent, { type: 'click', id: 'e1' }).error, 'owner-approval-required');
      assert.equal(act(agent, { type: 'click', id: 'e1', approved: true }).ok, true);
      return;
    }
    if (label === 'normal button no approval') {
      const el = new Element('button', { type: 'button' }, { text: 'Open menu' });
      const agent = page([el]);
      read(agent);
      assert.equal(act(agent, { type: 'click', id: 'e1' }).ok, true);
      return;
    }
    const tag = label === 'password textarea label' ? 'textarea' : 'input';
    const el = new Element(tag, { type: 'text', name: 'field', ...attrs }, { value: 'private' });
    const agent = page([el]);
    assert.equal(read(agent).elements[0].sensitive, true);
    assert.equal(Object.hasOwn(read(agent).elements[0], 'value'), false);
    assert.equal(act(agent, { type: 'type', id: 'e1', text: 'x' }).error, 'sensitive-field');
  });
}


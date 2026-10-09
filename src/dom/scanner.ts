import type { FieldDescriptor, FieldKind } from '../types';
import { collectLabels, explicitLabel, ownKey } from './label';
import { extractCustomValue, isCustomSelect } from './custom';

const SKIP_INPUT_TYPES = new Set([
  'hidden',
  'submit',
  'button',
  'reset',
  'image',
  'file',
  'password',
]);

const CONTROLS = 'input,textarea,select';

function clean(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function isVisible(el: HTMLElement): boolean {
  if (el.hidden) return false;
  if (el.closest('[data-rw-panel]')) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity || '1') === 0) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return true;
}

function cssPath(el: HTMLElement): string {
  const id = el.getAttribute('id');
  if (id && document.querySelectorAll(`#${CSS.escape(id)}`).length === 1) {
    return `#${CSS.escape(id)}`;
  }
  const parts: string[] = [];
  let cur: HTMLElement | null = el;
  let depth = 0;
  while (cur && cur.nodeType === 1 && depth < 5) {
    const node: HTMLElement = cur;
    let sel = node.tagName.toLowerCase();
    const cls = (node.getAttribute('class') || '')
      .split(/\s+/)
      .filter((c) => c && !c.startsWith('rw-'))
      .slice(0, 2);
    if (cls.length) sel += '.' + cls.join('.');
    const parent: HTMLElement | null = node.parentElement;
    if (parent) {
      const sameTag = [...parent.children].filter((c) => c.tagName === node.tagName);
      sel += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }
    parts.unshift(sel);
    cur = node.parentElement;
    depth++;
  }
  return parts.join(' > ');
}

function isEditable(el: HTMLElement): boolean {
  const ce = el.getAttribute('contenteditable');
  return ce === 'true' || ce === '';
}

/** 控件是否可作为用户输入目标（排除隐藏/只读/禁用/选择器搜索框） */
function isEditableControl(c: HTMLElement): boolean {
  if (c instanceof HTMLInputElement) {
    if (c.type === 'hidden' || c.type === 'file' || c.type === 'submit') return false;
    if (c.type === 'checkbox' || c.type === 'radio') return false;
    if (c.readOnly) return false;
    // 选择器组件内部的搜索框不是字段
    if (c.getAttribute('role') === 'combobox') return false;
    if (/search/i.test(c.className) && c.closest('[class*="select"],[class*="picker"]')) return false;
  }
  if ((c as HTMLInputElement).disabled) return false;
  return true;
}

/** 单选框/复选框的可见文本 */
function optionText(input: HTMLInputElement): string {
  const label = input.closest('label');
  if (label) {
    const clone = label.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input').forEach((n) => n.remove());
    const t = clean(clone.textContent);
    if (t) return t;
  }
  return clean(input.value);
}

function kindOfInput(input: HTMLInputElement): FieldKind | null {
  const type = input.type || 'text';
  if (type === 'radio') return 'radio';
  if (type === 'checkbox') return 'checkbox';
  if (SKIP_INPUT_TYPES.has(type)) return null;
  return 'text';
}

/** 原生控件（非 formily wrapper）也能识别：用于无 wrapper 的普通页面 */
function describeNative(el: HTMLElement): FieldDescriptor | null {
  if (el instanceof HTMLInputElement) {
    const kind = kindOfInput(el);
    if (!kind) return null;
    if (kind === 'radio') return null; // 由 wrapper 或分组逻辑处理
    if (kind === 'checkbox') {
      // 单个复选框
      return buildDescriptor(el, 'checkbox', el, [el], optionText(el), '是', []);
    }
    const value = el.value.trim();
    return buildDescriptor(el, 'text', el, [el], el.value, value, []);
  }
  if (el instanceof HTMLTextAreaElement) {
    return buildDescriptor(el, 'textarea', el, [el], el.value, el.value.trim(), []);
  }
  if (el instanceof HTMLSelectElement) {
    const opts = [...el.options].map((o) => clean(o.text)).filter(Boolean);
    const value = el.selectedIndex >= 0 ? clean(el.options[el.selectedIndex]?.text) : '';
    return buildDescriptor(el, 'select', el, [el], value, value, opts);
  }
  if (isEditable(el)) {
    return {
      el,
      kind: 'contenteditable',
      inputType: '',
      labels: collectLabels(el),
      label: explicitLabel(el) || collectLabels(el)[0] || '(未命名字段)',
      name: ownKey(el),
      id: el.getAttribute('id') || '',
      placeholder: '',
      value: clean(el.textContent),
      options: [],
      selector: cssPath(el),
      groupKey: ownKey(el) || '(contenteditable)',
    };
  }
  return null;
}

function buildDescriptor(
  el: HTMLElement,
  kind: FieldKind,
  anchor: HTMLElement,
  targets: HTMLElement[],
  rawValueText: string,
  value: string,
  options: string[],
): FieldDescriptor {
  const labels = collectLabels(anchor);
  const explicit = explicitLabel(anchor);
  const key = ownKey(anchor);
  return {
    el,
    kind,
    targets,
    inputType: el instanceof HTMLInputElement ? el.type : '',
    labels,
    label: explicit || labels[0] || key || '(未命名字段)',
    name: key,
    id: el.getAttribute('id') || '',
    placeholder: (el as HTMLInputElement).placeholder || '',
    value,
    options,
    selector: cssPath(anchor),
    groupKey: key || labels[0] || rawValueText || cssPath(anchor),
  };
}

/**
 * 以带 data-form-field-i18n-name 的 wrapper 为单位描述一个字段。
 * 覆盖 UDesign/formily：自定义 Select、单选组、日期区间、普通输入。
 */
function describeWrapper(w: HTMLElement): FieldDescriptor | null {
  const label = clean(w.getAttribute('data-form-field-i18n-name')) || explicitLabel(w);
  if (!label) return null;
  const key = clean(w.getAttribute('data-form-field-name')) || w.getAttribute('data-form-field-id') || '';

  const controls = [...w.querySelectorAll<HTMLElement>(CONTROLS)].filter(
    (c) => !c.closest('[data-rw-panel]'),
  );
  const radios = controls.filter(
    (c): c is HTMLInputElement => c instanceof HTMLInputElement && c.type === 'radio',
  );
  const checkboxes = controls.filter(
    (c): c is HTMLInputElement => c instanceof HTMLInputElement && c.type === 'checkbox',
  );
  const editable = controls.filter(isEditableControl);
  const textarea = editable.find((c) => c instanceof HTMLTextAreaElement);
  const select = editable.find((c) => c instanceof HTMLSelectElement);
  const inputs = editable.filter(
    (c): c is HTMLInputElement => c instanceof HTMLInputElement,
  );

  const base = {
    el: w,
    inputType: '',
    labels: [label],
    label,
    name: key,
    id: w.getAttribute('id') || '',
    placeholder: '',
    options: [] as string[],
    selector: cssPath(w),
    groupKey: key || label,
  };

  // 单选组
  if (radios.length) {
    const checked = radios.find((r) => r.checked);
    return {
      ...base,
      kind: 'radio',
      el: radios[0],
      targets: radios,
      value: checked ? optionText(checked) : '',
      options: radios.map(optionText),
      placeholder: '',
    };
  }

  // 复选框组
  if (checkboxes.length > 1) {
    const checked = checkboxes.filter((c) => c.checked).map(optionText);
    return {
      ...base,
      kind: 'checkbox',
      el: checkboxes[0],
      targets: checkboxes,
      value: checked.join('、'),
      options: checkboxes.map(optionText),
    };
  }

  // 自定义 Select（有已选值节点 / combobox，但没有可编辑文本控件）
  if (isCustomSelect(w) && editable.length === 0) {
    const values = extractCustomValue(w);
    return { ...base, kind: 'custom', value: values.join('、'), options: [] };
  }

  // 日期区间等：多个可编辑同类控件
  if (editable.length > 1) {
    const values = editable
      .map((c) => ("value" in c ? (c as HTMLInputElement).value.trim() : ''))
      .filter(Boolean);
    return {
      ...base,
      kind: 'range',
      targets: editable,
      value: values.join(' ~ '),
    };
  }

  // 单个可编辑控件
  if (textarea) {
    return { ...base, kind: 'textarea', el: textarea, targets: [textarea], value: textarea.value.trim() };
  }
  if (select) {
    const opts = [...select.options].map((o) => clean(o.text)).filter(Boolean);
    const value = select.selectedIndex >= 0 ? clean(select.options[select.selectedIndex]?.text) : '';
    return { ...base, kind: 'select', el: select, targets: [select], value, options: opts };
  }
  if (inputs.length === 1) {
    const input = inputs[0];
    return {
      ...base,
      kind: 'text',
      el: input,
      targets: [input],
      inputType: input.type,
      placeholder: input.placeholder || '',
      value: input.value.trim(),
    };
  }

  return null;
}

/** 所有“字段 wrapper”（带标签元数据、非控件本身），取最外层 */
function wrapperCandidates(): HTMLElement[] {
  const all = [...document.querySelectorAll<HTMLElement>('[data-form-field-i18n-name]')];
  return all.filter((el) => {
    if (/^(input|textarea|select)$/i.test(el.tagName)) return false;
    if (el.closest('[data-rw-panel]')) return false;
    // 最外层：祖先中不应再有同类 wrapper
    if (el.parentElement?.closest('[data-form-field-i18n-name]')) return false;
    return isVisible(el);
  });
}

/** 扫描页面，返回所有可处理字段 */
export function scanFields(): FieldDescriptor[] {
  const descriptors: FieldDescriptor[] = [];

  // 1) formily / UDesign：以 wrapper 为单位
  for (const w of wrapperCandidates()) {
    try {
      const d = describeWrapper(w);
      if (d) descriptors.push(d);
    } catch {
      /* 忽略单个 wrapper 的解析错误 */
    }
  }

  // 2) 原生控件兜底：处理不在已认领 wrapper 内的控件，避免重复
  const nodes = [
    ...document.querySelectorAll<HTMLElement>(
      `${CONTROLS}, [contenteditable="true"], [contenteditable=""]`,
    ),
  ];
  const radioGroups = new Map<string, FieldDescriptor>();

  for (const el of nodes) {
    if (el.closest('[data-rw-panel]')) continue;
    // 已被带标签的 wrapper 认领的控件不再单独识别，避免产生“(未命名字段)”
    if (el.closest('[data-form-field-i18n-name]')) continue;
    if (!isVisible(el)) continue;

    // 原生单选组
    if (el instanceof HTMLInputElement && el.type === 'radio') {
      if (!isEditableControl(el)) continue;
      const name = el.getAttribute('name') || el.closest('form')?.getAttribute('data-id') || '';
      const scope: ParentNode = el.closest('form') ?? document;
      const group = name
        ? [...scope.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`)]
        : [el];
      const gk = name ? `radio:name:${name}` : `radio:dom:${cssPath(el.parentElement ?? el)}`;
      if (radioGroups.has(gk)) continue;
      const checked = group.find((r) => r.checked);
      const d: FieldDescriptor = {
        el: group[0] ?? el,
        kind: 'radio',
        targets: group,
        inputType: 'radio',
        labels: collectLabels(el),
        label: explicitLabel(el) || collectLabels(el)[0] || name || '(未命名字段)',
        name,
        id: el.getAttribute('id') || '',
        placeholder: '',
        value: checked ? optionText(checked) : '',
        options: group.map(optionText),
        selector: cssPath(el),
        groupKey: gk,
      };
      radioGroups.set(gk, d);
      descriptors.push(d);
      continue;
    }

    const d = describeNative(el);
    if (d) descriptors.push(d);
  }

  return descriptors;
}

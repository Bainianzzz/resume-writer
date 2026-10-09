import { stripNoise } from '../match/text';

function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

function visibleText(el: Element | null | undefined): string {
  if (!el) return '';
  if (el instanceof HTMLElement && el.hasAttribute('data-rw-ignore')) return '';
  return cleanText(el.textContent);
}

function isNoise(text: string): boolean {
  if (!text) return true;
  const t = text.trim();
  if (t.length === 0 || t.length > 120) return true;
  if (/^[\s*:：·・,，.。;；-]+$/.test(t)) return true;
  return false;
}

/**
 * 纯格式占位符（YYYY-MM、yyyy/mm/dd 等）没有语义，不能当标签。
 */
export function isFormatPlaceholder(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return /^[y{4}年/\-.\s]*(mm?月?|dd?日?)[/\-.\s]*(dd?日?)?$/.test(t) && /[ymd]/.test(t);
}

interface LabelOptions {
  /** 允许把 format 占位符也当作标签（默认不允许） */
  allowFormatPlaceholder?: boolean;
}

/**
 * 去掉标签里的括号补充说明，如
 * “请列出你常用的 AI 工具 & 模型（编码工具：…）” -> “请列出你常用的 AI 工具 & 模型”。
 * 若括号外为空则保留原文。
 */
export function stripParenthetical(text: string): string {
  const cleaned = cleanText(text);
  let prev = cleaned;
  let out = cleaned.replace(/[（(][^（()）]*[)）]/g, '');
  while (out !== prev) {
    prev = out;
    out = out.replace(/[（(][^（()）]*[)）]/g, '');
  }
  const trimmed = cleanText(out).replace(/[：:*]\s*$/, '').trim();
  return trimmed || cleaned;
}

/**
 * 字段自带的元数据属性 —— 最可靠的标签来源。
 * 命中一个就不必再猜 DOM 结构。
 */
const EXPLICIT_LABEL_ATTRS = [
  'data-form-field-i18n-name',
  'data-form-field-label',
  'data-label',
  'data-field-label',
  'data-title',
];

const EXPLICIT_KEY_ATTRS = ['data-form-field-name', 'data-form-field-id', 'data-field-name'];

/** 从元素自身或其祖先读取显式标签属性 */
export function explicitLabel(el: HTMLElement): string {
  let node: HTMLElement | null = el;
  let depth = 0;
  while (node && depth < 5) {
    for (const attr of EXPLICIT_LABEL_ATTRS) {
      const v = cleanText(node.getAttribute(attr));
      if (v && !isNoise(v)) return v;
    }
    node = node.parentElement;
    depth++;
  }
  return '';
}

/** 仅读取元素自身的字段键（不向祖先查找，避免子控件冒领外层字段） */
export function ownKey(el: HTMLElement): string {
  for (const attr of EXPLICIT_KEY_ATTRS) {
    const v = cleanText(el.getAttribute(attr));
    if (v) return v;
  }
  return cleanText(el.getAttribute('name'));
}

/** 从元素自身或其祖先读取稳定的字段键（name/id） */
export function explicitKey(el: HTMLElement): string {
  let node: HTMLElement | null = el;
  let depth = 0;
  while (node && depth < 5) {
    for (const attr of EXPLICIT_KEY_ATTRS) {
      const v = cleanText(node.getAttribute(attr));
      if (v) return v;
    }
    node = node.parentElement;
    depth++;
  }
  return '';
}

/** 从表格上下文中取标签（左单元格 / 上方表头） */
function tableLabels(el: HTMLElement): string[] {
  const out: string[] = [];
  const cell = el.closest('td,th');
  if (!cell) return out;
  const prev = cell.previousElementSibling;
  if (prev) out.push(visibleText(prev));
  const row = cell.closest('tr');
  const table = cell.closest('table');
  if (row && table) {
    const headerRow =
      row.parentElement?.querySelector('tr:first-child') ?? table.querySelector('tr');
    if (headerRow && headerRow !== row) {
      const idx = [...row.children].indexOf(cell);
      out.push(visibleText(headerRow.children[idx]));
    }
  }
  return out;
}

/**
 * 收集某表单元素所有可能的标签文本（按可信度排序、去重）。
 * 顺序：显式属性 → 标准 HTML 关联 → 相邻文本。
 */
export function collectLabels(el: HTMLElement, options: LabelOptions = {}): string[] {
  const candidates: string[] = [];
  const push = (text: string) => {
    const t = stripNoise(cleanText(text));
    if (isNoise(t)) return;
    if (!candidates.includes(t)) candidates.push(t);
  };

  const id = el.getAttribute('id');
  const name = el.getAttribute('name');

  // 1. 显式元数据属性（最可靠）
  push(explicitLabel(el));
  // 2. label[for]
  if (id) {
    for (const label of document.querySelectorAll(`label[for="${CSS.escape(id)}"]`)) {
      push(visibleText(label));
    }
  }
  // 3. 包裹式 label
  const wrap = el.closest('label');
  if (wrap) {
    const clone = wrap.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input,select,textarea').forEach((n) => n.remove());
    push(visibleText(clone));
  }
  // 4. aria
  push(el.getAttribute('aria-label') ?? '');
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    for (const ref of labelledby.split(/\s+/)) {
      push(visibleText(document.getElementById(ref)));
    }
  }
  // 5. fieldset legend
  const legend = el.closest('fieldset')?.querySelector('legend');
  if (legend) push(visibleText(legend));
  // 6. 表格上下文
  tableLabels(el).forEach(push);
  // 7. 紧邻的前置兄弟（文本节点式标签）
  let prev: Element | null = el.previousElementSibling;
  let hop = 0;
  while (prev && hop < 3) {
    if (prev.matches('input,select,textarea,button,script,style')) break;
    const t = visibleText(prev);
    if (t && t.length <= 40) {
      push(t);
      break;
    }
    prev = prev.previousElementSibling;
    hop++;
  }
  // 8. 父容器剩余文本（去掉控件子树）
  const parent = el.parentElement;
  if (parent) {
    const clone = parent.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input,select,textarea,button,script,style').forEach((n) => n.remove());
    const text = visibleText(clone);
    if (text && text.length <= 40) push(text);
  }
  // 9. title
  push(el.getAttribute('title') ?? '');
  // 10. placeholder（纯格式占位符不采信）
  const ph = el.getAttribute('placeholder') ?? '';
  if (options.allowFormatPlaceholder || !isFormatPlaceholder(ph)) push(ph);
  // 11. name / id 兜底
  if (name && !/^[\w-]{1,3}\d*$/.test(name)) push(name);
  if (id && !/^[\w-]{1,3}\d*$/.test(id)) push(id.replace(/[-_]/g, ' '));

  return candidates;
}

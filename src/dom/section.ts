/**
 * 区域推断：一个页面里「实习经历」「项目经历」常有同名子字段（都叫“描述”），
 * 只按标签匹配会把它们弄混。这里从字段所在的 DOM 位置向上找最近的区域标题，
 * 例如“实习经历”“项目经历”，由调用方拼成 `实习经历·描述` 这样的字段名。
 */

const TITLE_CLASS_RE = /title|header|heading|module|section|group|caption|legend/i;
const HEADING_TAG_RE = /^H[1-6]$/;

/** 区域标题的最大长度，超过就不像标题 */
const MAX_TITLE_LENGTH = 20;
/** 向上查找区域标题的最大层数 */
const MAX_DEPTH = 10;

function clean(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function isTitleLike(el: Element): boolean {
  if (HEADING_TAG_RE.test(el.tagName)) return true;
  if (el.tagName === 'LEGEND') return true;
  if (el.getAttribute('role') === 'heading') return true;
  return TITLE_CLASS_RE.test(el.getAttribute('class') || '');
}

/**
 * 字段自身所属的最外层字段容器（UD/formily 的 wrapper）。
 * 用来把“字段自己的标签”排除在区域标题之外。
 */
function fieldScope(el: HTMLElement): HTMLElement {
  let scope = el.closest<HTMLElement>('[data-form-field-i18n-name]');
  while (scope) {
    const up = scope.parentElement?.closest<HTMLElement>('[data-form-field-i18n-name]');
    if (!up) break;
    scope = up;
  }
  return scope ?? el;
}

/**
 * 只在容器的直接子层到第三层里找标题，避免对大子树做全量扫描。
 * 三层是必要的：得物页的标题结构是 `模块 > -left > -title > p`。
 */
function shallowCandidates(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(':scope > *, :scope > * > *, :scope > * > * > *')];
}

/** 在 container 内找区域标题：短文本、不含控件、位于字段之前、且不在字段自身区域内 */
function titleIn(container: HTMLElement, scope: HTMLElement, ownLabels: Set<string>): string {
  for (const el of shallowCandidates(container)) {
    if (el.children.length > 0) continue;
    if (scope.contains(el)) continue;
    if (el.closest('[data-rw-panel]')) continue;
    // 别的字段自己的标签不算区域标题
    const host = el.closest('[data-form-field-i18n-name]');
    if (host && host !== scope) continue;
    if (!isTitleLike(el)) continue;
    const text = clean(el.textContent);
    if (!text || text.length > MAX_TITLE_LENGTH) continue;
    if (ownLabels.has(text)) continue;
    // 标题必须出现在字段之前
    if (!(el.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    return text;
  }
  return '';
}

/** 表单容器：区域标题都在表单内部，越过它只会抓到页面大标题 */
function formBoundary(node: HTMLElement): boolean {
  return node.tagName === 'FORM' || node.getAttribute('role') === 'form';
}

/** 从字段位置推断所属区域；找不到返回空串 */
export function inferSection(el: HTMLElement, ownLabels: string[]): string {
  const scope = fieldScope(el);
  const own = new Set(ownLabels.map((l) => clean(l)).filter(Boolean));

  let node: HTMLElement | null = scope.parentElement;
  for (let depth = 0; depth < MAX_DEPTH && node && node !== document.body; depth++) {
    if (node.closest('[data-rw-panel]')) break;
    const title = titleIn(node, scope, own);
    if (title) return title;
    if (formBoundary(node)) break;
    node = node.parentElement;
  }
  return '';
}

/** 字段的最小形态：只有标签相关内容 */
export interface LabeledField {
  label: string;
  labels: string[];
}

/**
 * 给字段名加上区域前缀，`描述` -> `实习经历·描述`。
 * 已带前缀或无区域时不重复加。
 */
export function applySectionPrefix<T extends LabeledField>(field: T, section: string): T {
  const name = clean(section).replace(/[:：]+$/, '').trim();
  if (!name) return field;
  const prefix = `${name}·`;
  if (field.label.startsWith(prefix)) return field;
  const own = field.labels.length ? field.labels : [field.label];
  return {
    ...field,
    label: `${prefix}${field.label}`,
    labels: own.map((l) => (l.startsWith(prefix) ? l : prefix + l)),
  };
}

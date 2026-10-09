import type { FieldDescriptor } from '../types';
import { normalize, similarity } from '../match/text';
import { extractCustomValue } from './custom';

function setNativeValue(el: HTMLElement, value: string): void {
  const proto = Object.getPrototypeOf(el);
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(el, value);
  } else {
    (el as HTMLInputElement).value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function fireFocus(el: HTMLElement): void {
  el.dispatchEvent(new FocusEvent('focus', { bubbles: false }));
}

function fireBlur(el: HTMLElement): void {
  el.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** 把 ISO 或常见中文日期转成 input[type=date] 需要的 yyyy-mm-dd */
function toDateValue(value: string, type: string): string {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v) && type === 'date') return v;
  if (/^\d{4}-\d{2}$/.test(v) && type === 'month') return v;
  const m = v.match(/(\d{4})\D+(\d{1,2})?(\D+(\d{1,2}))?/);
  if (!m) return v;
  const y = m[1];
  const mo = (m[2] || '1').padStart(2, '0');
  const d = (m[4] || '1').padStart(2, '0');
  if (type === 'month') return `${y}-${mo}`;
  if (type === 'date') return `${y}-${mo}-${d}`;
  return v;
}

function matchOption(options: { text: string; value: string }[], target: string): number {
  const nt = normalize(target);
  let best = -1;
  let bestScore = 0;
  options.forEach((opt, i) => {
    const score = Math.max(
      similarity(opt.text, target),
      normalize(opt.value) === nt ? 1 : 0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return bestScore >= 0.5 ? best : -1;
}

/** 在 radio 组里按文本匹配并选中 */
function fillRadioGroup(field: FieldDescriptor, value: string): boolean {
  const group = (field.targets ?? [field.el]).filter(
    (t): t is HTMLInputElement => t instanceof HTMLInputElement,
  );
  for (const radio of group) {
    const label = radio.closest('label');
    let text = '';
    if (label) {
      const clone = label.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('input').forEach((n) => n.remove());
      text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    }
    if (!text) text = (radio.value || '').trim();
    if (similarity(text, value) >= 0.5 || normalize(radio.value) === normalize(value)) {
      if (!radio.checked) {
        fireFocus(radio);
        radio.click();
        if (!radio.checked) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      return true;
    }
  }
  return false;
}

/** 向单个字段写入值，返回是否成功。custom/range 需异步/多目标处理 */
export function fillField(field: FieldDescriptor, value: string): boolean {
  if (!value) return false;
  if (field.kind === 'custom' || field.kind === 'range') return false;
  const el = field.el;

  if (field.kind === 'contenteditable') {
    el.focus();
    el.textContent = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
    return true;
  }

  if (field.kind === 'select' && el instanceof HTMLSelectElement) {
    const options = [...el.options].map((o) => ({ text: o.text || '', value: o.value || '' }));
    const idx = matchOption(options, value);
    if (idx < 0) return false;
    el.selectedIndex = idx;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (field.kind === 'radio') {
    return fillRadioGroup(field, value);
  }

  if (field.kind === 'checkbox') {
    // 复选框组：按值勾选
    if (field.targets && field.targets.length > 1) {
      const want = new Set(value.split(/[、,，;；|/\n]+/).map((v) => v.trim()).filter(Boolean));
      let any = false;
      for (const t of field.targets) {
        if (!(t instanceof HTMLInputElement)) continue;
        const label = t.closest('label');
        const text = label ? (label.textContent || '').replace(/\s+/g, ' ').trim() : t.value;
        const should = [...want].some((w) => similarity(w, text) >= 0.5);
        if (t.checked !== should) {
          t.click();
          if (t.checked !== should) {
            t.checked = should;
            t.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        any = true;
      }
      return any;
    }
    if (el instanceof HTMLInputElement) {
      const truthy = /^(是|yes|true|1|有|同意|选中)$/i.test(value.trim());
      if (el.checked !== truthy) {
        el.click();
        if (el.checked !== truthy) {
          el.checked = truthy;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      return true;
    }
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    let v = value;
    if (el.type === 'date' || el.type === 'month') v = toDateValue(value, el.type);
    fireFocus(el);
    setNativeValue(el, v);
    if (el.value !== v) {
      // 某些组件拦截了 set，退回直接赋值
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    fireBlur(el);
    return true;
  }

  return false;
}

/** 区间字段：把 “a ~ b” 拆开分别写入多个目标控件 */
export function fillRange(field: FieldDescriptor, value: string): boolean {
  const targets = (field.targets ?? []).filter(
    (t): t is HTMLInputElement | HTMLTextAreaElement =>
      t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement,
  );
  if (!targets.length) return false;
  const parts = value
    .split(/\s*(?:~|～|至|到|-{1,2}>|—|\/)\s*/)
    .map((v) => v.trim())
    .filter(Boolean);
  let any = false;
  targets.forEach((target, i) => {
    const v = parts[i] ?? (i === 0 ? parts[0] : '');
    if (!v) return;
    fireFocus(target);
    setNativeValue(target, toDateValue(v, (target as HTMLInputElement).type));
    if (!target.value) {
      (target as HTMLInputElement).value = v;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
    fireBlur(target);
    any = true;
  });
  return any;
}

/** 统一处理需要异步/多目标的字段：custom / range */
export async function fillAsyncField(field: FieldDescriptor, value: string): Promise<boolean> {
  if (field.kind === 'custom') {
    const values = value.split(/[、,，;；|/\n]+/).map((v) => v.trim()).filter(Boolean);
    return fillCustomSelect(field, values);
  }
  if (field.kind === 'range') return fillRange(field, value);
  return false;
}


const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function clickEl(el: HTMLElement): void {
  // 注意：不能用 view: window —— 油猴沙箱里的 window 不是真实 Window，构造 MouseEvent 会抛错
  const opts: MouseEventInit = { bubbles: true, cancelable: true };
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.dispatchEvent(new MouseEvent('click', opts));
}

function isShown(el: HTMLElement): boolean {
  if (el.closest('[data-rw-panel]')) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return el.getClientRects().length > 0;
}

function dropdownOptions(): HTMLElement[] {
  const dropdowns = [
    ...document.querySelectorAll<HTMLElement>(
      '[class*="select-dropdown"],[class*="select__dropdown"],[class*="dropdown"],[role="listbox"]',
    ),
  ].filter(isShown);
  const out: HTMLElement[] = [];
  for (const d of dropdowns) {
    out.push(
      ...d.querySelectorAll<HTMLElement>(
        [
          '[role="option"]',
          '[class*="list__item"]',
          '[class*="select-item-option"]',
          '[class*="dropdown-menu-item"]',
          '[class*="dropdown__menu__item"]',
          '[class*="selectItem"]',
          '[class*="menu__item"]',
          '[class*="option"]',
        ].join(','),
      ),
    );
  }
  // 只保留最外层候选，避免父子项重复
  return out.filter((o) => shallowest(out, o) && isShown(o) && (o.textContent ?? '').trim());
}

function shallowest(list: HTMLElement[], el: HTMLElement): boolean {
  return !list.some((o) => o !== el && o.contains(el));
}

/** 轮询等待下拉选项出现（UDesign 等组件渲染有延迟） */
async function waitForOptions(timeout = 1600): Promise<HTMLElement[]> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const opts = dropdownOptions();
    if (opts.length) return opts;
    await sleep(120);
  }
  return [];
}

function pickOption(options: HTMLElement[], target: string): { el: HTMLElement; score: number } | null {
  let best: HTMLElement | null = null;
  let bestScore = 0;
  for (const opt of options) {
    const text = (opt.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text.length > 40) continue; // 排除容器级节点
    const score = Math.max(similarity(text, target), text === target ? 1 : text.includes(target) ? 0.85 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  }
  return best ? { el: best, score: bestScore } : null;
}

/**
 * 填充自定义组件（div 型 select）。模拟交互：
 * 打开下拉 -> 可搜索则输入关键字 -> 点选目标项 -> 收起。
 * 支持多选：逐个选择。带轮询与重试，兼容渲染延迟。
 */
export async function fillCustomSelect(
  field: FieldDescriptor,
  values: string[],
): Promise<boolean> {
  const root = field.el;
  const trigger =
    root.querySelector<HTMLElement>('[class*="selector"]') ??
    root.querySelector<HTMLElement>('[role="combobox"]') ??
    root.querySelector<HTMLElement>('[class*="select-selection"]') ??
    root;
  const already = () => new Set(extractCustomValue(root));
  let any = false;

  for (const raw of values) {
    const target = raw.trim();
    if (!target || already().has(target)) continue;

    // 可搜索组件：先尝试输入关键字过滤（readonly 的搜索框改 value 无效）
    let opened = false;
    for (let attempt = 0; attempt < 2 && !opened; attempt++) {
      clickEl(trigger);
      const search = root.querySelector<HTMLInputElement>('input[class*="search" i]:not([readonly])');
      if (search) {
        setNativeValue(search, target);
      }
      const options = await waitForOptions(attempt === 0 ? 1200 : 1600);
      if (!options.length) continue;

      const picked = pickOption(options, target);
      if (picked && picked.score >= 0.5) {
        clickEl(picked.el);
        await sleep(250);
        // 校验是否真的选上，没选上则重试
        if (already().has(target)) {
          opened = true;
          any = true;
        }
      } else {
        break; // 下拉已打开但没有匹配项，不必重试
      }
    }

    // 收起下拉
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(120);
  }

  return any;
}

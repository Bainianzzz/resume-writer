import type { FieldDescriptor } from '../types';

function clean(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * 自定义 Select 的“已选值”节点类名特征，覆盖 UDesign v5 / UDesign(atsx) / antd：
 * - UDesign v5：selector__selectItem（驼峰）
 * - UDesign/antd 旧版：selected-value / selection-item
 * - antd 多选标签块：select-selection__choice / selection-overflow-item
 */
export const VALUE_SELECTOR = [
  '[class*="selector__selectItem"]',
  '[class*="selectItem"]',
  '[class*="selected-value"]',
  '[class*="selection-item"]',
  '[class*="select-selection__choice"]',
  '[class*="selection-overflow-item"]',
].join(',');

/** 去掉标签块里的序号前缀，如 “①杭州”“1 杭州” -> “杭州” */
function stripIndex(text: string): string {
  return text.replace(/^[\s\d①-⑳·.、，)）+]+/, '').trim();
}

/** 只保留最外层匹配节点，避免子元素（删除图标、序号）重复计入 */
function outermost(nodes: HTMLElement[]): HTMLElement[] {
  return nodes.filter((e) => !nodes.some((o) => o !== e && o.contains(e)));
}

/** 从自定义组件里读已选值（单选返回 1 个，多选返回多个） */
export function extractCustomValue(root: HTMLElement): string[] {
  const nodes = outermost([...root.querySelectorAll<HTMLElement>(VALUE_SELECTOR)]);
  const out: string[] = [];
  for (const node of nodes) {
    const text = stripIndex(clean(node.textContent));
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

/** 是否是自定义选择组件（含已选值节点，或角色为 combobox/listbox） */
export function isCustomSelect(root: HTMLElement): boolean {
  return !!root.querySelector(VALUE_SELECTOR) || !!root.querySelector('[role="combobox"],[role="listbox"]');
}

export type { FieldDescriptor };

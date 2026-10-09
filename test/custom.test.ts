import { describe, expect, it } from 'vitest';
import { extractCustomValue, isCustomSelect } from '../src/dom/custom';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

describe('extractCustomValue', () => {
  it('UDesign v5 单选：selectItem（驼峰类名）', () => {
    const root = mount(`
      <div class="ud__select">
        <div class="ud__select__selector__content">
          <div class="ud__select__selector__selectItem">男</div>
        </div>
      </div>`);
    expect(extractCustomValue(root)).toEqual(['男']);
  });

  it('UDesign 旧版单选：selected-value', () => {
    const root = mount(`
      <div class="atsx-select-selection">
        <div class="atsx-select-selection-selected-value">本科</div>
      </div>`);
    expect(extractCustomValue(root)).toEqual(['本科']);
  });

  it('多选：标签块并剥离序号前缀', () => {
    const root = mount(`
      <div class="atsx-select-selection atsx-select-selection--multiple">
        <ul>
          <li class="atsx-select-selection__choice"><span class="select-item-tag">1</span><span class="select-item-label">杭州</span></li>
          <li class="atsx-select-selection__choice"><span class="select-item-tag">2</span><span class="select-item-label">上海</span></li>
        </ul>
      </div>`);
    expect(extractCustomValue(root)).toEqual(['杭州', '上海']);
  });

  it('父子同匹配时只取最外层，避免重复', () => {
    const root = mount(`
      <div class="selection-item">
        <div class="selection-item">重复</div>
      </div>`);
    expect(extractCustomValue(root)).toEqual(['重复']);
  });

  it('无已选值时返回空数组', () => {
    const root = mount(`<div class="ud__select"><div class="ud__select__selector"></div></div>`);
    expect(extractCustomValue(root)).toEqual([]);
  });
});

describe('isCustomSelect', () => {
  it('含已选值节点或 combobox 角色时为真', () => {
    expect(isCustomSelect(mount(`<div><div class="selected-value">x</div></div>`))).toBe(true);
    expect(isCustomSelect(mount(`<div><div role="combobox"></div></div>`))).toBe(true);
  });

  it('普通容器为假', () => {
    expect(isCustomSelect(mount(`<div><input type="text"></div>`))).toBe(false);
  });
});

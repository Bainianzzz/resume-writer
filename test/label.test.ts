import { describe, expect, it } from 'vitest';
import { collectLabels, explicitKey, explicitLabel, isFormatPlaceholder, ownKey, stripParenthetical } from '../src/dom/label';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

describe('isFormatPlaceholder', () => {
  it('识别纯格式占位符', () => {
    for (const s of ['YYYY-MM', 'YYYY-MM-DD', 'yyyy/mm/dd', 'YYYY年MM月']) {
      expect(isFormatPlaceholder(s)).toBe(true);
    }
  });

  it('不误伤正常占位符', () => {
    for (const s of ['请选择', '请输入姓名', '邮箱', '2023-09']) {
      expect(isFormatPlaceholder(s)).toBe(false);
    }
  });
});

describe('stripParenthetical', () => {
  it('去掉括号补充说明，保留主干', () => {
    expect(stripParenthetical('请列出你常用的 AI 工具 & 模型（编码工具：Cursor、GitHub Copilot……）')).toBe(
      '请列出你常用的 AI 工具 & 模型',
    );
    expect(stripParenthetical('姓名（必填）')).toBe('姓名');
  });

  it('支持中英文括号与嵌套', () => {
    expect(stripParenthetical('描述(Description)')).toBe('描述');
    expect(stripParenthetical('分数（满分（100）分）')).toBe('分数');
  });

  it('括号外为空时保留原文', () => {
    expect(stripParenthetical('（仅说明）')).toBe('（仅说明）');
  });

  it('无括号时原样返回', () => {
    expect(stripParenthetical('学校名称')).toBe('学校名称');
  });
});

describe('explicitLabel / ownKey', () => {
  it('读取 data-form-field-i18n-name 作为标签', () => {
    mount(
      `<div data-form-field-id="link" data-form-field-name="link" data-form-field-i18n-name="项目链接">
         <input class="ud__native-input" data-form-field-id="link" data-form-field-name="link" data-form-field-i18n-name="项目链接">
       </div>`,
    );
    const input = document.querySelector('input') as HTMLElement;
    expect(explicitLabel(input)).toBe('项目链接');
  });

  it('ownKey 只读元素自身属性，不向祖先查找', () => {
    mount(
      `<div data-form-field-name="gender"><input role="combobox" class="ud__select__selector__search__input"></div>`,
    );
    const input = document.querySelector('input') as HTMLElement;
    expect(ownKey(input)).toBe('');
    expect(explicitKey(input)).toBe('gender');
  });
});

describe('collectLabels', () => {
  it('label[for]', () => {
    mount(`<label for="name">姓名</label><input id="name" type="text">`);
    expect(collectLabels(document.querySelector('input') as HTMLElement)[0]).toBe('姓名');
  });

  it('包裹式 label', () => {
    mount(`<label>邮箱 <input type="email"></label>`);
    expect(collectLabels(document.querySelector('input') as HTMLElement)[0]).toBe('邮箱');
  });

  it('aria-label', () => {
    mount(`<div><input aria-label="手机号码" type="tel"></div>`);
    expect(collectLabels(document.querySelector('input') as HTMLElement)[0]).toBe('手机号码');
  });

  it('表格左侧单元格', () => {
    mount(`<table><tr><td>毕业院校</td><td><input type="text"></td></tr></table>`);
    expect(collectLabels(document.querySelector('input') as HTMLElement)[0]).toBe('毕业院校');
  });

  it('前置兄弟文本', () => {
    mount(`<div><span>专业名称</span><input type="text"></div>`);
    expect(collectLabels(document.querySelector('input') as HTMLElement)[0]).toBe('专业名称');
  });

  it('纯格式 placeholder 不被当作标签', () => {
    mount(`<div><input type="month" placeholder="YYYY-MM"></div>`);
    const labels = collectLabels(document.querySelector('input') as HTMLElement);
    expect(labels).not.toContain('YYYY-MM');
  });
});

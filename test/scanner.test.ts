import { beforeEach, describe, expect, it } from 'vitest';
import { scanFields } from '../src/dom/scanner';
import type { FieldDescriptor } from '../src/types';

/** 真实结构：字段元数据在 wrapper（.ud-formily-item），内部含 label 与控件 */
function wrapper(attrs: string, inner: string): string {
  const label = attrs.match(/i18n-name="([^"]+)"/)?.[1] ?? '';
  return `<div class="ud-formily-item" ${attrs}>
    <div class="ud-formily-item-label"><label>${label}</label></div>
    <div class="ud-formily-item-control">${inner}</div>
  </div>`;
}

function scan(): FieldDescriptor[] {
  return scanFields();
}

function byLabel(fields: FieldDescriptor[], label: string): FieldDescriptor | undefined {
  return fields.find((f) => f.label === label);
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('scanFields：formily/UDesign wrapper', () => {
  it('文本框：读显式标签与值', () => {
    document.body.innerHTML = wrapper(
      'data-form-field-id="name" data-form-field-name="name" data-form-field-i18n-name="姓名"',
      `<input class="ud__native-input" data-form-field-id="name" data-form-field-name="name" data-form-field-i18n-name="姓名" value="周启飏">`,
    );
    const f = byLabel(scan(), '姓名');
    expect(f?.kind).toBe('text');
    expect(f?.value).toBe('周启飏');
  });

  it('日期字段：标签来自 wrapper，格式占位符被忽略', () => {
    document.body.innerHTML = wrapper(
      'data-form-field-id="birthday" data-form-field-i18n-name="出生日期"',
      `<input class="ud__picker-input ud__native-input" placeholder="YYYY-MM" value="">`,
    );
    const f = byLabel(scan(), '出生日期');
    expect(f?.kind).toBe('text');
    expect(f?.value).toBe('');
  });

  it('自定义单选下拉：性别', () => {
    document.body.innerHTML = wrapper(
      'data-form-field-id="gender" data-form-field-name="gender" data-form-field-i18n-name="性别"',
      `<div class="ud__select"><div class="ud__select__selector">
         <div class="ud__select__selector__content"><div class="ud__select__selector__selectItem">男</div></div>
         <div class="ud__select__selector__search"><input class="ud__select__selector__search__input" role="combobox" type="search" readonly></div>
       </div></div>`,
    );
    const f = byLabel(scan(), '性别');
    expect(f?.kind).toBe('custom');
    expect(f?.value).toBe('男');
  });

  it('自定义多选下拉：意向城市', () => {
    document.body.innerHTML = wrapper(
      'data-form-field-id="cities" data-form-field-name="cities" data-form-field-i18n-name="意向城市"',
      `<div class="atsx-select"><div class="atsx-select-selection atsx-select-selection--multiple" role="combobox">
         <ul>
           <li class="atsx-select-selection__choice"><span class="select-item-tag">1</span><span class="select-item-label">杭州</span></li>
           <li class="atsx-select-selection__choice"><span class="select-item-tag">2</span><span class="select-item-label">上海</span></li>
         </ul>
         <li class="atsx-select-search"><input class="atsx-select-search__field"></li>
       </div></div>`,
    );
    const f = byLabel(scan(), '意向城市');
    expect(f?.kind).toBe('custom');
    expect(f?.value).toBe('杭州、上海');
  });

  it('单选组：选项文本取自 label', () => {
    document.body.innerHTML = wrapper(
      'data-form-field-id="code_type" data-form-field-name="code_type" data-form-field-i18n-name="推荐方式"',
      `<div class="ud__radio__list">
         <label class="ud__radio__wrapper"><input type="radio" class="ud__radio__input" name="code_type" checked><span>无</span></label>
         <label class="ud__radio__wrapper"><input type="radio" class="ud__radio__input" name="code_type"><span>内推</span></label>
         <label class="ud__radio__wrapper"><input type="radio" class="ud__radio__input" name="code_type"><span>大使推荐</span></label>
       </div>`,
    );
    const f = byLabel(scan(), '推荐方式');
    expect(f?.kind).toBe('radio');
    expect(f?.value).toBe('无');
    expect(f?.options).toEqual(['无', '内推', '大使推荐']);
  });

  it('双控件区间：起止时间', () => {
    document.body.innerHTML = wrapper(
      'data-form-field-i18n-name="起止时间"',
      `<input class="ud__native-input" value="2023-09">
       <input class="ud__native-input" value="2027-07">`,
    );
    const f = byLabel(scan(), '起止时间');
    expect(f?.kind).toBe('range');
    expect(f?.value).toBe('2023-09 ~ 2027-07');
  });

  it('多行文本：描述', () => {
    document.body.innerHTML = wrapper(
      'data-form-field-id="desc" data-form-field-name="desc" data-form-field-i18n-name="描述"',
      `<textarea class="ud-scrollbar" data-form-field-id="desc" data-form-field-name="desc" data-form-field-i18n-name="描述">开源贡献</textarea>`,
    );
    const f = byLabel(scan(), '描述');
    expect(f?.kind).toBe('textarea');
    expect(f?.value).toBe('开源贡献');
  });

  it('wrapper 内的控件不再单独识别，避免“(未命名字段)”噪声', () => {
    document.body.innerHTML = wrapper(
      'data-form-field-id="name" data-form-field-name="name" data-form-field-i18n-name="姓名"',
      `<input class="ud__native-input" data-form-field-id="name" data-form-field-name="name" value="张三">`,
    );
    const fields = scan();
    expect(fields).toHaveLength(1);
    expect(fields[0].label).toBe('姓名');
  });

  it('一个 wrapper 产出多个字段：意向城市下拉 + 附带复选框', () => {
    document.body.innerHTML = wrapper(
      'data-form-field-id="cities" data-form-field-name="cities" data-form-field-i18n-name="意向城市"',
      `<div class="atsx-select"><div class="atsx-select-selection atsx-select-selection--multiple" role="combobox">
         <ul>
           <li class="atsx-select-selection__choice"><span class="select-item-label">杭州</span></li>
         </ul>
         <li class="atsx-select-search"><input class="atsx-select-search__field"></li>
       </div></div>
       <label class="ud__checkbox__wrapper">
         <span class="ud__checkbox"><input type="checkbox" class="ud__checkbox__input" checked></span>
         <span class="ud__checkbox__label-content">接受调剂到其他城市</span>
       </label>`,
    );
    const fields = scan();
    const select = byLabel(fields, '意向城市');
    const extra = byLabel(fields, '接受调剂到其他城市');
    expect(select?.kind).toBe('custom');
    expect(select?.value).toBe('杭州');
    expect(extra?.kind).toBe('checkbox');
    expect(extra?.value).toBe('是');
    expect((extra?.el as HTMLInputElement).checked).toBe(true);
  });

  it('wrapper 本身即单个复选框', () => {
    document.body.innerHTML = wrapper(
      'data-form-field-name="agree" data-form-field-i18n-name="我同意隐私政策"',
      `<label class="ud__checkbox__wrapper">
         <input type="checkbox" checked><span>我同意隐私政策</span>
       </label>`,
    );
    const f = byLabel(scan(), '我同意隐私政策');
    expect(f?.kind).toBe('checkbox');
    expect(f?.value).toBe('是');
  });
});

describe('scanFields：原生控件兜底', () => {
  it('label[for] + 文本框', () => {
    document.body.innerHTML = `<label for="name">姓名</label><input id="name" type="text" value="李四">`;
    const f = byLabel(scan(), '姓名');
    expect(f?.kind).toBe('text');
    expect(f?.value).toBe('李四');
  });

  it('原生 select：值为选中项文本', () => {
    document.body.innerHTML = `<label for="deg">学历</label><select id="deg"><option>本科</option><option selected>硕士</option></select>`;
    const f = byLabel(scan(), '学历');
    expect(f?.kind).toBe('select');
    expect(f?.value).toBe('硕士');
    expect(f?.options).toEqual(['本科', '硕士']);
  });

  it('原生 textarea', () => {
    document.body.innerHTML = `<label for="d">描述</label><textarea id="d">内容</textarea>`;
    const f = byLabel(scan(), '描述');
    expect(f?.kind).toBe('textarea');
    expect(f?.value).toBe('内容');
  });

  it('原生单选组按 name 分组', () => {
    document.body.innerHTML = `
      <div><span>性别</span>
        <label><input type="radio" name="sex" value="male" checked> 男</label>
        <label><input type="radio" name="sex" value="female"> 女</label>
      </div>`;
    const f = byLabel(scan(), '性别');
    expect(f?.kind).toBe('radio');
    expect(f?.options).toEqual(['男', '女']);
    expect(f?.value).toBe('男');
  });

  it('单个复选框', () => {
    document.body.innerHTML = `<label><input type="checkbox" checked> 我同意</label>`;
    const fields = scan();
    expect(fields).toHaveLength(1);
    expect(fields[0].kind).toBe('checkbox');
  });
});

// 扫描器验证：用 UDesign/formily 真实结构（来自得物网申页）
import { JSDOM } from 'jsdom';

function load(html: string) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`);
  const g: any = globalThis;
  const w: any = dom.window;
  g.window = w;
  g.document = w.document;
  g.CSS = w.CSS ?? { escape: (s: string) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c: string) => '\\' + c) };
  g.HTMLElement = w.HTMLElement;
  g.HTMLInputElement = w.HTMLInputElement;
  g.HTMLTextAreaElement = w.HTMLTextAreaElement;
  g.HTMLSelectElement = w.HTMLSelectElement;
  g.getComputedStyle = w.getComputedStyle.bind(w);
  w.Element.prototype.getBoundingClientRect = () => ({
    width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20, x: 0, y: 0,
  });
  return dom;
}

/** 真实结构：字段元数据在外层 .ud-formily-item，内部含 label 与控件 */
function item(attrs: string, inner: string): string {
  return `<div class="ud-formily-item" ${attrs}>
    <div class="ud-formily-item-label"><label>${attrs.match(/i18n-name="([^"]+)"/)?.[1] ?? ''}</label></div>
    <div class="ud-formily-item-control">${inner}</div>
  </div>`;
}

const cases: Array<{ name: string; html: string; expect: Partial<Record<string, unknown>> }> = [
  {
    name: '文本：姓名',
    html: item(
      'data-form-field-id="name" data-form-field-name="name" data-form-field-i18n-name="姓名"',
      `<input class="ud__native-input" data-form-field-id="name" data-form-field-name="name" data-form-field-i18n-name="姓名" value="周启飏">`,
    ),
    expect: { kind: 'text', label: '姓名', value: '周启飏' },
  },
  {
    name: '日期：出生日期（placeholder YYYY-MM 不应成为标签）',
    html: item(
      'data-form-field-id="birthday" data-form-field-i18n-name="出生日期"',
      `<input class="ud__picker-input ud__native-input" placeholder="YYYY-MM" value="">`,
    ),
    expect: { kind: 'text', label: '出生日期', value: '' },
  },
  {
    name: '自定义单选下拉：性别',
    html: item(
      'data-form-field-id="gender" data-form-field-name="gender" data-form-field-i18n-name="性别"',
      `<div class="ud__select"><div class="ud__select__selector">
         <div class="ud__select__selector__content"><div class="ud__select__selector__selectItem">男</div>
         <div class="ud__select__selector__search"><input class="ud__select__selector__search__input" role="combobox" type="search" readonly></div></div>
       </div></div>`,
    ),
    expect: { kind: 'custom', label: '性别', value: '男' },
  },
  {
    name: '自定义多选下拉：意向城市',
    html: item(
      'data-form-field-id="cities" data-form-field-name="cities" data-form-field-i18n-name="意向城市"',
      `<div class="atsx-select"><div class="atsx-select-selection atsx-select-selection--multiple" role="combobox">
         <ul>
           <li class="atsx-select-selection__choice"><span class="select-item-tag">1</span><span class="select-item-label">杭州</span></li>
           <li class="atsx-select-selection__choice"><span class="select-item-tag">2</span><span class="select-item-label">上海</span></li>
         </ul>
         <li class="atsx-select-search"><input class="atsx-select-search__field"></li>
       </div></div>`,
    ),
    expect: { kind: 'custom', label: '意向城市', value: '杭州、上海' },
  },
  {
    name: '单选组：推荐方式',
    html: item(
      'data-form-field-id="code_type" data-form-field-name="code_type" data-form-field-i18n-name="推荐方式"',
      `<div class="ud__radio__list">
         <label class="ud__radio__wrapper"><input type="radio" class="ud__radio__input" name="code_type" checked><span class="ud__radio__label">无</span></label>
         <label class="ud__radio__wrapper"><input type="radio" class="ud__radio__input" name="code_type"><span class="ud__radio__label">内推</span></label>
         <label class="ud__radio__wrapper"><input type="radio" class="ud__radio__input" name="code_type"><span class="ud__radio__label">大使推荐</span></label>
       </div>`,
    ),
    expect: { kind: 'radio', label: '推荐方式', value: '无', options: ['无', '内推', '大使推荐'] },
  },
  {
    name: '区间：起止时间（双 input）',
    html: item(
      'data-form-field-i18n-name="起止时间"',
      `<input class="ud__native-input" value="2023-09">
       <input class="ud__native-input" value="2027-07">`,
    ),
    expect: { kind: 'range', label: '起止时间', value: '2023-09 ~ 2027-07' },
  },
  {
    name: '多行文本：描述',
    html: item(
      'data-form-field-id="desc" data-form-field-name="desc" data-form-field-i18n-name="描述"',
      `<textarea class="ud-scrollbar" data-form-field-id="desc" data-form-field-name="desc" data-form-field-i18n-name="描述">开源贡献</textarea>`,
    ),
    expect: { kind: 'textarea', label: '描述', value: '开源贡献' },
  },
];

const { scanFields } = await import('../src/dom/scanner.ts');

let pass = 0;
let fail = 0;
for (const c of cases) {
  load(c.html);
  const fields = scanFields();
  const f = fields.find((x) => x.label === (c.expect.label as string)) ?? fields[0];
  const checks: string[] = [];
  for (const [k, v] of Object.entries(c.expect)) {
    const got = (f as any)?.[k];
    const ok = JSON.stringify(got) === JSON.stringify(v);
    if (!ok) checks.push(`${k}: expect=${JSON.stringify(v)} got=${JSON.stringify(got)}`);
  }
  const ok = checks.length === 0;
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}${ok ? '' : '\n      ' + checks.join('\n      ')}`);
  if (!ok) console.log('      fields=', JSON.stringify(fields.map((x) => ({ label: x.label, kind: x.kind }))));
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

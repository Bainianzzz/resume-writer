// 标签解析验证：用真实结构（formily/得物）与常见 HTML 结构跑一遍
// 运行：npx tsx test/label.test.ts  或   node --experimental-strip-types
import { JSDOM } from 'jsdom';

const cases: Array<{ name: string; html: string; expectLabel: string }> = [
  {
    name: 'formily（得物）: 显式属性在容器与 input 上',
    html: `<div data-form-field-id="link" data-form-field-name="link" data-form-field-i18n-name="项目链接" id="formily-item-link" class="ud-formily-item"><div class="ud-formily-item-label"><div class="ud-formily-item-label-content"><span><label>项目链接</label></span></div></div><div class="ud-formily-item-control"><div class="ud-formily-item-control-content"><div class="ud__input"><label class="ud__input-input-wrap"><div><input class="ud__native-input" data-form-field-id="link" data-form-field-name="link" data-form-field-i18n-name="项目链接" value="https://github.com/x/y"></div></label></div></div></div></div>`,
    expectLabel: '项目链接',
  },
  {
    name: 'formily 日期字段（避免把 YYYY-MM 当标签）',
    html: `<div data-form-field-id="time" data-form-field-name="time" data-form-field-i18n-name="起止时间"><div class="label">起止时间</div><div class="control"><input type="month" placeholder="YYYY-MM" value="2027-07"></div></div>`,
    expectLabel: '起止时间',
  },
  {
    name: '标准 label[for]',
    html: `<label for="name">姓名</label><input id="name" type="text">`,
    expectLabel: '姓名',
  },
  {
    name: '包裹式 label',
    html: `<label>邮箱 <input type="email"></label>`,
    expectLabel: '邮箱',
  },
  {
    name: 'aria-label',
    html: `<div><input aria-label="手机号码" type="tel"></div>`,
    expectLabel: '手机号码',
  },
  {
    name: '表格：左侧单元格为标签',
    html: `<table><tr><td>毕业院校</td><td><input type="text"></td></tr></table>`,
    expectLabel: '毕业院校',
  },
  {
    name: '前置兄弟文本',
    html: `<div><span>专业名称</span><input type="text"></div>`,
    expectLabel: '专业名称',
  },
];

function load(html: string) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`);
  const g: any = globalThis;
  g.window = dom.window;
  g.document = dom.window.document;
  g.CSS = dom.window.CSS;
  g.HTMLElement = dom.window.HTMLElement;
  g.HTMLInputElement = dom.window.HTMLInputElement;
  g.HTMLSelectElement = dom.window.HTMLSelectElement;
  g.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  return dom;
}

const { collectLabels, explicitLabel } = await import('../src/dom/label.ts');

let pass = 0;
let fail = 0;
for (const c of cases) {
  const dom = load(c.html);
  const el = dom.window.document.querySelector('input,select,textarea') as HTMLElement;
  const labels = collectLabels(el);
  const got = explicitLabel(el) || labels[0] || '';
  const ok = got === c.expectLabel;
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}\n      expect="${c.expectLabel}" got="${got}" labels=${JSON.stringify(labels)}`);
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

import { beforeEach, describe, expect, it } from 'vitest';
import { fillAsyncField, fillCustomSelect, fillField, fillRange } from '../src/dom/setter';
import type { FieldDescriptor, FieldKind } from '../src/types';

function field(kind: FieldKind, el: HTMLElement, extra: Partial<FieldDescriptor> = {}): FieldDescriptor {
  return {
    el,
    kind,
    inputType: '',
    labels: [],
    label: 'x',
    name: '',
    id: '',
    placeholder: '',
    value: '',
    options: [],
    selector: '',
    groupKey: 'x',
    ...extra,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('fillField：文本', () => {
  it('写入值并派发 input/change', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const events: string[] = [];
    input.addEventListener('input', () => events.push('input'));
    input.addEventListener('change', () => events.push('change'));
    expect(fillField(field('text', input), '张三')).toBe(true);
    expect(input.value).toBe('张三');
    expect(events).toContain('input');
    expect(events).toContain('change');
  });

  it('date 类型转换为 yyyy-mm-dd', () => {
    const input = document.createElement('input');
    input.type = 'date';
    document.body.appendChild(input);
    fillField(field('text', input), '2023-9');
    expect(input.value).toBe('2023-09-01');
  });

  it('空值不写入', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(fillField(field('text', input), '')).toBe(false);
  });
});

describe('fillField：select', () => {
  it('按文本模糊匹配选项', () => {
    const select = document.createElement('select');
    for (const t of ['男', '女', '保密']) {
      const o = document.createElement('option');
      o.text = t;
      select.add(o);
    }
    document.body.appendChild(select);
    expect(fillField(field('select', select), '女')).toBe(true);
    expect(select.selectedIndex).toBe(1);
  });

  it('无匹配项返回 false', () => {
    const select = document.createElement('select');
    const o = document.createElement('option');
    o.text = '本科';
    select.add(o);
    document.body.appendChild(select);
    expect(fillField(field('select', select), '博士')).toBe(false);
  });
});

describe('fillField：radio / checkbox', () => {
  it('radio 组按标签选中', () => {
    document.body.innerHTML = `
      <label><input type="radio" name="sex"> 男</label>
      <label><input type="radio" name="sex"> 女</label>`;
    const radios = [...document.querySelectorAll<HTMLInputElement>('input')];
    const f = field('radio', radios[0], { targets: radios });
    expect(fillField(f, '女')).toBe(true);
    expect(radios[1].checked).toBe(true);
    expect(radios[0].checked).toBe(false);
  });

  it('单个 checkbox 按真值勾选', () => {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    document.body.appendChild(cb);
    expect(fillField(field('checkbox', cb), '是')).toBe(true);
    expect(cb.checked).toBe(true);
  });
});

describe('fillRange：区间拆分', () => {
  it('“a ~ b” 拆到两个控件', () => {
    document.body.innerHTML = `<input value=""><input value="">`;
    const ins = [...document.querySelectorAll<HTMLInputElement>('input')];
    const f = field('range', ins[0], { targets: ins });
    expect(fillRange(f, '2023-09 ~ 2027-07')).toBe(true);
    expect(ins[0].value).toBe('2023-09');
    expect(ins[1].value).toBe('2027-07');
  });
});

describe('fillCustomSelect：模拟交互', () => {
  it('打开下拉并点选目标项', async () => {
    const root = document.createElement('div');
    root.className = 'ud__select';
    root.innerHTML = `
      <div class="ud__select__selector">
        <div class="ud__select__selector__content">
          <div class="ud__select__selector__selectItem"></div>
        </div>
      </div>`;
    document.body.appendChild(root);

    const open = () => {
      if (document.querySelector('.ud__select__dropdown')) return;
      const dd = document.createElement('div');
      dd.className = 'ud__select__dropdown';
      for (const v of ['男', '女']) {
        const li = document.createElement('li');
        li.className = 'ud__select__list__item';
        li.textContent = v;
        li.addEventListener('click', () => {
          (root.querySelector('.ud__select__selector__selectItem') as HTMLElement).textContent = v;
          dd.remove();
        });
        dd.appendChild(li);
      }
      document.body.appendChild(dd);
    };
    root.querySelector('.ud__select__selector')!.addEventListener('mousedown', open);

    const ok = await fillAsyncField(field('custom', root), '女');
    expect(ok).toBe(true);
    expect(root.querySelector('.ud__select__selector__selectItem')!.textContent).toBe('女');
  });

  it('fillCustomSelect 直接调用也可用', async () => {
    const root = document.createElement('div');
    root.innerHTML = `<div class="ud__select__selector"><div class="ud__select__selector__selectItem"></div></div>`;
    document.body.appendChild(root);
    const open = () => {
      if (document.querySelector('.ud__select__dropdown')) return;
      const dd = document.createElement('div');
      dd.className = 'ud__select__dropdown';
      const li = document.createElement('li');
      li.className = 'ud__select__list__item';
      li.textContent = '硕士';
      li.addEventListener('click', () => {
        (root.querySelector('.ud__select__selector__selectItem') as HTMLElement).textContent = '硕士';
      });
      dd.appendChild(li);
      document.body.appendChild(dd);
    };
    root.querySelector('.ud__select__selector')!.addEventListener('mousedown', open);
    expect(await fillCustomSelect(field('custom', root), ['硕士'])).toBe(true);
    expect(root.querySelector('.ud__select__selector__selectItem')!.textContent).toBe('硕士');
  });

  it('多选：打开一次、连选多个、再收起', async () => {
    // atsx-select 多选结构：触发器 + 挂在 body 的下拉
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="atsx-select-selection atsx-select-selection--multiple" role="combobox" aria-expanded="false">
        <div class="atsx-select-selection__rendered"><ul></ul></div>
      </div>`;
    document.body.appendChild(root);
    const trigger = root.querySelector('.atsx-select-selection') as HTMLElement;
    const ul = root.querySelector('ul')!;
    let clickCount = 0;

    const selectedTexts = () =>
      [...ul.querySelectorAll('li')].map((li) => (li.textContent || '').trim());

    const renderDropdown = () => {
      const dd = document.createElement('div');
      dd.className = 'atsx-select-dropdown';
      for (const v of ['上海', '杭州', '北京']) {
        const li = document.createElement('li');
        li.className = 'atsx-select-dropdown-menu-item';
        li.textContent = v;
        li.addEventListener('click', () => {
          if (selectedTexts().includes(v)) return;
          const chip = document.createElement('li');
          chip.className = 'atsx-select-selection__choice';
          chip.textContent = v;
          ul.appendChild(chip);
        });
        dd.appendChild(li);
      }
      document.body.appendChild(dd);
    };

    // 点击触发器切换展开/收起
    trigger.addEventListener('mousedown', () => {
      clickCount++;
      const open = trigger.getAttribute('aria-expanded') === 'true';
      if (open) {
        trigger.setAttribute('aria-expanded', 'false');
        document.querySelector('.atsx-select-dropdown')?.remove();
      } else {
        trigger.setAttribute('aria-expanded', 'true');
        renderDropdown();
      }
    });

    const ok = await fillAsyncField(field('custom', root), '北京、杭州');
    expect(ok).toBe(true);
    expect(selectedTexts().sort()).toEqual(['北京', '杭州']);
    // 打开一次 + 收起一次
    expect(clickCount).toBe(2);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});

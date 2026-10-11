import { describe, expect, it } from 'vitest';
import { JEV_CANDIDATE_LIMIT, matchExact, prefilterCandidates } from '../src/match/local';
import { normalize } from '../src/match/text';
import type { DictEntry, FieldDescriptor, FieldKind } from '../src/types';

function field(labels: string[], kind: FieldKind = 'text', section?: string): FieldDescriptor {
  return {
    el: document.createElement('input'),
    kind,
    inputType: 'text',
    labels,
    label: labels[0],
    section,
    name: '',
    id: '',
    placeholder: '',
    value: '',
    options: [],
    selector: '',
    groupKey: labels[0],
  };
}

function entry(label: string, aliases: string[] = []): DictEntry {
  return { key: normalize(label), label, aliases, value: `${label}值`, updatedAt: 1, origins: [] };
}

describe('matchExact：本地只认完全匹配', () => {
  it('归一化后相等即命中（忽略全角/空格/大小写）', () => {
    const hit = matchExact(field(['姓 名']), [entry('姓名', [])]);
    expect(hit?.label).toBe('姓名');
  });

  it('仅同义组不算完全匹配', () => {
    expect(matchExact(field(['毕业院校']), [entry('学校', [])])).toBeNull();
  });

  it('仅包含关系不算完全匹配', () => {
    expect(matchExact(field(['手机号码']), [entry('手机', [])])).toBeNull();
  });

  it('别名完全相等也算命中', () => {
    const hit = matchExact(field(['手机']), [entry('手机号码', ['手机'])]);
    expect(hit?.label).toBe('手机号码');
  });

  it('label 命中优先于仅别名命中', () => {
    const dict = [entry('姓名', ['名字']), entry('姓名', [])];
    // 第一条 label 即「姓名」，直接命中
    expect(matchExact(field(['姓名']), dict)?.aliases).toEqual(['名字']);
  });
});

describe('prefilterCandidates：字面证据分层 + 截断', () => {
  const dict = [
    entry('专业'),
    entry('学历'),
    entry('学校'),
    entry('毕业时间'),
    entry('事业单位'),
  ];

  it('按层级排序，无交集整条排除', () => {
    const got = prefilterCandidates(field(['毕业院校']), dict);
    expect(got.map((c) => c.entry.label)).toEqual(['学校', '毕业时间', '专业', '事业单位']);
    expect(got.map((c) => c.evidence)).toEqual([4, 2, 1, 1]);
  });

  it('同层保持字典原序（sort 稳定）', () => {
    const got = prefilterCandidates(field(['毕业院校']), dict);
    expect(got.slice(2).map((c) => c.entry.label)).toEqual(['专业', '事业单位']);
  });

  it('无任何交集时返回空数组', () => {
    expect(prefilterCandidates(field(['验证码']), dict)).toEqual([]);
  });

  it('超出上限只截尾部', () => {
    const many = Array.from({ length: JEV_CANDIDATE_LIMIT + 3 }, (_, i) => entry(`项目${i}名称`));
    const got = prefilterCandidates(field(['项目名称']), many);
    expect(got).toHaveLength(JEV_CANDIDATE_LIMIT);
    expect(got[0].entry.label).toBe('项目0名称');
  });
});

describe('区域前缀不参与候选判断', () => {
  const dict = [
    entry('基本信息·姓名'),
    entry('基本信息·证件号码'),
    entry('项目经历·描述'),
    entry('实习经历·描述'),
  ];

  it('同区字段不会因为共享区域名而互为疑似选项', () => {
    const got = prefilterCandidates(field(['基本信息·出生日期'], 'text', '基本信息'), dict);
    expect(got.map((c) => c.entry.label)).toEqual([]);
  });

  it('剥掉前缀后仍能按真实标签命中', () => {
    const got = prefilterCandidates(field(['基本信息·姓名'], 'text', '基本信息'), dict);
    expect(got.map((c) => c.entry.label)).toEqual(['基本信息·姓名']);
  });

  it('同名子字段按区域区分，各自只命中自己那条', () => {
    const work = prefilterCandidates(field(['实习经历·描述'], 'text', '实习经历'), dict);
    expect(work.map((c) => c.entry.label)).toContain('实习经历·描述');
    const proj = prefilterCandidates(field(['项目经历·描述'], 'text', '项目经历'), dict);
    expect(proj.map((c) => c.entry.label)).toContain('项目经历·描述');
  });
});

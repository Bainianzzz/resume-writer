import { describe, expect, it } from 'vitest';
import {
  charBigrams,
  dice,
  looseScore,
  normalize,
  sameSynonymGroup,
  similarity,
  stripNoise,
  tokens,
} from '../src/match/text';

describe('normalize', () => {
  it('全角转半角、小写、去标点空白', () => {
    expect(normalize('ＡＢ　Ｃ：１')).toBe('abc1');
    expect(normalize('  姓 名 * ')).toBe('姓名');
  });

  it('空输入返回空串', () => {
    expect(normalize('')).toBe('');
  });
});

describe('stripNoise', () => {
  it('去掉必填/选填等噪声词', () => {
    expect(stripNoise('姓名（必填）')).toBe('姓名');
    expect(stripNoise('邮箱 required')).toBe('邮箱');
    expect(stripNoise('请输入姓名')).toBe('姓名');
  });
});

describe('charBigrams / dice', () => {
  it('单字符与多字符', () => {
    expect([...charBigrams('a')]).toEqual(['a']);
    expect([...charBigrams('abc')].sort()).toEqual(['ab', 'bc']);
  });

  it('dice 相同为 1，无重叠为 0', () => {
    expect(dice('abc', 'abc')).toBe(1);
    expect(dice('abc', 'xyz')).toBe(0);
  });
});

describe('tokens', () => {
  it('含 ASCII 单词与中文单字/二元组', () => {
    const t = tokens('hello 姓名');
    expect(t.has('hello')).toBe(true);
    expect(t.has('姓')).toBe(true);
    expect(t.has('姓名')).toBe(true);
  });
});

describe('looseScore（Jev 预筛）', () => {
  it('完全相同为 1', () => {
    expect(looseScore('项目名称', '项目名称')).toBe(1);
  });

  it('包含关系给高分', () => {
    expect(looseScore('描述', '项目描述')).toBe(0.8);
  });

  it('毫无字面关联为 0', () => {
    expect(looseScore('描述', '项目名称')).toBe(0);
    expect(looseScore('手机', '邮箱')).toBe(0);
  });

  it('部分字面重叠落在 (0,1)', () => {
    const s = looseScore('期望职位', '应聘职位');
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
});

describe('sameSynonymGroup', () => {
  it('同组为真，跨组为假', () => {
    expect(sameSynonymGroup('学历', '最高学历')).toBe(true);
    expect(sameSynonymGroup('学历', '专业')).toBe(false);
  });
});

describe('similarity', () => {
  it('完全相同为 1', () => {
    expect(similarity('姓名', '姓名')).toBe(1);
  });

  it('同义词组得高分', () => {
    expect(similarity('手机号码', '手机号')).toBe(0.95);
    expect(similarity('性别', 'gender')).toBe(0.95);
  });

  it('包含关系高于 Dice', () => {
    const s = similarity('姓名', '姓名栏');
    expect(s).toBeGreaterThan(0.7);
    expect(s).toBeLessThan(0.95);
  });

  it('无关文本得分低', () => {
    expect(similarity('姓名', '邮箱')).toBeLessThan(0.2);
  });

  it('空串为 0', () => {
    expect(similarity('', '姓名')).toBe(0);
  });
});

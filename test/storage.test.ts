import { beforeEach, describe, expect, it } from 'vitest';
import { __resetGm } from '$';
import type { DictEntry, Config } from '../src/types';
import {
  clearDict,
  defaultConfig,
  deleteEntry,
  getDict,
  loadConfig,
  loadDict,
  saveConfig,
  setDict,
  upsertEntries,
} from '../src/storage';

function entry(partial: Partial<DictEntry>): DictEntry {
  return {
    key: '',
    label: '',
    aliases: [],
    value: '',
    updatedAt: 0,
    origins: [],
    ...partial,
  };
}

beforeEach(() => {
  __resetGm();
  setDict([]); // 同步模块内缓存
});

describe('配置', () => {
  it('无配置时返回默认值', () => {
    expect(loadConfig()).toEqual(defaultConfig);
  });

  it('保存后读回并与默认值合并', () => {
    const cfg: Config = { ...defaultConfig, jevApiKey: 'jv_live_abc', minScore: 0.8 };
    saveConfig(cfg);
    const loaded = loadConfig();
    expect(loaded.jevApiKey).toBe('jv_live_abc');
    expect(loaded.minScore).toBe(0.8);
    expect(loaded.jevModel).toBe(defaultConfig.jevModel);
  });
});

describe('字典读写', () => {
  it('非法 JSON 返回空数组', () => {
    expect(loadDict()).toEqual([]);
  });

  it('saveDict/loadDict 往返', () => {
    const list = [entry({ key: 'name', label: '姓名', value: '张三' })];
    setDict(list);
    expect(loadDict()).toHaveLength(1);
    expect(getDict()[0].value).toBe('张三');
  });
});

describe('upsertEntries', () => {
  it('新增按 key 去重', () => {
    const r1 = upsertEntries([entry({ key: 'name', label: '姓名', value: '张三', updatedAt: 1 })]);
    expect(r1).toEqual({ added: 1, updated: 0 });
    const r2 = upsertEntries([entry({ key: 'name', label: '姓名', value: '李四', updatedAt: 2 })]);
    expect(r2).toEqual({ added: 0, updated: 1 });
    expect(getDict()).toHaveLength(1);
    expect(getDict()[0].value).toBe('李四');
  });

  it('更新时追加别名与来源', () => {
    upsertEntries([entry({ key: 'name', label: '姓名', value: '张三', origins: ['a.com'], updatedAt: 1 })]);
    upsertEntries([
      entry({ key: 'name', label: '真实姓名', value: '张三', aliases: ['中文名'], origins: ['b.com'], updatedAt: 2 }),
    ]);
    const e = getDict()[0];
    expect(e.label).toBe('姓名');
    expect(e.aliases).toEqual(expect.arrayContaining(['真实姓名', '中文名']));
    expect(e.origins).toEqual(expect.arrayContaining(['a.com', 'b.com']));
  });

  it('按 updatedAt 倒序', () => {
    upsertEntries([
      entry({ key: 'a', label: 'A', value: '1', updatedAt: 1 }),
      entry({ key: 'b', label: 'B', value: '2', updatedAt: 5 }),
    ]);
    expect(getDict().map((e) => e.key)).toEqual(['b', 'a']);
  });
});

describe('删除', () => {
  it('deleteEntry 按 key 删除', () => {
    upsertEntries([
      entry({ key: 'a', label: 'A', value: '1', updatedAt: 1 }),
      entry({ key: 'b', label: 'B', value: '2', updatedAt: 2 }),
    ]);
    deleteEntry('a');
    expect(getDict().map((e) => e.key)).toEqual(['b']);
  });

  it('clearDict 清空', () => {
    upsertEntries([entry({ key: 'a', label: 'A', value: '1', updatedAt: 1 })]);
    clearDict();
    expect(getDict()).toEqual([]);
  });
});

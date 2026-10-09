import { beforeEach, describe, expect, it } from 'vitest';
import { __resetGm, GM_setValue } from '$';
import type { DictEntry, Config } from '../src/types';
import {
  __resetStore,
  activeProfileId,
  clearDict,
  createProfile,
  defaultConfig,
  deleteEntry,
  deleteProfile,
  getDict,
  listProfiles,
  loadConfig,
  loadDict,
  renameProfile,
  saveConfig,
  setActiveProfile,
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
  __resetStore();
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

describe('身份（多份字典）', () => {
  it('初始只有一个默认身份', () => {
    const list = listProfiles();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('默认');
    expect(activeProfileId()).toBe(list[0].id);
  });

  it('新建身份并切换，各自内容独立', () => {
    upsertEntries([entry({ key: 'name', label: '姓名', value: '张三', updatedAt: 1 })]);

    const id = createProfile('实习');
    expect(activeProfileId()).toBe(id);
    expect(getDict()).toEqual([]); // 新身份为空

    upsertEntries([entry({ key: 'name', label: '姓名', value: '李四', updatedAt: 2 })]);
    expect(getDict()[0].value).toBe('李四');

    // 切回默认身份，内容不受影响
    const def = listProfiles().find((p) => p.name === '默认')!;
    setActiveProfile(def.id);
    expect(getDict()[0].value).toBe('张三');
  });

  it('listProfiles 返回各自条目数', () => {
    upsertEntries([entry({ key: 'a', label: 'A', value: '1', updatedAt: 1 })]);
    createProfile('第二份');
    upsertEntries([
      entry({ key: 'b', label: 'B', value: '2', updatedAt: 2 }),
      entry({ key: 'c', label: 'C', value: '3', updatedAt: 3 }),
    ]);
    const list = listProfiles();
    expect(list.find((p) => p.name === '默认')?.count).toBe(1);
    expect(list.find((p) => p.name === '第二份')?.count).toBe(2);
  });

  it('重命名身份', () => {
    const id = activeProfileId();
    renameProfile(id, '社招');
    expect(listProfiles()[0].name).toBe('社招');
  });

  it('删除当前身份后自动切到其它身份', () => {
    const first = activeProfileId();
    const second = createProfile('第二份');
    expect(deleteProfile(second)).toBe(true);
    expect(listProfiles().map((p) => p.id)).toEqual([first]);
    expect(activeProfileId()).toBe(first);
  });

  it('最后一个身份不可删除', () => {
    expect(deleteProfile(activeProfileId())).toBe(false);
    expect(listProfiles()).toHaveLength(1);
  });
});

describe('旧数据迁移', () => {
  it('把旧的单份字典迁移为默认身份', () => {
    __resetGm();
    __resetStore();
    const legacy = [entry({ key: 'name', label: '姓名', value: '张三', updatedAt: 1 })];
    GM_setValue('rw:dict:v1', JSON.stringify(legacy));

    expect(listProfiles()).toHaveLength(1);
    expect(listProfiles()[0].name).toBe('默认');
    expect(getDict()[0].value).toBe('张三');
  });
});

import { GM_getValue, GM_setValue } from '$';
import type { Config, DictEntry, Profile, ProfileSummary } from './types';
import { normalize } from './match/text';

const PROFILES_KEY = 'rw:profiles:v1';
const LEGACY_DICT_KEY = 'rw:dict:v1';
const CONFIG_KEY = 'rw:config:v1';

export const defaultConfig: Config = {
  jevEnabled: true,
  jevApiKey: '',
  jevModel: 'jev-latest',
  minScore: 0.62,
  jevMinConfidence: 0.5,
};

// ---------- 配置 ----------

export function loadConfig(): Config {
  try {
    const raw = GM_getValue(CONFIG_KEY, '');
    if (!raw) return { ...defaultConfig };
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { ...defaultConfig, ...parsed };
  } catch {
    return { ...defaultConfig };
  }
}

export function saveConfig(config: Config): void {
  GM_setValue(CONFIG_KEY, JSON.stringify(config));
}

// ---------- 身份（多份字典） ----------

interface ProfileStore {
  activeId: string;
  profiles: Profile[];
}

function newId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function loadLegacyDict(): DictEntry[] {
  try {
    const raw = GM_getValue(LEGACY_DICT_KEY, '');
    if (!raw) return [];
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(list) ? (list as DictEntry[]) : [];
  } catch {
    return [];
  }
}

function loadStore(): ProfileStore {
  try {
    const raw = GM_getValue(PROFILES_KEY, '');
    if (raw) {
      const parsed: ProfileStore = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length) {
        if (!parsed.profiles.some((p) => p.id === parsed.activeId)) {
          parsed.activeId = parsed.profiles[0].id;
        }
        return parsed;
      }
    }
  } catch {
    /* 落到迁移逻辑 */
  }
  // 迁移旧的单份字典
  const id = newId();
  return {
    activeId: id,
    profiles: [{ id, name: '默认', entries: loadLegacyDict(), updatedAt: Date.now() }],
  };
}

let store: ProfileStore | null = null;

function getStore(): ProfileStore {
  if (!store) store = loadStore();
  return store;
}

function persist(): void {
  if (store) GM_setValue(PROFILES_KEY, JSON.stringify(store));
}

function activeProfile(): Profile {
  const s = getStore();
  return s.profiles.find((p) => p.id === s.activeId) ?? s.profiles[0];
}

/** 所有身份（不含条目内容） */
export function listProfiles(): ProfileSummary[] {
  return getStore().profiles.map((p) => ({
    id: p.id,
    name: p.name,
    count: p.entries.length,
  }));
}

export function activeProfileId(): string {
  return getStore().activeId;
}

export function setActiveProfile(id: string): void {
  const s = getStore();
  if (!s.profiles.some((p) => p.id === id)) return;
  s.activeId = id;
  persist();
}

/** 新建身份并切换到它 */
export function createProfile(name: string): string {
  const s = getStore();
  const id = newId();
  s.profiles.push({ id, name: name.trim() || `身份 ${s.profiles.length + 1}`, entries: [], updatedAt: Date.now() });
  s.activeId = id;
  persist();
  return id;
}

export function renameProfile(id: string, name: string): void {
  const p = getStore().profiles.find((x) => x.id === id);
  if (!p) return;
  p.name = name.trim() || p.name;
  persist();
}

/** 删除身份；最后一个不可删。返回是否删除成功 */
export function deleteProfile(id: string): boolean {
  const s = getStore();
  if (s.profiles.length <= 1) return false;
  const idx = s.profiles.findIndex((p) => p.id === id);
  if (idx < 0) return false;
  s.profiles.splice(idx, 1);
  if (s.activeId === id) s.activeId = s.profiles[Math.min(idx, s.profiles.length - 1)].id;
  persist();
  return true;
}

// ---------- 当前身份的条目 ----------

export function loadDict(): DictEntry[] {
  return activeProfile().entries;
}

export function saveDict(list: DictEntry[]): void {
  activeProfile().entries = list;
  activeProfile().updatedAt = Date.now();
  persist();
}

export function getDict(): DictEntry[] {
  return activeProfile().entries;
}

export function setDict(list: DictEntry[]): void {
  saveDict(list);
}

/** 合并写入当前身份（按 key 去重，追加 alias / origin） */
export function upsertEntries(entries: DictEntry[]): { added: number; updated: number } {
  const profile = activeProfile();
  const list = profile.entries.slice();
  const map = new Map(list.map((e) => [e.key, e]));
  let added = 0;
  let updated = 0;
  for (const entry of entries) {
    const key = entry.key || normalize(entry.label);
    if (!key) continue;
    const exist = map.get(key);
    if (exist) {
      exist.value = entry.value || exist.value;
      exist.updatedAt = entry.updatedAt;
      exist.kind = entry.kind ?? exist.kind;
      if (entry.options?.length) exist.options = entry.options;
      for (const alias of [entry.label, ...entry.aliases]) {
        if (alias && alias !== exist.label && !exist.aliases.includes(alias)) {
          exist.aliases.push(alias);
        }
      }
      for (const origin of entry.origins) {
        if (!exist.origins.includes(origin)) exist.origins.push(origin);
      }
      updated++;
    } else {
      entry.key = key;
      map.set(key, entry);
      added++;
    }
  }
  saveDict([...map.values()].sort((a, b) => b.updatedAt - a.updatedAt));
  return { added, updated };
}

export function deleteEntry(key: string): void {
  setDict(getDict().filter((e) => e.key !== key));
}

export function clearDict(): void {
  setDict([]);
}

/** 仅测试用：清空内存中的 store 缓存 */
export function __resetStore(): void {
  store = null;
}

import { GM_getValue, GM_setValue } from '$';
import type { Config, DictEntry } from './types';
import { normalize } from './match/text';

const DICT_KEY = 'rw:dict:v1';
const CONFIG_KEY = 'rw:config:v1';

export const defaultConfig: Config = {
  jevEnabled: true,
  jevApiKey: '',
  jevBaseUrl: '',
  jevModel: 'jev-latest',
  minScore: 0.62,
  autoFillOnLoad: false,
  jevMinConfidence: 0.5,
};

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

export function loadDict(): DictEntry[] {
  try {
    const raw = GM_getValue(DICT_KEY, '');
    if (!raw) return [];
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(list)) return [];
    return list as DictEntry[];
  } catch {
    return [];
  }
}

export function saveDict(list: DictEntry[]): void {
  GM_setValue(DICT_KEY, JSON.stringify(list));
}

let cached: DictEntry[] | null = null;

export function getDict(): DictEntry[] {
  if (!cached) cached = loadDict();
  return cached;
}

export function setDict(list: DictEntry[]): void {
  cached = list;
  saveDict(list);
}

/** 合并写入（按 key 去重，追加 alias / origin） */
export function upsertEntries(entries: DictEntry[]): { added: number; updated: number } {
  const list = getDict().slice();
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
  setDict([...map.values()].sort((a, b) => b.updatedAt - a.updatedAt));
  return { added, updated };
}

export function deleteEntry(key: string): void {
  setDict(getDict().filter((e) => e.key !== key));
}

export function clearDict(): void {
  setDict([]);
}

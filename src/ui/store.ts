import { reactive } from 'vue';
import { createToastManager } from 'reka-ui';
import type { Config, DictEntry, ProfileSummary } from '../types';
import type { FillResult, LearnResult } from '../core';
import {
  activeProfileId,
  clearDict,
  createProfile,
  defaultConfig,
  deleteEntry,
  deleteProfile,
  getDict,
  listProfiles,
  loadConfig,
  renameProfile,
  saveConfig,
  setActiveProfile,
  setDict,
  upsertEntries,
} from '../storage';

export type TabName = 'ops' | 'dict' | 'config';

/** 面板对外依赖的核心流程回调 */
export interface PanelCallbacks {
  learn: () => LearnResult;
  fill: () => Promise<FillResult>;
  countFields: () => number;
}

/**
 * 面板全局响应式状态。
 * GM 存储不是响应式的，所有写操作统一走下面的 action，写完后 refresh() 重新镜像。
 */
export const state = reactive({
  panelOpen: false,
  tab: 'ops' as TabName,
  dictFilter: '',
  config: loadConfig() as Config,
  entries: getDict().slice() as DictEntry[],
  profiles: listProfiles() as ProfileSummary[],
  activeId: activeProfileId(),
});

/** 顶部队列提示（Reka Toast，可在组件外通过 manager 添加） */
export const toastManager = createToastManager();

export function toast(msg: string, duration = 2600): void {
  toastManager.add({ description: msg, duration });
}

/** 从 GM 存储重新读取到响应式镜像 */
export function refresh(): void {
  state.config = loadConfig();
  state.entries = getDict().slice();
  state.profiles = listProfiles();
  state.activeId = activeProfileId();
}

/** 显示/隐藏面板；打开时刷新数据 */
export function toggle(): void {
  state.panelOpen = !state.panelOpen;
  if (state.panelOpen) refresh();
}

// ---------- 设置 ----------

export function persistConfig(cfg: Config): void {
  saveConfig(cfg);
  state.config = loadConfig();
}

export function resetConfig(): void {
  saveConfig({ ...defaultConfig });
  state.config = loadConfig();
}

// ---------- 字典 ----------

export function updateEntryValue(key: string, value: string): void {
  const list = getDict();
  const entry = list.find((e) => e.key === key);
  if (!entry) return;
  entry.value = value;
  setDict(list);
  state.entries = getDict().slice();
}

export function removeEntry(key: string): void {
  deleteEntry(key);
  state.entries = getDict().slice();
}

export function emptyDict(): void {
  clearDict();
  state.entries = getDict().slice();
}

export function importEntries(entries: DictEntry[]): { added: number; updated: number } {
  const res = upsertEntries(entries);
  refresh();
  return res;
}

// ---------- 身份 ----------

export function switchProfile(id: string): void {
  setActiveProfile(id);
  refresh();
}

export function newProfile(name: string): void {
  createProfile(name);
  refresh();
}

export function editProfileName(id: string, name: string): void {
  renameProfile(id, name);
  refresh();
}

export function removeProfile(id: string): boolean {
  const ok = deleteProfile(id);
  refresh();
  return ok;
}

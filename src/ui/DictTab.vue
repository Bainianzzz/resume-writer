<script setup lang="ts">
import { computed } from 'vue';
import type { DictEntry } from '../types';
import {
  emptyDict,
  editProfileName,
  importEntries,
  newProfile,
  removeEntry,
  removeProfile,
  state,
  switchProfile,
  toast,
  updateEntryValue,
} from './store';

const filtered = computed<DictEntry[]>(() => {
  const q = state.dictFilter.trim().toLowerCase();
  if (!q) return state.entries;
  return state.entries.filter(
    (e) =>
      e.label.toLowerCase().includes(q) ||
      e.value.toLowerCase().includes(q) ||
      e.aliases.some((a) => a.toLowerCase().includes(q)),
  );
});

const shown = computed<DictEntry[]>(() => filtered.value.slice(0, 300));

function onProfileChange(e: Event): void {
  switchProfile((e.target as HTMLSelectElement).value);
  toast('已切换身份');
}

function onValueChange(e: Event, key: string): void {
  updateEntryValue(key, (e.target as HTMLInputElement).value);
  toast('已保存');
}

function handleNew(): void {
  const name = prompt('新身份名称', `身份 ${state.profiles.length + 1}`);
  if (name === null) return;
  newProfile(name);
  toast('已新建并切换到新身份');
}

function handleRename(): void {
  const cur = state.profiles.find((p) => p.id === state.activeId);
  const name = prompt('重命名身份', cur?.name ?? '');
  if (name === null) return;
  editProfileName(state.activeId, name);
}

function handleDelete(): void {
  const cur = state.profiles.find((p) => p.id === state.activeId);
  if (state.profiles.length <= 1) {
    toast('至少保留一个身份');
    return;
  }
  if (!confirm(`删除身份「${cur?.name ?? ''}」及其全部内容？`)) return;
  removeProfile(state.activeId);
  toast('已删除身份');
}

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function handleExport(): void {
  const payload = { type: 'resume-writer-dict', version: 1, entries: state.entries };
  download('resume-writer-dict.json', JSON.stringify(payload, null, 2));
}

function handleImport(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const entries: DictEntry[] = Array.isArray(data) ? data : data.entries;
      if (!Array.isArray(entries)) throw new Error('文件格式不正确');
      const { added, updated } = importEntries(entries);
      toast(`导入完成：新增 ${added}，更新 ${updated}`);
    } catch (err) {
      toast(`导入失败：${(err as Error).message}`);
    }
  });
  input.click();
}

function handleClear(): void {
  if (!confirm('确定清空所有已学习的内容？')) return;
  emptyDict();
  toast('字典已清空');
}
</script>

<template>
  <div class="rw-field">
    <label class="rw-label">身份</label>
    <select class="rw-select" :value="state.activeId" @change="onProfileChange">
      <option v-for="p in state.profiles" :key="p.id" :value="p.id">
        {{ p.name }}（{{ p.count }}）
      </option>
    </select>
  </div>
  <div class="rw-row">
    <button class="rw-btn" @click="handleNew">新建</button>
    <button class="rw-btn" @click="handleRename">重命名</button>
    <button class="rw-btn rw-danger" @click="handleDelete">删除</button>
  </div>
  <div class="rw-field">
    <input class="rw-input" placeholder="搜索字段…" v-model="state.dictFilter" />
  </div>
  <div class="rw-row">
    <button class="rw-btn" @click="handleExport">导出 JSON</button>
    <button class="rw-btn" @click="handleImport">导入 JSON</button>
    <button class="rw-btn rw-danger" @click="handleClear">清空</button>
  </div>
  <div class="rw-list">
    <div v-if="!shown.length" class="rw-empty">暂无内容，先去页面填写并点击“学习本页”</div>
    <div v-for="e in shown" :key="e.key" class="rw-item">
      <div class="rw-item-head">
        <span class="rw-item-label">
          {{ e.label }}<span v-if="e.aliases.length" class="rw-alias"> / {{ e.aliases.slice(0, 3).join('、') }}</span>
        </span>
        <button class="rw-mini" title="删除" @click="removeEntry(e.key)">删除</button>
      </div>
      <input class="rw-input" :value="e.value" @change="onValueChange($event, e.key)" />
    </div>
  </div>
</template>

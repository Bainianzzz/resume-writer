<script setup lang="ts">
import { ref } from 'vue';
import type { FillResult } from '../core';
import { state, toast, type PanelCallbacks } from './store';

const props = defineProps<{ cb: PanelCallbacks }>();

const result = ref<FillResult | null>(null);

function countFields(): number {
  return props.cb.countFields();
}

async function handleLearn(): Promise<void> {
  try {
    const res = props.cb.learn();
    if (res.learned === 0) {
      toast('没学到内容：请先在页面上填写表单');
    } else {
      toast(`已学习 ${res.learned} 项（新增 ${res.added}，更新 ${res.updated}）`);
    }
  } catch (err) {
    toast(`学习失败：${(err as Error).message}`);
  }
}

async function handleFill(): Promise<void> {
  toast('正在匹配填报…');
  try {
    const res = await props.cb.fill();
    toast(`已填充 ${res.filled}/${res.matched} 项（共扫描 ${res.scanned} 个字段）`);
    result.value = res;
  } catch (err) {
    toast(`填报失败：${(err as Error).message}`);
  }
}
</script>

<template>
  <div class="rw-row">
    <button class="rw-btn rw-primary" @click="handleLearn">学习本页</button>
    <button class="rw-btn rw-primary" @click="handleFill">一键填报</button>
  </div>
  <div class="rw-hint">当前页面识别到 {{ countFields() }} 个字段 · 字典共 {{ state.entries.length }} 条</div>
  <div class="rw-sep"></div>
  <div class="rw-label">填报结果</div>
  <div class="rw-result">
    <template v-if="result">
      <div v-if="result.jevError" class="rw-result-row">
        <span class="rw-tag rw-miss">Jev 失败</span><span>{{ result.jevError }}</span>
      </div>
      <div v-if="!result.details.length && !result.jevError" class="rw-empty">无结果</div>
      <div v-for="(d, i) in result.details" :key="i" class="rw-result-row">
        <span class="rw-tag" :class="d.ok ? 'rw-ok' : 'rw-miss'">{{ d.via }}</span>
        <span><b>{{ d.label }}</b> → {{ d.value || '(空)' }}</span>
      </div>
    </template>
    <div v-else class="rw-empty">点击“一键填报”后显示</div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { Config } from '../types';
import { defaultConfig } from '../storage';
import { testJevConnection } from '../match/jev';
import { persistConfig, resetConfig, state, toast } from './store';

const form = reactive<Config>({ ...state.config });

// 存储侧变化（打开面板 refresh / 恢复默认）时同步到表单
watch(
  () => state.config,
  (cfg) => Object.assign(form, cfg),
);

let timer: number | undefined;
/** 配置改动即时落盘，避免用户忘记点“保存设置”后刷新丢失 */
function scheduleSave(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => persistConfig({ ...form }), 400);
}

function save(): void {
  window.clearTimeout(timer);
  persistConfig({ ...form });
  toast('设置已保存');
}

function reset(): void {
  window.clearTimeout(timer);
  resetConfig();
  Object.assign(form, { ...defaultConfig });
  toast('设置已恢复默认');
}

async function testConnection(): Promise<void> {
  // 测试前先落盘，避免“测通了但刷新后 key 丢失”
  window.clearTimeout(timer);
  const cfg = { ...form };
  persistConfig(cfg);
  if (!cfg.jevApiKey) {
    toast('请先填写 Jev API Key');
    return;
  }
  toast('正在测试 Jev 连接…');
  const res = await testJevConnection(cfg);
  toast(res.ok ? `✓ ${res.message}` : `✗ ${res.message}`, 8000);
}
</script>

<template>
  <div @input="scheduleSave" @change="scheduleSave">
    <div class="rw-field">
      <label class="rw-switch"><input type="checkbox" v-model="form.jevEnabled" /> 启用 Jev 语义匹配</label>
      <div class="rw-hint">本地匹配不到时，调用 Jev 从字典中选择最合适的字段。</div>
    </div>
    <div class="rw-field">
      <label class="rw-label">Jev API Key</label>
      <input
        class="rw-input"
        type="password"
        v-model="form.jevApiKey"
        placeholder="TypeSafe API Key（jv_live_... 或官方 key）"
      />
    </div>
    <div class="rw-field">
      <label class="rw-label">Jev 接口地址</label>
      <input
        class="rw-input"
        v-model="form.jevBaseUrl"
        placeholder="留空自动判断，默认 https://api.typesafe.ai/v1/systemone"
      />
    </div>
    <div class="rw-field">
      <label class="rw-label">Jev 模型</label>
      <input class="rw-input" v-model="form.jevModel" />
    </div>
    <div class="rw-field">
      <label class="rw-label">本地匹配阈值：<span>{{ form.minScore }}</span></label>
      <input type="range" min="0.3" max="1" step="0.01" v-model.number="form.minScore" />
    </div>
    <div class="rw-field">
      <label class="rw-label">Jev 最低置信度：<span>{{ form.jevMinConfidence }}</span></label>
      <input type="range" min="0" max="1" step="0.01" v-model.number="form.jevMinConfidence" />
    </div>
    <div class="rw-field">
      <label class="rw-switch"><input type="checkbox" v-model="form.autoFillOnLoad" /> 页面加载后自动尝试填报</label>
    </div>
    <div class="rw-row">
      <button class="rw-btn rw-primary" @click="save">保存设置</button>
      <button class="rw-btn" @click="testConnection">测试连接</button>
      <button class="rw-btn" @click="reset">恢复默认</button>
    </div>
  </div>
</template>

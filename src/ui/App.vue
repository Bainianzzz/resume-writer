<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { refresh, state, toggle, type PanelCallbacks } from './store';
import OpsTab from './OpsTab.vue';
import DictTab from './DictTab.vue';
import ConfigTab from './ConfigTab.vue';
import Toast from './Toast.vue';

const props = defineProps<{ cb: PanelCallbacks }>();

onMounted(refresh);
watch(
  () => state.panelOpen,
  (open) => {
    if (open) refresh();
  },
);
</script>

<template>
  <div class="rw-panel" v-show="state.panelOpen" data-rw-panel>
    <div class="rw-head">
      <span class="rw-title">网申快速填报</span>
      <span class="rw-head-actions">
        <button title="收起" @click="toggle">×</button>
      </span>
    </div>
    <div class="rw-tabs">
      <button :class="{ 'rw-active': state.tab === 'ops' }" @click="state.tab = 'ops'">操作</button>
      <button :class="{ 'rw-active': state.tab === 'dict' }" @click="state.tab = 'dict'">字典</button>
      <button :class="{ 'rw-active': state.tab === 'config' }" @click="state.tab = 'config'">设置</button>
    </div>
    <div class="rw-body">
      <OpsTab v-if="state.tab === 'ops'" :cb="props.cb" />
      <DictTab v-else-if="state.tab === 'dict'" />
      <ConfigTab v-else />
    </div>
  </div>
  <button class="rw-fab" @click="toggle">填报</button>
  <Toast />
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import {
  ConfigProvider,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
  ToastProvider,
} from 'reka-ui';
import { refresh, state, toastManager, toggle, type PanelCallbacks } from './store';
import OpsTab from './OpsTab.vue';
import DictTab from './DictTab.vue';
import ConfigTab from './ConfigTab.vue';
import Toast from './Toast.vue';

const props = defineProps<{ cb: PanelCallbacks; teleportTo: HTMLElement }>();

onMounted(refresh);
watch(
  () => state.panelOpen,
  (open) => {
    if (open) refresh();
  },
);
</script>

<template>
  <ConfigProvider :teleport-to="props.teleportTo" :scroll-body="false">
    <ToastProvider :toast-manager="toastManager">
      <div class="rw-panel" v-show="state.panelOpen" data-rw-panel>
        <div class="rw-head">
          <span class="rw-title">网申快速填报</span>
          <span>
            <button class="rw-icon-btn" title="收起" @click="toggle">×</button>
          </span>
        </div>
        <TabsRoot v-model="state.tab" class="rw-tabs-root">
          <TabsList class="rw-tabs" aria-label="面板标签页">
            <TabsTrigger class="rw-tab" value="ops">操作</TabsTrigger>
            <TabsTrigger class="rw-tab" value="dict">字典</TabsTrigger>
            <TabsTrigger class="rw-tab" value="config">设置</TabsTrigger>
          </TabsList>
          <TabsContent class="rw-body" value="ops">
            <OpsTab :cb="props.cb" />
          </TabsContent>
          <TabsContent class="rw-body" value="dict">
            <DictTab />
          </TabsContent>
          <TabsContent class="rw-body" value="config">
            <ConfigTab />
          </TabsContent>
        </TabsRoot>
      </div>
      <button class="rw-fab" @click="toggle">填报</button>
      <Toast />
    </ToastProvider>
  </ConfigProvider>
</template>

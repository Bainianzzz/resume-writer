<script setup lang="ts">
import { ToastDescription, ToastRoot, ToastViewport, useToastManager } from 'reka-ui';

const { toasts } = useToastManager();
</script>

<template>
  <ToastViewport class="rw-toast-viewport">
    <ToastRoot v-for="t in toasts" :key="t.id" :toast="t" class="rw-toast">
      <ToastDescription class="rw-toast-desc" />
    </ToastRoot>
  </ToastViewport>
</template>

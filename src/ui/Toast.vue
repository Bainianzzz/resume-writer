<script setup lang="ts">
import { toastState } from './store';
</script>

<template>
  <div class="rw-toast" :class="{ 'rw-show': toastState.show }">{{ toastState.msg }}</div>
</template>

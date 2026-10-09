import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 单元测试独立配置：不加载 vite-plugin-monkey，把 `$` 指向 GM 测试替身
export default defineConfig({
  resolve: {
    alias: {
      $: fileURLToPath(new URL('./test/mocks/gm.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    clearMocks: true,
  },
});

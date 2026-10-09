import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: '网申快速填报助手',
        namespace: 'local/resume-writer',
        version: '0.7.8',
        description:
          '学习网申表单的字段与填写内容并保存为本地字典，之后在任何表单页面一键匹配填报。',
        author: 'resume-writer',
        icon: 'https://vitejs.dev/logo.svg',
        // 通用：匹配所有页面，由脚本自行判断是否存在表单
        match: ['*://*/*'],
        // Jev 请求需跨域，声明允许的地址
        connect: ['api.typesafe.ai', 'jevtypesafeai.com'],
        'run-at': 'document-idle',
      },
      build: {
        fileName: 'resume-writer.user.js',
      },
      server: {
        // 开发时不自动打开浏览器
        open: false,
      },
    }),
  ],
});

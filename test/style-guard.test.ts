import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 面板挂在 Shadow DOM 里，样式必须只进 shadow root。
 * `@vitejs/plugin-vue` 会把 SFC 的 <style> 抽成全局 CSS 注入 document.head，
 * 从而污染宿主页面。这里用测试守住这条约束，而不是只靠文档。
 */
const uiDir = resolve(process.cwd(), 'src/ui');

describe('样式约束：不得引入全局 CSS', () => {
  it('所有 SFC 都不含 <style> 块', () => {
    const vueFiles = readdirSync(uiDir).filter((f) => f.endsWith('.vue'));
    expect(vueFiles.length).toBeGreaterThan(0);
    const offenders = vueFiles.filter((f) => /<style[\s>]/i.test(readFileSync(`${uiDir}/${f}`, 'utf8')));
    expect(offenders, `这些 SFC 含 <style> 块，会注入 document.head 污染页面：${offenders.join(', ')}`).toEqual([]);
  });

  it('样式注入目标是 shadow root（swallow 兜底：面板样式字符串存在）', () => {
    const styles = readFileSync(`${uiDir}/styles.ts`, 'utf8');
    expect(styles).toContain('PANEL_CSS');
  });
});

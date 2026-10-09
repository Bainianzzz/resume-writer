import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 面板挂在 Shadow DOM 里，样式必须只进 shadow root。
 * 这里用测试守住这条约束，是唯一的门禁：源码里任何可能把全局 CSS 注入
 * 宿主页面 `document.head` 的写法都直接失败。
 */
const srcDir = resolve(process.cwd(), 'src');

/** 递归列出 src/ 下所有文件（相对路径，posix 分隔）。 */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(relative(srcDir, full).split('\\').join('/'));
  }
  return out;
}

const allFiles = walk(srcDir);
const read = (rel: string) => readFileSync(join(srcDir, rel), 'utf8');

describe('样式约束：不得向宿主页面注入全局 CSS', () => {
  it('src/ 下所有 SFC 都不含 <style> 块（含 <style scoped>）', () => {
    const vueFiles = allFiles.filter((f) => f.endsWith('.vue'));
    expect(vueFiles.length).toBeGreaterThan(0);
    const offenders = vueFiles.filter((f) => /<style[\s>]/i.test(read(f)));
    expect(offenders, `这些 SFC 含 <style> 块，会被抽成全局 CSS 注入 document.head：${offenders.join(', ')}`).toEqual([]);
  });

  it('所有 .css 导入都必须带 ?inline（否则 Vite 会全局注入）', () => {
    const offenders: string[] = [];
    for (const file of allFiles.filter((f) => /\.[cm]?[jt]s$/.test(f))) {
      const code = read(file);
      // 匹配 import ... from '<spec>.css' 或 import '<spec>.css'，排除 ?inline / ?raw / ?url 等显式后缀
      const re = /(?:from\s*|import\s*)['"]([^'"]*\.css)['"]/g;
      for (const m of code.matchAll(re)) {
        if (!m[1].includes('?inline')) offenders.push(`${file} → ${m[1]}`);
      }
    }
    expect(offenders, `这些 .css 导入缺 ?inline，会作为全局样式注入页面：${offenders.join(', ')}`).toEqual([]);
  });

  it('src/ 下不得手写 document.head / documentElement 注入', () => {
    const offenders: string[] = [];
    for (const file of allFiles.filter((f) => /\.[cm]?[jt]s$/.test(f))) {
      const code = read(file);
      if (/document\.(head|documentElement)\s*\.\s*(append|appendChild|prepend|insertAdjacent)/.test(code)) {
        offenders.push(file);
      }
    }
    expect(offenders, `这些文件往宿主页面注入节点，会污染全局样式：${offenders.join(', ')}`).toEqual([]);
  });

  it('样式注入目标是 shadow root（面板样式字符串存在）', () => {
    const styles = read('ui/styles.ts');
    expect(styles).toContain('PANEL_CSS');
  });
});

import { GM_addStyle, GM_registerMenuCommand } from '$';
import { PANEL_CSS } from './ui/styles';
import { Panel } from './ui/panel';
import { fillPage, learnPage } from './core';
import { scanFields } from './dom/scanner';
import { loadConfig } from './storage';

function bootstrap(): void {
  if (document.getElementById('rw-root')) return;

  GM_addStyle(PANEL_CSS);

  const panel = new Panel({
    learn: learnPage,
    fill: fillPage,
    countFields: () => scanFields().length,
  });

  GM_registerMenuCommand('显示/隐藏 填报面板', () => panel.toggle());
  GM_registerMenuCommand('学习本页表单', () => {
    const res = learnPage();
    alert(
      res.learned === 0
        ? '没学到内容：请先在页面上填写表单'
        : `已学习 ${res.learned} 项（新增 ${res.added}，更新 ${res.updated}）`,
    );
  });
  GM_registerMenuCommand('一键填报本页', () => {
    void fillPage().then((res) => {
      const warn = res.jevError ? `\nJev 调用失败：${res.jevError}` : '';
      alert(`已填充 ${res.filled}/${res.matched} 项（共扫描 ${res.scanned} 个字段）${warn}`);
      panel.toggle();
    });
  });

  const cfg = loadConfig();
  if (cfg.autoFillOnLoad) {
    window.setTimeout(() => {
      void fillPage();
    }, 1500);
  }

  console.info('[resume-writer] 网申快速填报助手已加载');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}

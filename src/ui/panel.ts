import { createApp } from 'vue';
import App from './App.vue';
import { PANEL_CSS } from './styles';
import { toggle, type PanelCallbacks } from './store';

export type { PanelCallbacks } from './store';

/**
 * 把面板挂到 Shadow DOM 里，隔绝宿主页面 CSS，也不向页面注入全局样式。
 * 返回的 toggle 供 GM 菜单命令调用。
 */
export function mountPanel(cb: PanelCallbacks): { toggle: () => void } {
  const host = document.createElement('div');
  host.id = 'rw-root';
  host.setAttribute('data-rw-panel', '');
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = PANEL_CSS;
  shadow.appendChild(style);

  const mount = document.createElement('div');
  shadow.appendChild(mount);

  createApp(App, { cb }).mount(mount);

  return { toggle };
}

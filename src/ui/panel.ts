import type { Config, DictEntry } from '../types';
import type { FillResult, LearnResult } from '../core';
import {
  activeProfileId,
  clearDict,
  createProfile,
  defaultConfig,
  deleteEntry,
  deleteProfile,
  getDict,
  listProfiles,
  loadConfig,
  renameProfile,
  saveConfig,
  setActiveProfile,
  setDict,
  upsertEntries,
} from '../storage';
import { testJevConnection } from '../match/jev';

export interface PanelCallbacks {
  learn: () => LearnResult;
  fill: () => Promise<FillResult>;
  countFields: () => number;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class Panel {
  private root: HTMLDivElement;
  private panelBody: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private tabButtons: HTMLButtonElement[] = [];
  private tab = 'ops';
  private dictFilter = '';

  constructor(private cb: PanelCallbacks) {
    this.root = document.createElement('div');
    this.root.id = 'rw-root';
    this.root.setAttribute('data-rw-panel', '');
    this.root.innerHTML = `
      <div class="rw-panel rw-hidden" data-rw-panel>
        <div class="rw-head">
          <span class="rw-title">网申快速填报</span>
          <span class="rw-head-actions">
            <button data-act="close" title="收起">×</button>
          </span>
        </div>
        <div class="rw-tabs">
          <button data-tab="ops">操作</button>
          <button data-tab="dict">字典</button>
          <button data-tab="config">设置</button>
        </div>
        <div class="rw-body"></div>
      </div>
      <button class="rw-fab" data-act="toggle">填报</button>
      <div class="rw-toast"></div>
    `;
    document.body.appendChild(this.root);

    this.panelBody = this.root.querySelector('.rw-body') as HTMLDivElement;
    this.toastEl = this.root.querySelector('.rw-toast') as HTMLDivElement;

    const panelEl = this.root.querySelector('.rw-panel') as HTMLDivElement;
    this.tabButtons = [...this.root.querySelectorAll<HTMLButtonElement>('.rw-tabs button')];

    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
      const tabName = target.closest<HTMLElement>('[data-tab]')?.dataset.tab;
      if (tabName) {
        this.tab = tabName as typeof this.tab;
        this.render();
        return;
      }
      if (!act) return;
      if (act === 'toggle' || act === 'close') {
        panelEl.classList.toggle('rw-hidden');
        if (!panelEl.classList.contains('rw-hidden')) this.render();
      } else if (act === 'learn') {
        void this.handleLearn();
      } else if (act === 'fill') {
        void this.handleFill();
      } else if (act === 'export') {
        this.handleExport();
      } else if (act === 'import') {
        this.handleImport();
      } else if (act === 'clear') {
        if (confirm('确定清空所有已学习的内容？')) {
          clearDict();
          this.render();
          this.toast('字典已清空');
        }
      } else if (act === 'resetConfig') {
        saveConfig({ ...defaultConfig });
        this.render();
        this.toast('设置已恢复默认');
      } else if (act === 'saveConfig') {
        this.handleSaveConfig();
      } else if (act === 'testJev') {
        void this.handleTestJev();
      } else if (act === 'profileNew') {
        this.handleProfileNew();
      } else if (act === 'profileRename') {
        this.handleProfileRename();
      } else if (act === 'profileDelete') {
        this.handleProfileDelete();
      }
    });

    // 字典内联编辑/删除
    this.panelBody.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.dataset.cfg) this.scheduleConfigSave();
      if (input.dataset.role === 'profile') {
        setActiveProfile(input.value);
        this.render();
        this.toast('已切换身份');
        return;
      }
      const key = input.dataset.entryKey;
      if (key && input.dataset.role === 'value') {
        const list = getDict();
        const entry = list.find((x) => x.key === key);
        if (entry) {
          entry.value = input.value;
          setDict(list);
          this.toast('已保存');
        }
      }
    });
    this.root.addEventListener('click', (e) => {
      const del = (e.target as HTMLElement).closest<HTMLElement>('[data-del]');
      if (del?.dataset.del) {
        deleteEntry(del.dataset.del);
        this.render();
      }
    });
    this.panelBody.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.dataset.role === 'filter') {
        this.dictFilter = input.value;
        this.renderDictList();
      }
      if (input.dataset.cfg) this.scheduleConfigSave();
    });
  }

  /** 配置改动即时落盘，避免用户忘记点“保存设置”后刷新丢失 */
  private configSaveTimer?: number;
  private scheduleConfigSave(): void {
    window.clearTimeout(this.configSaveTimer);
    this.configSaveTimer = window.setTimeout(() => {
      saveConfig(this.readConfigForm());
    }, 400);
  }

  toggle(): void {
    const panelEl = this.root.querySelector('.rw-panel') as HTMLDivElement;
    panelEl.classList.toggle('rw-hidden');
    if (!panelEl.classList.contains('rw-hidden')) this.render();
  }

  private toast(msg: string, duration = 2600): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('rw-show');
    clearTimeout((this as any)._toastTimer);
    (this as any)._toastTimer = setTimeout(() => this.toastEl.classList.remove('rw-show'), duration);
  }

  private async handleLearn(): Promise<void> {
    try {
      const res = this.cb.learn();
      if (res.learned === 0) {
        this.toast('没学到内容：请先在页面上填写表单');
      } else {
        this.toast(`已学习 ${res.learned} 项（新增 ${res.added}，更新 ${res.updated}）`);
      }
      this.render();
    } catch (err) {
      this.toast(`学习失败：${(err as Error).message}`);
    }
  }

  private async handleFill(): Promise<void> {
    this.toast('正在匹配填报…');
    try {
      const res = await this.cb.fill();
      this.toast(`已填充 ${res.filled}/${res.matched} 项（共扫描 ${res.scanned} 个字段）`);
      this.renderFillResult(res);
    } catch (err) {
      this.toast(`填报失败：${(err as Error).message}`);
    }
  }

  private handleExport(): void {
    const payload = { type: 'resume-writer-dict', version: 1, entries: getDict() };
    download('resume-writer-dict.json', JSON.stringify(payload, null, 2));
  }

  private handleImport(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const entries: DictEntry[] = Array.isArray(data) ? data : data.entries;
        if (!Array.isArray(entries)) throw new Error('文件格式不正确');
        const { added, updated } = upsertEntries(entries);
        this.render();
        this.toast(`导入完成：新增 ${added}，更新 ${updated}`);
      } catch (err) {
        this.toast(`导入失败：${(err as Error).message}`);
      }
    });
    input.click();
  }

  private handleProfileNew(): void {
    const name = prompt('新身份名称', `身份 ${listProfiles().length + 1}`);
    if (name === null) return;
    createProfile(name);
    this.render();
    this.toast('已新建并切换到新身份');
  }

  private handleProfileRename(): void {
    const id = activeProfileId();
    const cur = listProfiles().find((p) => p.id === id);
    const name = prompt('重命名身份', cur?.name ?? '');
    if (name === null) return;
    renameProfile(id, name);
    this.render();
  }

  private handleProfileDelete(): void {
    const id = activeProfileId();
    const cur = listProfiles().find((p) => p.id === id);
    if (listProfiles().length <= 1) {
      this.toast('至少保留一个身份');
      return;
    }
    if (!confirm(`删除身份「${cur?.name ?? ''}」及其全部内容？`)) return;
    deleteProfile(id);
    this.render();
    this.toast('已删除身份');
  }

  private handleSaveConfig(): void {
    window.clearTimeout(this.configSaveTimer);
    const cfg = this.readConfigForm();
    saveConfig(cfg);
    this.toast('设置已保存');
  }

  private async handleTestJev(): Promise<void> {
    // 测试前先落盘，避免“测通了但刷新后 key 丢失”
    const cfg = this.readConfigForm();
    saveConfig(cfg);
    window.clearTimeout(this.configSaveTimer);
    if (!cfg.jevApiKey) {
      this.toast('请先填写 Jev API Key');
      return;
    }
    this.toast('正在测试 Jev 连接…');
    const res = await testJevConnection(cfg);
    this.toast(res.ok ? `✓ ${res.message}` : `✗ ${res.message}`, 8000);
  }

  private readConfigForm(): Config {
    const get = (name: string): HTMLInputElement | null =>
      this.root.querySelector<HTMLInputElement>(`[data-cfg="${name}"]`);
    const cur = loadConfig();
    return {
      jevEnabled: get('jevEnabled')?.checked ?? cur.jevEnabled,
      jevApiKey: get('jevApiKey')?.value.trim() ?? cur.jevApiKey,
      jevBaseUrl: get('jevBaseUrl')?.value.trim() ?? cur.jevBaseUrl,
      jevModel: get('jevModel')?.value.trim() ?? cur.jevModel,
      minScore: Number(get('minScore')?.value ?? cur.minScore),
      autoFillOnLoad: get('autoFillOnLoad')?.checked ?? cur.autoFillOnLoad,
      jevMinConfidence: Number(get('jevMinConfidence')?.value ?? cur.jevMinConfidence),
    };
  }

  private renderFillResult(res: FillResult): void {
    const rows = res.details
      .map((d) => {
        const tag = d.ok
          ? `<span class="rw-tag rw-ok">${escapeHtml(d.via)}</span>`
          : `<span class="rw-tag rw-miss">${escapeHtml(d.via)}</span>`;
        return `<div class="rw-result-row">${tag}<span><b>${escapeHtml(d.label)}</b> → ${escapeHtml(
          d.value || '(空)',
        )}</span></div>`;
      })
      .join('');
    const warn = res.jevError
      ? `<div class="rw-result-row"><span class="rw-tag rw-miss">Jev 失败</span><span>${escapeHtml(
          res.jevError,
        )}</span></div>`
      : '';
    const el = this.root.querySelector('#rw-fill-result');
    if (el) el.innerHTML = warn + (rows || '<div class="rw-empty">无结果</div>');
  }

  render(): void {
    this.tabButtons.forEach((b) => {
      b.classList.toggle('rw-active', b.dataset.tab === this.tab);
    });
    if (this.tab === 'ops') this.renderOps();
    else if (this.tab === 'dict') this.renderDict();
    else this.renderConfig();
  }

  private renderOps(): void {
    const dictCount = getDict().length;
    const fieldCount = this.cb.countFields();
    this.panelBody.innerHTML = `
      <div class="rw-row">
        <button class="rw-btn rw-primary" data-act="learn">学习本页</button>
        <button class="rw-btn rw-primary" data-act="fill">一键填报</button>
      </div>
      <div class="rw-hint">当前页面识别到 ${fieldCount} 个字段 · 字典共 ${dictCount} 条</div>
      <div class="rw-sep"></div>
      <div class="rw-label">填报结果</div>
      <div class="rw-result" id="rw-fill-result"><div class="rw-empty">点击“一键填报”后显示</div></div>
    `;
  }

  private renderDict(): void {
    const profiles = listProfiles();
    const activeId = activeProfileId();
    const options = profiles
      .map(
        (p) =>
          `<option value="${escapeHtml(p.id)}" ${p.id === activeId ? 'selected' : ''}>${escapeHtml(
            p.name,
          )}（${p.count}）</option>`,
      )
      .join('');
    this.panelBody.innerHTML = `
      <div class="rw-field">
        <label class="rw-label">身份</label>
        <select class="rw-select" data-role="profile">${options}</select>
      </div>
      <div class="rw-row">
        <button class="rw-btn" data-act="profileNew">新建</button>
        <button class="rw-btn" data-act="profileRename">重命名</button>
        <button class="rw-btn rw-danger" data-act="profileDelete">删除</button>
      </div>
      <div class="rw-field">
        <input class="rw-input" data-role="filter" placeholder="搜索字段…" value="${escapeHtml(this.dictFilter)}" />
      </div>
      <div class="rw-row">
        <button class="rw-btn" data-act="export">导出 JSON</button>
        <button class="rw-btn" data-act="import">导入 JSON</button>
        <button class="rw-btn rw-danger" data-act="clear">清空</button>
      </div>
      <div class="rw-list" id="rw-dict-list"></div>
    `;
    this.renderDictList();
  }

  private renderDictList(): void {
    const listEl = this.panelBody.querySelector('#rw-dict-list');
    if (!listEl) return;
    const q = this.dictFilter.trim().toLowerCase();
    const list = getDict().filter(
      (e) =>
        !q ||
        e.label.toLowerCase().includes(q) ||
        e.value.toLowerCase().includes(q) ||
        e.aliases.some((a) => a.toLowerCase().includes(q)),
    );
    if (!list.length) {
      listEl.innerHTML = '<div class="rw-empty">暂无内容，先去页面填写并点击“学习本页”</div>';
      return;
    }
    listEl.innerHTML = list
      .slice(0, 300)
      .map(
        (e) => `
      <div class="rw-item">
        <div class="rw-item-head">
          <span class="rw-item-label">${escapeHtml(e.label)}${
            e.aliases.length ? `<span class="rw-alias"> / ${escapeHtml(e.aliases.slice(0, 3).join('、'))}</span>` : ''
          }</span>
          <button class="rw-mini" data-del="${escapeHtml(e.key)}" title="删除">删除</button>
        </div>
        <input class="rw-input" data-role="value" data-entry-key="${escapeHtml(e.key)}" value="${escapeHtml(e.value)}" />
      </div>`,
      )
      .join('');
  }

  private renderConfig(): void {
    const cfg = loadConfig();
    this.panelBody.innerHTML = `
      <div class="rw-field">
        <label class="rw-switch"><input type="checkbox" data-cfg="jevEnabled" ${cfg.jevEnabled ? 'checked' : ''}/> 启用 Jev 语义匹配</label>
        <div class="rw-hint">本地匹配不到时，调用 Jev 从字典中选择最合适的字段。</div>
      </div>
      <div class="rw-field">
        <label class="rw-label">Jev API Key</label>
        <input class="rw-input" type="password" data-cfg="jevApiKey" value="${escapeHtml(cfg.jevApiKey)}" placeholder="TypeSafe API Key（jv_live_... 或官方 key）" />
      </div>
      <div class="rw-field">
        <label class="rw-label">Jev 接口地址</label>
        <input class="rw-input" data-cfg="jevBaseUrl" value="${escapeHtml(cfg.jevBaseUrl)}" placeholder="留空自动判断，默认 https://api.typesafe.ai/v1/systemone" />
      </div>
      <div class="rw-field">
        <label class="rw-label">Jev 模型</label>
        <input class="rw-input" data-cfg="jevModel" value="${escapeHtml(cfg.jevModel)}" />
      </div>
      <div class="rw-field">
        <label class="rw-label">本地匹配阈值：<span data-cfg="minScoreVal">${cfg.minScore}</span></label>
        <input type="range" min="0.3" max="1" step="0.01" data-cfg="minScore" value="${cfg.minScore}" />
      </div>
      <div class="rw-field">
        <label class="rw-label">Jev 最低置信度：<span data-cfg="jevMinConfVal">${cfg.jevMinConfidence}</span></label>
        <input type="range" min="0" max="1" step="0.01" data-cfg="jevMinConfidence" value="${cfg.jevMinConfidence}" />
      </div>
      <div class="rw-field">
        <label class="rw-switch"><input type="checkbox" data-cfg="autoFillOnLoad" ${cfg.autoFillOnLoad ? 'checked' : ''}/> 页面加载后自动尝试填报</label>
      </div>
      <div class="rw-row">
        <button class="rw-btn rw-primary" data-act="saveConfig">保存设置</button>
        <button class="rw-btn" data-act="testJev">测试连接</button>
        <button class="rw-btn" data-act="resetConfig">恢复默认</button>
      </div>
    `;
    const score = this.panelBody.querySelector('[data-cfg="minScore"]') as HTMLInputElement;
    const scoreVal = this.panelBody.querySelector('[data-cfg="minScoreVal"]') as HTMLElement;
    score?.addEventListener('input', () => (scoreVal.textContent = score.value));
    const conf = this.panelBody.querySelector('[data-cfg="jevMinConfidence"]') as HTMLInputElement;
    const confVal = this.panelBody.querySelector('[data-cfg="jevMinConfVal"]') as HTMLElement;
    conf?.addEventListener('input', () => (confVal.textContent = conf.value));
  }
}

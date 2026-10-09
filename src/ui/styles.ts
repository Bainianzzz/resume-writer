export const PANEL_CSS = `
:host, :host * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
:host { position: fixed; right: 18px; bottom: 18px; z-index: 2147483647; color: #1f2329; font-size: 13px; line-height: 1.5; }
.rw-fab { width: 52px; height: 52px; border-radius: 50%; background: #3370ff; color: #fff; border: none; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.25); font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.rw-fab:hover { background: #245bdb; }
.rw-panel { position: absolute; right: 0; bottom: 64px; width: 380px; height: min(482px, 80vh); overflow: hidden; background: #fff; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,.22); display: flex; flex-direction: column; }
.rw-head { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #e5e6eb; }
.rw-title { font-weight: 600; font-size: 14px; }
.rw-icon-btn { background: none; border: none; cursor: pointer; color: #646a73; font-size: 16px; padding: 2px 6px; border-radius: 4px; }
.rw-icon-btn:hover { background: #f2f3f5; }
.rw-tabs-root { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.rw-tabs { flex: 0 0 auto; display: flex; border-bottom: 1px solid #e5e6eb; }
.rw-tab { flex: 1; padding: 9px 0; background: none; border: none; cursor: pointer; color: #646a73; font-size: 13px; border-bottom: 2px solid transparent; }
.rw-tab:focus { outline: none; }
.rw-tab:focus-visible { background: #f2f3f5; }
.rw-tab[data-state="active"] { color: #3370ff; border-bottom-color: #3370ff; font-weight: 600; }
.rw-body { padding: 12px 14px; overflow-y: auto; overflow-x: hidden; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.rw-body[hidden] { display: none; }
.rw-body:focus { outline: none; }
.rw-body > * { flex: 0 0 auto; }
.rw-body > .rw-list, .rw-body > .rw-result { flex: 1 1 auto; min-height: 120px; }
.rw-row { display: flex; gap: 8px; margin-bottom: 8px; }
.rw-row:last-child { margin-bottom: 0; }
.rw-btn { flex: 1; padding: 9px 10px; border-radius: 6px; border: 1px solid #dee0e3; background: #fff; cursor: pointer; font-size: 13px; color: #1f2329; }
.rw-btn:hover { border-color: #3370ff; color: #3370ff; }
.rw-btn.rw-primary { background: #3370ff; border-color: #3370ff; color: #fff; }
.rw-btn.rw-primary:hover { background: #245bdb; }
.rw-btn.rw-danger { color: #d83931; border-color: #f0b7b4; }
.rw-btn.rw-danger:hover { background: #fef1f1; }
.rw-field { margin-bottom: 10px; }
.rw-label { display: block; color: #646a73; margin-bottom: 4px; font-size: 12px; }
.rw-input, .rw-textarea { width: 100%; padding: 6px 8px; border: 1px solid #dee0e3; border-radius: 6px; font-size: 13px; background: #fff; color: #1f2329; }
.rw-input:focus, .rw-textarea:focus { outline: none; border-color: #3370ff; }

/* Reka Select（身份） */
.rw-select-trigger { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 6px; height: 32px; padding: 0 10px; border: 1px solid #dee0e3; border-radius: 6px; font-size: 13px; background: #fff; color: #1f2329; cursor: pointer; }
.rw-select-trigger:hover { border-color: #c9cdd4; }
.rw-select-trigger[data-state="open"], .rw-select-trigger:focus { outline: none; border-color: #3370ff; box-shadow: 0 0 0 2px rgba(51,112,255,.12); }
.rw-select-icon { display: flex; align-items: center; color: #8f959e; transition: transform .15s; }
.rw-select-icon svg { display: block; }
.rw-select-trigger[data-state="open"] .rw-select-icon { transform: rotate(180deg); }
.rw-select-content { z-index: 2147483647; min-width: var(--reka-select-trigger-width); max-height: var(--reka-select-content-available-height); background: #fff; border: 1px solid #e5e6eb; border-radius: 8px; box-shadow: 0 8px 28px rgba(0,0,0,.14); overflow: hidden; }
.rw-select-viewport { padding: 4px; }
.rw-select-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; border-radius: 6px; font-size: 13px; color: #1f2329; cursor: pointer; outline: none; }
.rw-select-item[data-highlighted] { background: #f2f3f5; }
.rw-select-item[data-state="checked"] { color: #3370ff; font-weight: 500; }
.rw-select-indicator { color: #3370ff; font-size: 12px; }

/* Reka Switch（布尔开关） */
.rw-switch-row { display: flex; align-items: center; gap: 8px; }
.rw-switch-label { font-size: 13px; color: #1f2329; }
.rw-switch { position: relative; flex: 0 0 auto; width: 34px; height: 20px; padding: 0; border: none; border-radius: 999px; background: #dee0e3; cursor: pointer; transition: background .15s; }
.rw-switch[data-state="checked"] { background: #3370ff; }
.rw-switch:focus-visible { outline: 2px solid #3370ff; outline-offset: 2px; }
.rw-switch-thumb { display: block; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); transform: translateX(2px); transition: transform .15s; }
.rw-switch[data-state="checked"] .rw-switch-thumb { transform: translateX(16px); }

/* Reka Slider（阈值） */
.rw-slider { position: relative; display: flex; align-items: center; width: 100%; height: 20px; touch-action: none; user-select: none; }
.rw-slider-track { position: relative; flex-grow: 1; height: 4px; border-radius: 2px; background: #e5e6eb; }
.rw-slider-range { position: absolute; height: 100%; border-radius: 2px; background: #3370ff; }
.rw-slider-thumb { display: block; width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 2px solid #3370ff; box-shadow: 0 1px 2px rgba(0,0,0,.2); outline: none; }
.rw-empty { text-align: center; color: #8f959e; padding: 24px 0; }
.rw-list { border: 1px solid #e5e6eb; border-radius: 6px; overflow-y: auto; flex: 1 1 auto; min-height: 120px; }
.rw-item { padding: 8px 10px; border-bottom: 1px solid #f0f1f2; }
.rw-item:last-child { border-bottom: none; }
.rw-item-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.rw-item-label { font-weight: 600; font-size: 12px; color: #1f2329; word-break: break-all; }
.rw-item-label .rw-alias { font-weight: 400; color: #8f959e; font-size: 11px; }
.rw-mini { background: none; border: none; cursor: pointer; color: #8f959e; font-size: 12px; padding: 2px 4px; border-radius: 4px; }
.rw-mini:hover { color: #d83931; background: #fef1f1; }
.rw-item input.rw-input { margin-top: 4px; }
.rw-result { margin-top: 8px; border: 1px solid #e5e6eb; border-radius: 6px; overflow-y: auto; font-size: 12px; flex: 1 1 auto; min-height: 0; }
.rw-result-row { display: flex; gap: 6px; padding: 6px 8px; border-bottom: 1px solid #f0f1f2; }
.rw-result-row:last-child { border-bottom: none; }
.rw-tag { flex: 0 0 auto; padding: 1px 6px; border-radius: 4px; font-size: 11px; }
.rw-tag.rw-ok { background: #e8f3ff; color: #3370ff; }
.rw-tag.rw-miss { background: #f2f3f5; color: #8f959e; }
.rw-hint { color: #8f959e; font-size: 11px; margin-top: 2px; }
.rw-sep { height: 1px; background: #e5e6eb; margin: 12px 0; }
.rw-toast-viewport { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; max-width: min(560px, 90vw); z-index: 2147483647; pointer-events: none; outline: none; }
.rw-toast { background: #1f2329; color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 13px; max-width: min(560px, 90vw); white-space: normal; word-break: break-word; text-align: left; box-shadow: 0 6px 24px rgba(0,0,0,.28); }
.rw-toast-desc { white-space: normal; word-break: break-word; }
`;

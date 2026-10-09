import type { DictEntry, FieldDescriptor, FieldKind } from './types';
import { getDict, loadConfig, upsertEntries } from './storage';
import { scanFields } from './dom/scanner';
import { fillAsyncField, fillField, readCustomOptions } from './dom/setter';
import { extractCustomValue } from './dom/custom';
import { matchLocal, prefilterCandidates } from './match/local';
import { jevMatch, jevPickOptions } from './match/jev';
import type { JevOptionMatch, JevOptionTask } from './match/jev';
import { normalize, similarity } from './match/text';

/** 选择类字段：字典值与页面选项可能措辞不同，需要值→选项映射 */
const CHOICE_KINDS = new Set<FieldKind>(['select', 'radio', 'checkbox']);

/** 多选值分隔符（与 setter 中复选框组保持一致） */
const MULTI_VALUE_SPLIT = /[、,，;；|/\n]+/;

/** 把字典值拆成待判断的片段：多选拆开，单选整体 */
function splitWantedValues(kind: FieldKind, value: string): string[] {
  const parts = kind === 'checkbox' ? value.split(MULTI_VALUE_SPLIT) : [value];
  return parts.map((v) => v.trim()).filter(Boolean);
}

/** 某个值与页面选项是否存在本地命中（阈值与 setter 一致） */
function optionHit(value: string, options: string[]): boolean {
  return options.some((o) => similarity(o, value) >= 0.5);
}

/** 本地未命中、需要交给 Jev 判断值→选项的选择类字段 */
interface PendingOption {
  field: FieldDescriptor;
  entry: DictEntry;
  /** 字典值拆分后的全部片段 */
  wanted: string[];
  /** 本地未命中的片段 */
  missing: string[];
  via: string;
  score: number;
}

export interface LearnResult {
  scanned: number;
  learned: number;
  added: number;
  updated: number;
}

/** 学习阶段：读取当前已填写的表单，写入字典 */
export function learnPage(): LearnResult {
  const fields = scanFields();
  const origin = location.host;
  const now = Date.now();
  const entries: DictEntry[] = [];

  for (const field of fields) {
    const value = field.value.trim();
    if (!value) continue;
    // 跳过明显非个人信息、但仍可保留的字段（保持宽松，先全部学习）
    const key = normalize(field.label);
    if (!key) continue;
    entries.push({
      key,
      label: field.label,
      aliases: field.labels.slice(1),
      value,
      kind: field.kind,
      options: field.options.length ? field.options : undefined,
      updatedAt: now,
      origins: [origin],
    });
  }

  const { added, updated } = upsertEntries(entries);
  return { scanned: fields.length, learned: entries.length, added, updated };
}

export interface FillDetail {
  label: string;
  value: string;
  via: string;
  score: number;
  ok: boolean;
}

export interface FillResult {
  scanned: number;
  matched: number;
  filled: number;
  details: FillDetail[];
  /** Jev 请求层面的错误（网络/HTTP），用于区分“真的没匹配”和“请求失败” */
  jevError?: string;
}

/** 填报阶段：本地模糊匹配 + 可选 Jev 语义匹配 */
export async function fillPage(): Promise<FillResult> {
  const cfg = loadConfig();
  const dict = getDict();
  const fields = scanFields();
  const details: FillDetail[] = [];
  let matched = 0;
  let filled = 0;

  const unmatched: FieldDescriptor[] = [];
  /** 需要异步/多目标填充的字段（自定义 Select、区间） */
  const asyncQueue: Array<{ field: FieldDescriptor; value: string; via: string; score: number }> = [];
  /** 选择类字段：字典值与页面选项对不上，待 Jev 判断 */
  const optionQueue: PendingOption[] = [];
  const jevReady = cfg.jevEnabled && !!cfg.jevApiKey;

  const writeField = (field: FieldDescriptor, entry: DictEntry, via: string, score: number): void => {
    matched++;
    if (field.kind === 'custom' || field.kind === 'range') {
      asyncQueue.push({ field, value: entry.value, via, score });
      return;
    }

    let ok = false;
    try {
      ok = fillField(field, entry.value);
    } catch (err) {
      console.warn('[resume-writer] 填充失败：', field.label, err);
    }

    // 选择类字段：本地没填上，或仍有多选项没命中时，交给 Jev 判断值与选项的对应
    const isChoice = CHOICE_KINDS.has(field.kind) && field.options.length > 0;
    if (isChoice && jevReady) {
      const wanted = splitWantedValues(field.kind, entry.value);
      const missing = ok ? wanted.filter((v) => !optionHit(v, field.options)) : wanted;
      if (missing.length) {
        optionQueue.push({ field, entry, wanted, missing, via, score });
        return;
      }
    }

    if (ok) filled++;
    details.push({ label: field.label, value: entry.value, via, score, ok });
  };

  for (const field of fields) {
    const local = dict.length ? matchLocal(field, dict, cfg.minScore) : null;
    if (local) {
      writeField(field, local.entry, local.via === 'exact' ? '完全匹配' : '近似匹配', local.score);
    } else {
      unmatched.push(field);
    }
  }

  let jevError: string | undefined;
  /** 本地预筛后仍有候选、真正发给 Jev 的字段 */
  const jevAsked = new Set<FieldDescriptor>();

  if (cfg.jevEnabled && cfg.jevApiKey && unmatched.length) {
    const tasks = unmatched
      .map((field) => ({
        field,
        candidates: prefilterCandidates(field, dict).map((r) => r.entry),
      }))
      // 本地预筛后毫无相关候选的字段，不浪费一次模型调用
      .filter((t) => t.candidates.length > 0);
    for (const t of tasks) jevAsked.add(t.field);

    if (tasks.length) {
      const outcome = await jevMatch(tasks, cfg);
      if (outcome.error) jevError = outcome.error;
      for (const [field, m] of outcome.matches) {
        writeField(field, m.entry, `jev 推断（${m.confidence.toFixed(2)}）`, m.confidence);
      }
    }
  }

  // 选择类字段：字典值与页面选项对不上，用 Jev 判断应选哪个选项
  if (optionQueue.length) {
    const tasks: JevOptionTask[] = [];
    for (const item of optionQueue) {
      for (const value of item.missing) {
        tasks.push({ field: item.field, value, options: item.field.options });
      }
    }

    const outcome = await jevPickOptions(tasks, cfg);
    if (outcome.error) jevError = outcome.error;

    const resolvedByField = new Map<FieldDescriptor, JevOptionMatch[]>();
    for (const m of outcome.matches) {
      const list = resolvedByField.get(m.field) ?? [];
      list.push(m);
      resolvedByField.set(m.field, list);
    }

    for (const item of optionQueue) {
      const resolved = resolvedByField.get(item.field) ?? [];
      const keep = item.wanted.filter((v) => optionHit(v, item.field.options));
      const values = [...keep, ...resolved.map((m) => m.option)];
      let ok = false;
      if (values.length) {
        try {
          ok = fillField(item.field, values.join('、'));
        } catch (err) {
          console.warn('[resume-writer] 填充失败：', item.field.label, err);
        }
      }
      if (ok) filled++;
      const confidence = resolved.length
        ? Math.min(...resolved.map((m) => m.confidence))
        : item.score;
      details.push({
        label: item.field.label,
        value: values.join('、') || item.entry.value,
        via: resolved.length ? `jev 选项（${confidence.toFixed(2)}）` : item.via,
        score: confidence,
        ok,
      });
    }
  }

  // 自定义组件 / 区间字段：逐个异步交互填充
  for (const item of asyncQueue) {
    // 自定义组件（div 型 select）：选项要展开下拉才能拿到，先本地填，再对没选上的值用 Jev 判断应选哪个选项
    if (item.field.kind === 'custom') {
      let ok = false;
      try {
        ok = await fillAsyncField(item.field, item.value);
      } catch (err) {
        console.warn('[resume-writer] 填充失败：', item.field.label, err);
      }

      let via = item.via;
      let score = item.score;
      let shown = item.value;

      if (jevReady) {
        const wanted = splitWantedValues('checkbox', item.value);
        const selected = new Set(extractCustomValue(item.field.el));
        const missing = wanted.filter(
          (v) => !selected.has(v) && ![...selected].some((s) => similarity(s, v) >= 0.5),
        );
        if (missing.length) {
          const options = await readCustomOptions(item.field);
          if (options.length) {
            const outcome = await jevPickOptions(
              missing.map((value) => ({ field: item.field, value, options })),
              cfg,
            );
            if (outcome.error) jevError = outcome.error;
            const picked = [...new Set(outcome.matches.map((m) => m.option))];
            if (picked.length) {
              try {
                ok = (await fillAsyncField(item.field, picked.join('、'))) || ok;
              } catch (err) {
                console.warn('[resume-writer] 填充失败：', item.field.label, err);
              }
              score = Math.min(...outcome.matches.map((m) => m.confidence));
              via = `jev 选项（${score.toFixed(2)}）`;
              const finalSel = extractCustomValue(item.field.el);
              if (finalSel.length) shown = finalSel.join('、');
            }
          }
        }
      }

      if (ok) filled++;
      details.push({ label: item.field.label, value: shown, via, score, ok });
      continue;
    }

    let ok = false;
    try {
      ok = await fillAsyncField(item.field, item.value);
    } catch (err) {
      console.warn('[resume-writer] 填充失败：', item.field.label, err);
    }
    if (ok) filled++;
    details.push({ label: item.field.label, value: item.value, via: item.via, score: item.score, ok });
  }

  // 未匹配字段也记录，方便用户看到漏了什么
  for (const field of unmatched) {
    if (!details.some((d) => d.label === field.label)) {
      const noCandidate = cfg.jevEnabled && cfg.jevApiKey && !jevAsked.has(field);
      details.push({
        label: field.label,
        value: '',
        via: noCandidate ? '无候选' : '未匹配',
        score: 0,
        ok: false,
      });
    }
  }

  return { scanned: fields.length, matched, filled, details, jevError };
}

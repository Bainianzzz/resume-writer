import type { DictEntry, FieldDescriptor } from './types';
import { getDict, loadConfig, upsertEntries } from './storage';
import { scanFields } from './dom/scanner';
import { fillAsyncField, fillField } from './dom/setter';
import { matchLocal, prefilterCandidates } from './match/local';
import { jevMatch } from './match/jev';
import { normalize } from './match/text';

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
    if (ok) filled++;
    details.push({ label: field.label, value: entry.value, via, score, ok });
  };

  for (const field of fields) {
    const local = dict.length ? matchLocal(field, dict, cfg.minScore) : null;
    if (local) {
      writeField(field, local.entry, `本地:${local.via}`, local.score);
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
        writeField(field, m.entry, 'Jev', m.confidence);
      }
    }
  }

  // 自定义组件 / 区间字段：逐个异步交互填充
  for (const item of asyncQueue) {
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

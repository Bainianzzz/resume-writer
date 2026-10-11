import type { DictEntry, FieldDescriptor } from '../types';
import { literalEvidence, normalize } from './text';

/** 一个字段最多送给 Jev 的疑似选项数 */
export const JEV_CANDIDATE_LIMIT = 6;

/** 字段侧参与匹配的全部标签 */
function fieldLabels(field: FieldDescriptor): string[] {
  const labels = field.labels.length ? field.labels : [field.label];
  return labels.filter(Boolean);
}

/** 字段与单条字典记录之间的最强字面证据层级（0 = 无交集） */
export function entryEvidence(field: FieldDescriptor, entry: DictEntry): number {
  const entryLabels = [entry.label, ...entry.aliases].filter(Boolean);
  let best = 0;
  for (const fl of fieldLabels(field)) {
    for (const el of entryLabels) {
      const e = literalEvidence(fl, el);
      if (e > best) best = e;
    }
  }
  return best;
}

/**
 * 完全匹配：归一化后与条目 label / 别名完全相等。命中即本地直填，不调 Jev。
 * 优先 label 命中（比只命中别名更可信），各自保持字典顺序。
 */
export function matchExact(field: FieldDescriptor, dict: DictEntry[]): DictEntry | null {
  const wanted = new Set(fieldLabels(field).map(normalize).filter(Boolean));
  if (!wanted.size) return null;
  for (const entry of dict) {
    if (entry.label && wanted.has(normalize(entry.label))) return entry;
  }
  for (const entry of dict) {
    for (const alias of entry.aliases) {
      if (alias && wanted.has(normalize(alias))) return entry;
    }
  }
  return null;
}

export interface Candidate {
  entry: DictEntry;
  /** 字面证据层级，越大越强 */
  evidence: number;
}

/**
 * 疑似选项：按字面证据分层（同义组 > 包含 > 二元组 > 单字），
 * 不做任何加权打分；层内保持字典原序（sort 稳定），超出上限只截尾部。
 * 返回空数组 = 不在字典里，调用方应放弃该字段。
 */
export function prefilterCandidates(
  field: FieldDescriptor,
  dict: DictEntry[],
  limit = JEV_CANDIDATE_LIMIT,
): Candidate[] {
  const scored: Candidate[] = [];
  for (const entry of dict) {
    const evidence = entryEvidence(field, entry);
    if (evidence > 0) scored.push({ entry, evidence });
  }
  scored.sort((a, b) => b.evidence - a.evidence);
  return scored.slice(0, limit);
}

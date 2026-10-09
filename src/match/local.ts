import type { DictEntry, FieldDescriptor, MatchResult } from '../types';
import { looseScore, normalize, sameSynonymGroup, similarity } from './text';

/** 一个字段最多送给 Jev 的候选数 */
export const JEV_CANDIDATE_LIMIT = 12;

function classify(score: number, a: string, b: string): MatchResult['via'] {
  if (normalize(a) === normalize(b)) return 'exact';
  if (score >= 0.95 || sameSynonymGroup(normalize(a), normalize(b))) return 'alias';
  if (score >= 0.7) return 'contains';
  return 'fuzzy';
}

function scoreEntry(field: FieldDescriptor, entry: DictEntry): { score: number; via: MatchResult['via'] } {
  const fieldLabels = field.labels.length ? field.labels : [field.label];
  const entryLabels = [entry.label, ...entry.aliases].filter(Boolean);
  let best = 0;
  let via: MatchResult['via'] = 'fuzzy';
  for (const fl of fieldLabels) {
    for (const el of entryLabels) {
      const s = similarity(fl, el);
      if (s > best) {
        best = s;
        via = classify(s, fl, el);
      }
    }
  }
  return { score: best, via };
}

/** 按分数排序的候选（用于给 Jev 预筛） */
export function rankCandidates(
  field: FieldDescriptor,
  dict: DictEntry[],
): Array<{ entry: DictEntry; score: number }> {
  return dict
    .map((entry) => ({ entry, score: scoreEntry(field, entry).score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * 先用正则/模糊匹配把字典缩小到“可能相关”的条目，再交给 Jev。
 * 无任何字面关联的条目直接排除；数量封顶，避免把整个字典发给模型。
 */
export function prefilterCandidates(
  field: FieldDescriptor,
  dict: DictEntry[],
  limit = JEV_CANDIDATE_LIMIT,
): Array<{ entry: DictEntry; score: number; loose: number }> {
  const fieldLabels = field.labels.length ? field.labels : [field.label];
  const scored: Array<{ entry: DictEntry; score: number; loose: number }> = [];

  for (const entry of dict) {
    const entryLabels = [entry.label, ...entry.aliases].filter(Boolean);
    let loose = 0;
    for (const fl of fieldLabels) {
      for (const el of entryLabels) {
        const s = looseScore(fl, el);
        if (s > loose) loose = s;
      }
    }
    if (loose <= 0) continue;
    scored.push({ entry, score: scoreEntry(field, entry).score, loose });
  }

  scored.sort((a, b) => b.score - a.score || b.loose - a.loose);
  return scored.slice(0, limit);
}

/** 本地匹配单个字段 */
export function matchLocal(
  field: FieldDescriptor,
  dict: DictEntry[],
  minScore: number,
): MatchResult | null {
  let best: MatchResult | null = null;
  for (const entry of dict) {
    const { score, via } = scoreEntry(field, entry);
    if (!best || score > best.score) {
      best = { entry, score, via };
    }
  }
  if (best && best.score >= minScore) return best;
  return null;
}

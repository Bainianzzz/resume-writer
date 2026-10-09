import { GM_xmlhttpRequest } from '$';
import type { Config, DictEntry, FieldDescriptor } from '../types';

/** 一个待 Jev 判断的字段 */
export interface JevFieldTask {
  field: FieldDescriptor;
  candidates: DictEntry[];
}

export interface JevMatch {
  entry: DictEntry;
  confidence: number;
  probability: number;
}

export interface JevMatchOutcome {
  matches: Map<FieldDescriptor, JevMatch>;
  /** 请求层面的错误（网络/HTTP），与“确实没有匹配项”区分开 */
  error?: string;
}

interface ChoiceAnswer {
  type: 'choice';
  choice: string;
  probabilities?: Record<string, number>;
  confidence?: number;
}

const NONE = '__none__';

/** 根据 key 前缀推断合适的接口地址 */
export function resolveBaseUrl(cfg: Config): string {
  if (cfg.jevBaseUrl && cfg.jevBaseUrl.trim()) return cfg.jevBaseUrl.trim();
  if (cfg.jevApiKey.startsWith('jv_live_')) {
    return 'https://jevtypesafeai.com/api/v1/decide';
  }
  return 'https://api.typesafe.ai/v1/systemone';
}

interface HttpResult {
  status: number;
  ok: boolean;
  text: string;
  retryAfter?: number;
}

function parseRetryAfter(headers: string): number | undefined {
  const m = /^retry-after:\s*(.+)$/im.exec(headers);
  if (!m) return undefined;
  const v = m[1].trim();
  const seconds = Number(v);
  if (!Number.isNaN(seconds)) return seconds * 1000;
  const date = Date.parse(v);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}

/** 走 GM_xmlhttpRequest，绕过页面 CORS；无 GM 环境时回退 fetch */
function postJson(url: string, apiKey: string, body: unknown): Promise<HttpResult> {
  const payload = JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  if (typeof GM_xmlhttpRequest === 'function') {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url,
        headers,
        data: payload,
        responseType: 'text',
        timeout: 30000,
        onload: (res) =>
          resolve({
            status: res.status,
            ok: res.status >= 200 && res.status < 300,
            text: res.responseText,
            retryAfter: parseRetryAfter(res.responseHeaders || ''),
          }),
        onerror: () => reject(new Error('网络错误')),
        ontimeout: () => reject(new Error('请求超时')),
      });
    });
  }

  return fetch(url, { method: 'POST', headers, body: payload }).then(async (res) => ({
    status: res.status,
    ok: res.ok,
    text: await res.text(),
    retryAfter: parseRetryAfter(res.headers.get('retry-after') || ''),
  }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 带 429/529 指数退避的请求，优先遵循 Retry-After */
async function postJsonWithRetry(
  url: string,
  apiKey: string,
  body: unknown,
  retries = 3,
): Promise<any> {
  let lastError: Error = new Error('未知错误');
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await postJson(url, apiKey, body);
      if (res.status === 429 || res.status === 529) {
        lastError = new Error(`HTTP ${res.status}（限流/过载）`);
        const wait = res.retryAfter ?? 500 * 2 ** attempt;
        if (attempt < retries) await sleep(wait);
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.text.slice(0, 200)}`);
      }
      return JSON.parse(res.text);
    } catch (err) {
      lastError = err as Error;
      if (attempt < retries) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
    }
  }
  throw lastError;
}

/** 值预览：帮助模型区分同义标签（如电话 vs 邮箱靠格式区分） */
function valuePreview(value: string): string {
  const v = value.trim();
  if (!v) return '';
  return v.length <= 24 ? v : v.slice(0, 24) + '…';
}

/** 一条已保存信息在 state.saved_info 中的形态，id 即字典 key */
function toSavedInfo(entry: DictEntry): Record<string, unknown> {
  const item: Record<string, unknown> = { key: entry.key, label: entry.label };
  if (entry.aliases.length) item.aliases = entry.aliases.slice(0, 6);
  const preview = valuePreview(entry.value);
  if (preview) item.value = preview;
  if (entry.kind) item.control = entry.kind;
  if (entry.options?.length) item.options = entry.options.slice(0, 20);
  return item;
}

/** 生成一条候选的 criteria 描述 */
function criteriaDescription(entry: DictEntry): string {
  const parts = [entry.label];
  if (entry.aliases.length) parts.push(`又称：${entry.aliases.slice(0, 4).join('、')}`);
  const preview = valuePreview(entry.value);
  if (preview) parts.push(`示例值：${preview}`);
  if (entry.kind) parts.push(`控件：${entry.kind}`);
  return parts.join('；');
}

/**
 * 调用 Jev 的 choice 原语，为多个字段一次性做语义匹配。
 * 每个字段是一个 question；criteria 的选项即字典 key（语义化），
 * 已保存信息放在 state.saved_info 供模型引用。
 */
export async function jevMatch(tasks: JevFieldTask[], cfg: Config): Promise<JevMatchOutcome> {
  const result = new Map<FieldDescriptor, JevMatch>();
  const usable = tasks.filter((t) => t.candidates.length > 0);
  if (!cfg.jevApiKey || usable.length === 0) return { matches: result };

  // 所有可能用到的字典项，按 key 去重后放进 state.saved_info
  const entryByKey = new Map<string, DictEntry>();
  for (const task of usable) {
    for (const entry of task.candidates) entryByKey.set(entry.key, entry);
  }
  const savedInfo = [...entryByKey.values()].map(toSavedInfo);

  const state = {
    page: {
      title: document.title || '(无标题)',
      host: location.host,
    },
    saved_info: savedInfo,
  };

  const questions: Record<string, unknown> = {};
  const index = new Map<string, FieldDescriptor>();
  const criteriaByKey = new Map<string, string>();

  usable.forEach((task, i) => {
    const qname = `field_${i}`;
    const criteria: Record<string, string> = {};
    for (const entry of task.candidates) {
      if (!criteriaByKey.has(entry.key)) {
        criteriaByKey.set(entry.key, criteriaDescription(entry));
      }
      criteria[entry.key] = criteriaByKey.get(entry.key) as string;
    }
    criteria[NONE] = '以上都不是，没有合适匹配';

    const fieldData: Record<string, unknown> = {
      label: task.field.label,
      control: task.field.kind,
    };
    if (task.field.labels.length > 1) fieldData.other_labels = task.field.labels.slice(1, 6);
    if (task.field.placeholder) fieldData.placeholder = task.field.placeholder;
    if (task.field.options.length) fieldData.options = task.field.options.slice(0, 20);

    index.set(qname, task.field);
    questions[qname] = {
      type: 'choice',
      instructions: {
        field: fieldData,
        question:
          '在 `saved_info` 中，哪一条最应该填入 `field` 描述的目标表单字段？' +
          '只在语义确实对应时选择；无法对应请选“以上都不是”。',
      },
      criteria,
    };
  });

  const body = {
    model: cfg.jevModel || 'jev-latest',
    state,
    questions,
  };

  let data: any;
  try {
    data = await postJsonWithRetry(resolveBaseUrl(cfg), cfg.jevApiKey, body);
  } catch (err) {
    const message = (err as Error).message || '未知错误';
    console.warn('[resume-writer] Jev 请求失败：', err);
    return { matches: result, error: message };
  }

  const answers = (data?.answers ?? {}) as Record<string, ChoiceAnswer>;
  for (const [qname, field] of index) {
    const answer = answers[qname];
    if (!answer || answer.type !== 'choice') continue;
    if (answer.choice === NONE) continue;
    const entry = entryByKey.get(answer.choice);
    if (!entry) continue;
    const confidence = typeof answer.confidence === 'number' ? answer.confidence : 0;
    const probability = answer.probabilities?.[answer.choice] ?? confidence;
    if (confidence < cfg.jevMinConfidence) continue;
    result.set(field, { entry, confidence, probability });
  }

  return { matches: result };
}

/** 测试连接：发一个最小的 noul 请求，确认 key 和地址可用 */
export async function testJevConnection(
  cfg: Config,
): Promise<{ ok: boolean; message: string; model?: string }> {
  if (!cfg.jevApiKey) return { ok: false, message: '未填写 API Key' };
  try {
    const data = await postJsonWithRetry(
      resolveBaseUrl(cfg),
      cfg.jevApiKey,
      {
        model: cfg.jevModel || 'jev-latest',
        state: '这是一次连接测试。',
        questions: {
          ping: { type: 'noul', instructions: '这段文本是否是中文？' },
        },
      },
      1,
    );
    const noul = data?.answers?.ping?.noul;
    return {
      ok: true,
      message: `连接正常，返回 model=${data?.model ?? '?'}，noul=${noul}`,
      model: data?.model,
    };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

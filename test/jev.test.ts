import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetGm, gmMock } from '$';
import { jevMatch, resolveBaseUrl } from '../src/match/jev';
import type { Config, DictEntry, FieldDescriptor } from '../src/types';

function config(partial: Partial<Config> = {}): Config {
  return {
    jevEnabled: true,
    jevApiKey: 'jv_live_test',
    jevModel: 'jev-latest',
    minScore: 0.62,
    autoFillOnLoad: false,
    jevMinConfidence: 0.5,
    ...partial,
  };
}

function entry(key: string, label: string, value: string): DictEntry {
  return { key, label, aliases: [], value, updatedAt: 1, origins: [] };
}

function field(label: string): FieldDescriptor {
  return {
    el: document.createElement('input'),
    kind: 'text',
    inputType: 'text',
    labels: [label],
    label,
    name: '',
    id: '',
    placeholder: '',
    value: '',
    options: [],
    selector: '',
    groupKey: label,
  };
}

beforeEach(() => {
  __resetGm();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('resolveBaseUrl', () => {
  it('jv_live_ 前缀走托管网关', () => {
    expect(resolveBaseUrl(config({ jevApiKey: 'jv_live_abc' }))).toBe(
      'https://jevtypesafeai.com/api/v1/decide',
    );
  });

  it('其他 key 走官方端点', () => {
    expect(resolveBaseUrl(config({ jevApiKey: 'sk-official' }))).toBe(
      'https://api.typesafe.ai/v1/systemone',
    );
  });
});

describe('jevMatch：请求构造', () => {
  it('发送 model/state/questions 并带上鉴权头', async () => {
    const name = field('姓名');
    gmMock.nextResponse = {
      text: JSON.stringify({
        model: 'jev-1.13.0',
        answers: {
          field_0: { type: 'choice', choice: 'name', probabilities: { name: 0.92 }, confidence: 0.9 },
        },
      }),
    };

    const out = await jevMatch([{ field: name, candidates: [entry('name', '姓名', '张三')] }], config());

    expect(gmMock.lastRequest?.method).toBe('POST');
    expect(gmMock.lastRequest?.url).toBe('https://jevtypesafeai.com/api/v1/decide');
    expect(gmMock.lastRequest?.headers.Authorization).toBe('Bearer jv_live_test');

    const body = JSON.parse(gmMock.lastRequest!.data);
    expect(body.model).toBe('jev-latest');
    expect(body.state).toHaveProperty('saved_info');
    expect(body.questions.field_0.type).toBe('choice');
    // 选项键即字典 key
    expect(Object.keys(body.questions.field_0.criteria)).toContain('name');

    expect(out.error).toBeUndefined();
    expect(out.matches.get(name)?.entry.label).toBe('姓名');
  });

  it('选项为“以上都不是”时跳过', async () => {
    const f = field('描述');
    gmMock.nextResponse = {
      text: JSON.stringify({
        answers: { field_0: { type: 'choice', choice: '__none__', confidence: 0.9 } },
      }),
    };
    const out = await jevMatch([{ field: f, candidates: [entry('desc', '描述', 'x')] }], config());
    expect(out.matches.size).toBe(0);
  });

  it('置信度低于阈值时忽略', async () => {
    const f = field('姓名');
    gmMock.nextResponse = {
      text: JSON.stringify({
        answers: { field_0: { type: 'choice', choice: 'name', confidence: 0.2 } },
      }),
    };
    const out = await jevMatch([{ field: f, candidates: [entry('name', '姓名', '张三')] }], config({ jevMinConfidence: 0.5 }));
    expect(out.matches.size).toBe(0);
  });

  it('未配置 key 时直接返回空', async () => {
    const out = await jevMatch([{ field: field('姓名'), candidates: [entry('name', '姓名', '张三')] }], config({ jevApiKey: '' }));
    expect(out.matches.size).toBe(0);
    expect(gmMock.lastRequest).toBeNull();
  });
});

describe('jevMatch：错误处理', () => {
  it('网络失败返回 error 而不是崩溃', async () => {
    vi.useFakeTimers();
    gmMock.alwaysError = new Error('net down');
    const f = field('姓名');
    const p = jevMatch([{ field: f, candidates: [entry('name', '姓名', '张三')] }], config());
    await vi.runAllTimersAsync();
    const out = await p;
    expect(out.error).toBeTruthy();
    expect(out.matches.size).toBe(0);
  });
});

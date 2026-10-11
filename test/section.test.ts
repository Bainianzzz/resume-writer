import { describe, expect, it } from 'vitest';
import { applySectionPrefix } from '../src/dom/section';

describe('applySectionPrefix', () => {
  it('给标签与候选标签统一加区域前缀', () => {
    const got = applySectionPrefix({ label: '描述', labels: ['描述', '工作内容'] }, '实习经历');
    expect(got.label).toBe('实习经历·描述');
    expect(got.labels).toEqual(['实习经历·描述', '实习经历·工作内容']);
  });

  it('无区域时原样返回', () => {
    const field = { label: '姓名', labels: ['姓名'] };
    expect(applySectionPrefix(field, '')).toBe(field);
    expect(applySectionPrefix(field, '   ')).toBe(field);
  });

  it('已带前缀时不重复叠加', () => {
    const got = applySectionPrefix({ label: '实习经历·描述', labels: ['实习经历·描述'] }, '实习经历');
    expect(got.label).toBe('实习经历·描述');
    expect(got.labels).toEqual(['实习经历·描述']);
  });

  it('标签为空数组时按主标签补齐', () => {
    const got = applySectionPrefix({ label: '描述', labels: [] }, '项目经历');
    expect(got.labels).toEqual(['项目经历·描述']);
  });

  it('去掉区域名尾部的冒号', () => {
    const got = applySectionPrefix({ label: '描述', labels: ['描述'] }, 'AI技能运用：');
    expect(got.label).toBe('AI技能运用·描述');
  });

  it('不同区域产出不同字段名，避免同名子字段互相覆盖', () => {
    const a = applySectionPrefix({ label: '描述', labels: ['描述'] }, '实习经历');
    const b = applySectionPrefix({ label: '描述', labels: ['描述'] }, '项目经历');
    expect(a.label).not.toBe(b.label);
  });
});

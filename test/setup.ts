import { beforeEach } from 'vitest';

const rect = {
  width: 100,
  height: 20,
  top: 0,
  left: 0,
  right: 100,
  bottom: 20,
  x: 0,
  y: 0,
  toJSON() {},
} as unknown as DOMRect;

beforeEach(() => {
  // jsdom 无布局，伪造几何信息，让可见性判断通过
  Element.prototype.getBoundingClientRect = () => rect;
  Element.prototype.getClientRects = () =>
    Object.assign([rect], { item: () => rect }) as unknown as DOMRectList;

  if (!(globalThis as any).CSS) (globalThis as any).CSS = {};
  if (!(globalThis as any).CSS.escape) {
    (globalThis as any).CSS.escape = (s: string) =>
      String(s).replace(/[^a-zA-Z0-9_-]/g, (c: string) => '\\' + c);
  }
});

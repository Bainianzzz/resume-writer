/** 表单字段种类 */
export type FieldKind =
  | 'text'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'contenteditable'
  /** 自定义组件（div 型 select 等），值从组件结构读、需模拟交互设置 */
  | 'custom'
  /** 双控件区间（如起止时间），填多个目标 */
  | 'range';

/** 从页面上解析出来的一个待处理字段 */
export interface FieldDescriptor {
  /** 主表单元素（radio 为组内第一个；custom 为组件根节点） */
  el: HTMLElement;
  kind: FieldKind;
  /** 需要写入的多个目标控件（radio 组 / range 的两个 input） */
  targets?: HTMLElement[];
  /** 原始 input type，如 text/date/email，select/textarea/contenteditable 时为空 */
  inputType: string;
  /** 候选标签（用于匹配，按可信度排序） */
  labels: string[];
  /** 最佳标签 */
  label: string;
  name: string;
  id: string;
  placeholder: string;
  /** 当前值（学习阶段用它取填写内容） */
  value: string;
  /** radio/select 的候选项文本 */
  options: string[];
  /** 参考用 CSS 路径 */
  selector: string;
  /** radio 组的稳定 key；其他字段等于 label */
  groupKey: string;
}

/** 字典中的一条学习记录 */
export interface DictEntry {
  /** 稳定主键 = normalize(label) */
  key: string;
  /** 原始标签 */
  label: string;
  /** 学习过程中遇到过的其它等价标签 */
  aliases: string[];
  /** 要填入的值 */
  value: string;
  /** 字段种类提示 */
  kind?: FieldKind;
  /** 候选项（radio/select） */
  options?: string[];
  updatedAt: number;
  /** 来源站点 host */
  origins: string[];
}

export interface Config {
  /** 是否启用 Jev 语义匹配 */
  jevEnabled: boolean;
  /** Jev API Key */
  jevApiKey: string;
  /** Jev 接口地址 */
  jevBaseUrl: string;
  /** Jev 模型 */
  jevModel: string;
  /** 本地模糊匹配阈值 0~1 */
  minScore: number;
  /** 页面加载后是否自动尝试填充 */
  autoFillOnLoad: boolean;
  /** 低于该置信度的 Jev 结果不采用 */
  jevMinConfidence: number;
}

/** 匹配结果 */
export interface MatchResult {
  entry: DictEntry;
  score: number;
  /** 匹配来源 */
  via: 'exact' | 'alias' | 'contains' | 'fuzzy' | 'jev';
}

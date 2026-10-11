/** 文本归一化与相似度工具 */

const PUNCT_RE =
  /[\s*:：·・,，.。;；!！?？/\\|~\-—_=+()（）\[\]【】{}<>《》"'“”‘’、#]/g;

/** 全角转半角 + 小写 + 去标点空白 */
export function normalize(input: string): string {
  if (!input) return '';
  let s = input;
  // 全角 -> 半角
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
  s = s.replace(/\u3000/g, ' ');
  s = s.toLowerCase();
  s = s.replace(PUNCT_RE, '');
  return s.trim();
}

/** 移除常见“必填/选填/请填写”等噪声词 */
export function stripNoise(input: string): string {
  return input
    .replace(/[（(]?(必填|选填|必选|可选|required|optional)[)）]?/gi, '')
    .replace(/^[请填输入写选择]+/, '')
    .replace(/[：:]\s*$/, '')
    .trim();
}

export function charBigrams(s: string): Set<string> {
  const set = new Set<string>();
  if (s.length === 0) return set;
  if (s.length === 1) {
    set.add(s);
    return set;
  }
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

/** 提取用于正则/模糊预筛的关键词：ASCII 单词 + 中文单字与二元组 */
export function tokens(s: string): Set<string> {
  const set = new Set<string>();
  const norm = normalize(s);
  if (!norm) return set;
  for (const word of norm.match(/[a-z0-9]+/g) ?? []) {
    if (word.length >= 2) set.add(word);
  }
  const cjk = norm.replace(/[^\u4e00-\u9fa5]/g, '');
  for (let i = 0; i < cjk.length; i++) set.add(cjk[i]);
  for (let i = 0; i < cjk.length - 1; i++) set.add(cjk.slice(i, i + 2));
  return set;
}

/**
 * 字面证据层级。只做字面判断，不做任何加权打分：
 *   5 完全相等 / 4 同义组 / 3 包含 / 2 二元组交集 / 1 仅单字交集 / 0 无交集
 * 用于在调用 Jev 之前筛出“疑似选项”——0 表示不在字典里，直接放弃该字段。
 */
export function literalEvidence(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 5;
  if (sameSynonymGroup(na, nb)) return 4;
  if (na.length >= 2 && nb.length >= 2 && (na.includes(nb) || nb.includes(na))) return 3;
  const ta = tokens(na);
  const tb = tokens(nb);
  if (ta.size === 0 || tb.size === 0) return 0;
  let bigram = false;
  let single = false;
  for (const t of ta) {
    if (!tb.has(t)) continue;
    if (t.length >= 2) bigram = true;
    else single = true;
  }
  if (bigram) return 2;
  if (single) return 1;
  return 0;
}

/** Dice 系数（字符二元组） */
export function dice(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ba = charBigrams(a);
  const bb = charBigrams(b);
  if (ba.size === 0 || bb.size === 0) return 0;
  let inter = 0;
  for (const g of ba) if (bb.has(g)) inter++;
  return (2 * inter) / (ba.size + bb.size);
}

/** 同义词组（命中同组给加成） */
const SYNONYM_GROUPS: string[][] = [
  ['姓名', '名字', '姓名', '真实姓名', '中文名', 'name', 'fullname', 'username', '用户名'],
  ['性别', 'gender', 'sex'],
  ['出生日期', '生日', '出生年月', 'birthday', 'birth', 'dob'],
  ['年龄', 'age'],
  ['手机', '手机号', '电话', '联系电话', '联系方式', '手机号码', 'phone', 'mobile', 'tel', 'telephone', '手机号码'],
  ['邮箱', '电子邮箱', '电子邮件', '邮件', 'email', 'mail', 'e-mail'],
  ['身份证', '身份证号', '证件号', '身份证号码', 'idcard', 'idnumber', '证件号码'],
  ['学历', '最高学历', 'degree', 'education', '学历层次'],
  ['学校', '毕业院校', '院校', '学校名称', 'school', 'university', 'college', '毕业学校'],
  ['专业', '所学专业', '专业名称', 'major', 'specialty'],
  ['学位', '学位类型', '硕士', '学士'],
  ['毕业时间', '毕业日期', 'graduationdate', 'graduation', '毕业年月'],
  ['入学时间', '入学日期', 'admissiondate', '入学年月'],
  ['工作经历', '工作单位', '公司', '公司名称', '单位', 'company', 'employer', '工作单位名称'],
  ['职位', '岗位', '职务', 'position', 'job', 'title', 'jobtitle'],
  ['籍贯', '户籍', '户口所在地', '户籍所在地', 'hometown', 'nativeplace'],
  ['民族', 'ethnicity', 'nation'],
  ['政治面貌', 'politicalstatus', '政治身份'],
  ['民族', 'ethnic'],
  ['地址', '现居住地', '通讯地址', '联系地址', '居住地址', 'address', '住址'],
  ['邮编', '邮政编码', 'zipcode', 'postcode', 'postalcode'],
  ['身高', 'height'],
  ['体重', 'weight'],
  ['婚姻状况', '婚否', 'marital', 'maritalstatus'],
  ['民族', 'nationality'],
  ['期望职位', '应聘职位', '意向岗位', '目标岗位', 'expectedposition', '应聘岗位'],
  ['期望城市', '期望工作地', '意向城市', 'expectedcity'],
  ['期望薪资', '期望工资', '薪资要求', 'expectedsalary'],
  ['个人简介', '自我介绍', '个人评价', '自我评价', '简介', 'summary', 'introduction', 'aboutme', '个人优势'],
  ['项目经历', '项目经验', 'project', 'projectexperience'],
  ['教育经历', '教育背景', 'education', 'educationexperience'],
  ['实习经历', '实习经验', 'internship'],
  ['语言能力', '外语水平', 'language'],
  ['证书', '资格证书', '执业证书', 'certificate', '证书名称'],
  ['技能', '专业技能', 'skills', 'skill'],
  ['获奖情况', '奖励', '荣誉', 'awards', 'honor'],
];

/**
 * 同义词组索引。同一个词可能出现在多行（如「民族」），按行合并成并查集，
 * 避免后写覆盖导致同组词互不相认。
 */
const GROUP_INDEX = new Map<string, number>();
{
  const parent = SYNONYM_GROUPS.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const owner = new Map<string, number>();
  SYNONYM_GROUPS.forEach((group, idx) => {
    for (const word of group) {
      const key = normalize(word);
      if (!key) continue;
      const prev = owner.get(key);
      if (prev === undefined) owner.set(key, idx);
      else union(prev, idx);
    }
  });
  for (const [key, idx] of owner) GROUP_INDEX.set(key, find(idx));
}

/** 两个文本是否属于同一同义词组 */
export function sameSynonymGroup(a: string, b: string): boolean {
  const ga = GROUP_INDEX.get(a);
  const gb = GROUP_INDEX.get(b);
  return ga !== undefined && ga === gb;
}

/**
 * 综合相似度：同义组优先，其次包含关系，最后 Dice。
 * 返回 0~1。
 */
export function similarity(aRaw: string, bRaw: string): number {
  const a = stripNoise(aRaw);
  const b = stripNoise(bRaw);
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (sameSynonymGroup(na, nb)) return 0.95;
  // 一方包含另一方
  if (na.length >= 2 && nb.length >= 2 && (na.includes(nb) || nb.includes(na))) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return 0.7 + 0.2 * ratio;
  }
  const d = dice(na, nb);
  return d;
}

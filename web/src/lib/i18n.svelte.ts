// UI strings in Chinese and English. Only the interface is translated: issue
// titles, descriptions and comments are shown exactly as written. The API
// returns status keys (e.g. "in_progress") and the UI maps them here.

const zh = {
  projects: '项目',
  active: '进行中',
  search: '搜索',
  settings: '设置',
  back: '返回',
  doneThisWeek: '本周完成',
  inProgress: '进行中',
  inReview: '等待审核',
  workingOn: '正在做',
  newIssue: '新建 issue',
  newProject: '新建项目',
  paused: '已暂停',
  archived: '已归档',
  list: '列表',
  board: '看板',
  showMore: (n: number) => `再显示 ${n} 条`,
  showStatus: (label: string, n: number) => `${label} ${n} 条`,
  hide: '收起',
  parent: '父 issue',
  setParent: '设置父 issue',
  removeParent: '移除父 issue',
  filterIssues: '筛选 issue…',
  copyLink: '复制编号',
  subIssues: '子 issue',
  subCount: (done: number, total: number) => `子任务 ${done}/${total}`,
  add: '添加',
  noneYet: '还没有',
  activity: '动态',
  writeComment: '写评论…',
  send: '发送',
  comment: '评论',
  moreActions: '更多操作',
  cancel: '取消',
  create: '创建',
  save: '保存',
  delete: '删除',
  deleteIssue: '删除 issue',
  deleteConfirm: (id: string) => `确定删除 ${id}？`,
  title: '标题',
  description: '描述',
  descriptionHint: '描述（Markdown，可选）',
  descriptionPlaceholder: '补充细节…',
  addDescription: '添加描述…',
  edit: '编辑',
  willCreateAs: (id: string) => `将创建为 ${id}`,
  status: '状态',
  priority: '优先级',
  labels: '标签',
  labelsHint: '用逗号分隔',
  dueDate: '截止日期',
  due: (d: string) => `截止 ${d}`,
  clear: '清除',
  project: '项目',
  chooseProject: '选择项目',
  noProjects: '还没有项目。先建一个。',
  key: '编号前缀',
  keyHint: '大写字母和数字，例如 BLOG',
  name: '名称',
  githubRepos: 'GitHub 仓库',
  githubReposHint: '每行一个，例如 timothyxlu/blog',
  projectStatus: { active: '进行中', paused: '已暂停', archived: '已归档' } as Record<string, string>,
  editProject: '编辑项目',
  showArchived: '显示已归档',
  searchPlaceholder: '搜索标题、编号、描述',
  noResults: '没有找到',
  nothingActive: '现在没有进行中的 issue',
  language: '语言 · Language',
  followSystem: '跟随系统',
  currentLang: (l: string) => `当前：${l}`,
  langNote: '界面文字、状态名和日期格式会切换；issue 的标题、描述和评论保持原样。',
  appearance: '外观',
  light: '浅色',
  dark: '深色',
  connections: '连接',
  apiTokens: 'API token',
  tokensNote: '给 Claude Code 云端环境等无法用浏览器登录的地方使用。本地 Claude Code 直接用 OAuth 登录即可。',
  tokenName: 'token 名称',
  createToken: '创建 token',
  tokenOnce: '只显示这一次，请现在复制：',
  copy: '复制',
  copied: '已复制',
  revoke: '撤销',
  lastUsed: (d: string) => `上次使用 ${d}`,
  neverUsed: '未使用',
  signedInAs: (e: string) => `已登录：${e}`,
  sessionExpired: '登录已过期',
  signIn: '重新登录',
  offline: '离线，显示的是本地缓存',
  syncFailed: '同步失败',
  retry: '重试',
  loading: '加载中…',
  notFound: '找不到这个 issue',
  saveFailed: '保存失败',
  justNow: '刚刚',
  actors: { me: '我', claude: 'Claude', github: 'GitHub' } as Record<string, string>,
  actions: {
    created: '创建了这个 issue',
    updated: '更新了',
    commented: '评论了',
    linked_github: '关联了',
    imported: '从 Linear 导入了这个 issue',
    deleted: '删除了这个 issue',
  } as Record<string, string>,
  fields: {
    title: '标题',
    description: '描述',
    status: '状态',
    priority: '优先级',
    labels: '标签',
    parent: '父 issue',
    due_date: '截止日期',
    project: '项目',
    sort_order: '排序',
  } as Record<string, string>,
  statuses: {
    backlog: '待规划',
    todo: '待办',
    in_progress: '进行中',
    in_review: '审核中',
    done: '已完成',
    canceled: '已取消',
  } as Record<string, string>,
  priorities: ['无优先级', '紧急', '高', '中', '低'],
  // desktop
  overview: '总览',
  offlineShort: '离线',
  searchOrJump: '搜索 issue、项目或命令…',
  commands: '命令',
  goTo: (s: string) => `前往${s}`,
  issues: 'Issue',
  properties: '属性',
  createdAt: '创建于',
  updatedAt: '更新于',
  shortcuts: '键盘快捷键',
  openCount: (n: number) => `${n} 个未完成`,
  progress: '进度',
  open: '未完成',
  synced: '已同步',
  syncingNow: '同步中…',
  switchTheme: '切换深浅色',
  createMore: '继续创建下一个',
  keyHelp: [
    ['⌘K', '搜索或跳转'],
    ['/', '搜索或跳转'],
    ['C', '新建 issue'],
    ['J / K', '在列表中上下移动'],
    ['Enter', '打开选中的 issue'],
    ['G 然后 H', '前往项目总览'],
    ['G 然后 A', '前往进行中'],
    ['G 然后 S', '前往设置'],
    ['S / P / L / D', '改状态、优先级、标签、截止日期'],
    ['E', '编辑 issue 标题'],
    ['Esc', '从 issue 返回项目'],
    ['⌘Enter', '提交表单或评论'],
    ['?', '显示这些快捷键'],
  ] as [string, string][],
};

type Strings = typeof zh;

const en: Strings = {
  projects: 'Projects',
  active: 'Active',
  search: 'Search',
  settings: 'Settings',
  back: 'Back',
  doneThisWeek: 'Done this week',
  inProgress: 'In progress',
  inReview: 'In review',
  workingOn: 'Working on',
  newIssue: 'New issue',
  newProject: 'New project',
  paused: 'Paused',
  archived: 'Archived',
  list: 'List',
  board: 'Board',
  showMore: (n) => `Show ${n} more`,
  showStatus: (label, n) => `${label} · ${n}`,
  hide: 'Hide',
  parent: 'Parent',
  setParent: 'Set parent',
  removeParent: 'Remove parent',
  filterIssues: 'Filter issues…',
  copyLink: 'Copy ID',
  subIssues: 'Sub-issues',
  subCount: (done, total) => `Sub-issues ${done}/${total}`,
  add: 'Add',
  noneYet: 'None yet',
  activity: 'Activity',
  writeComment: 'Write a comment…',
  send: 'Send',
  comment: 'Comment',
  moreActions: 'More actions',
  cancel: 'Cancel',
  create: 'Create',
  save: 'Save',
  delete: 'Delete',
  deleteIssue: 'Delete issue',
  deleteConfirm: (id) => `Delete ${id}?`,
  title: 'Title',
  description: 'Description',
  descriptionHint: 'Description (Markdown, optional)',
  descriptionPlaceholder: 'Add details…',
  addDescription: 'Add a description…',
  edit: 'Edit',
  willCreateAs: (id) => `Will be created as ${id}`,
  status: 'Status',
  priority: 'Priority',
  labels: 'Labels',
  labelsHint: 'Separate with commas',
  dueDate: 'Due date',
  due: (d) => `Due ${d}`,
  clear: 'Clear',
  project: 'Project',
  chooseProject: 'Choose project',
  noProjects: 'No projects yet. Create one first.',
  key: 'Identifier prefix',
  keyHint: 'Capital letters and digits, e.g. BLOG',
  name: 'Name',
  githubRepos: 'GitHub repos',
  githubReposHint: 'One per line, e.g. timothyxlu/blog',
  projectStatus: { active: 'Active', paused: 'Paused', archived: 'Archived' },
  editProject: 'Edit project',
  showArchived: 'Show archived',
  searchPlaceholder: 'Search titles, IDs, descriptions',
  noResults: 'No results',
  nothingActive: 'Nothing in progress right now',
  language: '语言 · Language',
  followSystem: 'Follow system',
  currentLang: (l) => `Now: ${l}`,
  langNote: 'Interface text, status names and date formats change; issue titles, descriptions and comments stay as written.',
  appearance: 'Appearance',
  light: 'Light',
  dark: 'Dark',
  connections: 'Connections',
  apiTokens: 'API tokens',
  tokensNote: 'For places that cannot sign in with a browser, such as Claude Code cloud environments. Local Claude Code can sign in with OAuth.',
  tokenName: 'Token name',
  createToken: 'Create token',
  tokenOnce: 'Shown only once. Copy it now:',
  copy: 'Copy',
  copied: 'Copied',
  revoke: 'Revoke',
  lastUsed: (d) => `Last used ${d}`,
  neverUsed: 'Never used',
  signedInAs: (e) => `Signed in as ${e}`,
  sessionExpired: 'Your session expired',
  signIn: 'Sign in again',
  offline: 'Offline, showing saved data',
  syncFailed: 'Sync failed',
  retry: 'Retry',
  loading: 'Loading…',
  notFound: 'Issue not found',
  saveFailed: 'Could not save',
  justNow: 'just now',
  actors: { me: 'You', claude: 'Claude', github: 'GitHub' },
  actions: {
    created: 'created this issue',
    updated: 'changed',
    commented: 'commented',
    linked_github: 'linked',
    imported: 'imported this issue from Linear',
    deleted: 'deleted this issue',
  },
  fields: {
    title: 'title',
    description: 'description',
    status: 'status',
    priority: 'priority',
    labels: 'labels',
    parent: 'parent',
    due_date: 'due date',
    project: 'project',
    sort_order: 'order',
  },
  statuses: {
    backlog: 'Backlog',
    todo: 'Todo',
    in_progress: 'In progress',
    in_review: 'In review',
    done: 'Done',
    canceled: 'Canceled',
  },
  priorities: ['No priority', 'Urgent', 'High', 'Medium', 'Low'],
  // desktop
  overview: 'Overview',
  offlineShort: 'Offline',
  searchOrJump: 'Search issues, projects or commands…',
  commands: 'Commands',
  goTo: (s) => `Go to ${s}`,
  issues: 'Issues',
  properties: 'Properties',
  createdAt: 'Created',
  updatedAt: 'Updated',
  shortcuts: 'Keyboard shortcuts',
  openCount: (n) => `${n} open`,
  progress: 'Progress',
  open: 'Open',
  synced: 'Synced',
  syncingNow: 'Syncing…',
  switchTheme: 'Toggle light/dark',
  createMore: 'Create another',
  keyHelp: [
    ['⌘K', 'Search or jump to'],
    ['/', 'Search or jump to'],
    ['C', 'New issue'],
    ['J / K', 'Move through lists'],
    ['Enter', 'Open the selected issue'],
    ['G then H', 'Go to overview'],
    ['G then A', 'Go to active'],
    ['G then S', 'Go to settings'],
    ['S / P / L / D', 'Set status, priority, labels, due date'],
    ['E', 'Edit the issue title'],
    ['Esc', 'From an issue, back to its project'],
    ['⌘Enter', 'Submit a form or comment'],
    ['?', 'Show these shortcuts'],
  ],
};

export type LangPref = 'system' | 'zh' | 'en';

function systemLang(): 'zh' | 'en' {
  const l = (navigator.languages?.[0] ?? navigator.language ?? 'en').toLowerCase();
  return l.startsWith('zh') ? 'zh' : 'en';
}

function readPref(): LangPref {
  try {
    const v = localStorage.getItem('pm.lang');
    if (v === 'zh' || v === 'en') return v;
  } catch {}
  return 'system';
}

class I18n {
  pref = $state<LangPref>(readPref());
  lang = $derived<'zh' | 'en'>(this.pref === 'system' ? systemLang() : this.pref);
  t = $derived<Strings>(this.lang === 'zh' ? zh : en);
  locale = $derived(this.lang === 'zh' ? 'zh-CN' : 'en');
  systemLang = systemLang();

  setPref(p: LangPref) {
    this.pref = p;
    try {
      if (p === 'system') localStorage.removeItem('pm.lang');
      else localStorage.setItem('pm.lang', p);
    } catch {}
  }
}

export const i18n = new I18n();

$effect.root(() => {
  $effect(() => {
    document.documentElement.lang = i18n.locale;
  });
});

/** Date like "11月21日 周六" / "Sat, Nov 21". */
export function fmtLongDate(d: Date) {
  return new Intl.DateTimeFormat(i18n.locale, { month: 'short', day: 'numeric', weekday: 'short' }).format(d);
}

/** A YYYY-MM-DD due date like "11月30日" / "Nov 30". */
export function fmtDay(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();
  return new Intl.DateTimeFormat(i18n.locale, sameYear ? { month: 'short', day: 'numeric' } : { dateStyle: 'medium' }).format(date);
}

/** "3 hours ago" / "3小时前". */
export function fmtAgo(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return i18n.t.justNow;
  const rtf = new Intl.RelativeTimeFormat(i18n.locale, { numeric: 'auto' });
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'medium' }).format(new Date(iso));
}

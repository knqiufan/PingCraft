/**
 * `pingcode capabilities` —— 自描述占位命令。
 *
 * 输出 CLI 计划提供的命令命名空间及其落地阶段。Phase 0 为**硬编码清单**，
 * Phase 1 起改为从命令注册中心动态读取（届时 status 会随实现进度更新为 available）。
 *
 * 输出规范（与总体规划 §4.3 对齐）：
 *  - `--json`：纯 JSON 数组写入 stdout，便于 Agent/管道消费
 *  - TTY：对齐表格（进度走 stdout）
 *  - 非 TTY 管道：默认 JSON（保证 `| jq` 纯净）
 */
import type { Command } from 'commander';

/** 单条能力描述 */
export interface Capability {
  /** 命令命名空间，如 `work-item` */
  command: string;
  /** 一句话说明 */
  description: string;
  /** 落地阶段（Phase 编号） */
  phase: string;
  /** 当前状态 */
  status: 'planned' | 'partial' | 'available';
}

/**
 * 能力清单（硬编码，Phase 1+ 动态化）。
 * 命名空间与总体规划 §2 的阶段交付物对齐。
 */
export const CAPABILITIES: readonly Capability[] = [
  { command: 'capabilities', description: '查看 CLI 能力清单（自描述）', phase: '0', status: 'available' },
  { command: 'auth', description: '认证与凭证管理（login/token/refresh/whoami/logout/status）', phase: '1', status: 'available' },
  { command: 'project', description: '项目管理（list/get/create/update/delete/members）', phase: '1', status: 'available' },
  { command: 'work-item', description: '工作项核心 CRUD（list/get/create/update/delete）', phase: '1', status: 'available' },
  { command: 'work-item-type', description: '工作项类型元数据', phase: '1', status: 'available' },
  { command: 'work-item-state', description: '工作项状态元数据', phase: '1', status: 'available' },
  { command: 'work-item-property', description: '工作项属性元数据', phase: '1', status: 'available' },
  { command: 'work-item-priority', description: '工作项优先级元数据', phase: '1', status: 'available' },
  { command: 'scheme', description: '工作项配置中心（state/property/type/transition）', phase: '2', status: 'available' },
  { command: 'sprint', description: 'Scrum 迭代管理（CRUD + 批量）', phase: '2', status: 'available' },
  { command: 'release', description: '发布/版本管理', phase: '2', status: 'available' },
  { command: 'kanban', description: '看板/栏/泳道管理', phase: '2', status: 'available' },
  { command: 'waterfall', description: '瀑布工作项类型/流转（只读）', phase: '2', status: 'available' },
  { command: 'myself', description: '当前用户信息', phase: '2', status: 'available' },
  { command: 'user', description: '企业成员管理', phase: '2', status: 'available' },
  { command: 'directory', description: '部门/团队/角色/职位/组织', phase: '2', status: 'available' },
  { command: 'common', description: '通用资源（评论/附件/关注/关联/活动/工时/评审/日志）', phase: '2', status: 'available' },
  { command: 'wiki', description: 'Wiki 空间/页面/正文/版本管理', phase: '3', status: 'available' },
  { command: 'mcp', description: 'MCP Server 模式（serve/tools）', phase: '3', status: 'available' },
  { command: 'pingcraft', description: 'PingCraft 业务（analyze/match/import/run）', phase: '3', status: 'available' },
  { command: 'product', description: '产品管理（产品/客户/需求）', phase: '4', status: 'planned' },
  { command: 'ticket', description: '工单管理', phase: '4', status: 'planned' },
  { command: 'testhub', description: '测试管理', phase: '4', status: 'planned' },
  { command: 'scm', description: '源代码管理', phase: '5', status: 'planned' },
  { command: 'build', description: '构建管理', phase: '5', status: 'planned' },
  { command: 'delivery', description: '交付管理', phase: '5', status: 'planned' },
] as const;

/** 将能力列表渲染为对齐的纯文本表格（无外部依赖） */
function renderTable(rows: readonly Capability[]): string {
  const header = ['COMMAND', 'STATUS', 'PHASE', 'DESCRIPTION'];
  const data = rows.map((r) => [r.command, r.status, `Phase ${r.phase}`, r.description]);
  const all = [header, ...data];
  const widths = header.map((_, i) => Math.max(...all.map((row) => row[i].length)));
  const pad = (row: string[]): string =>
    row.map((cell, i) => cell.padEnd(widths[i])).join('  ').trimEnd();
  return [pad(header), pad(widths.map((w) => '-'.repeat(w))), ...data.map(pad)].join('\n');
}

interface CapabilitiesOptions {
  json?: boolean;
}

/** 注册 capabilities 命令到给定 program */
export function registerCapabilities(program: Command): void {
  program
    .command('capabilities')
    .description('列出 CLI 能力清单（命令命名空间与落地阶段）')
    .option('--json', '以 JSON 输出（管道/脚本友好）')
    .action((opts: CapabilitiesOptions) => {
      const useJson = opts.json || !process.stdout.isTTY;
      if (useJson) {
        process.stdout.write(`${JSON.stringify(CAPABILITIES, null, 2)}\n`);
        return;
      }
      process.stdout.write(`${renderTable(CAPABILITIES)}\n`);
    });
}

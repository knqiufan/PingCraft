/**
 * MCP tool 定义集合 —— 按模块组织，注册到 tool-registry。
 *
 * 每个 tool 的 handler 只编排 sdk 调用（经 ctx.bundle），不重复业务逻辑。
 * 核心 tool 始终注册；可选 tool（写操作）经 --include 启用。
 */
import { z } from 'zod';
import { registerTool } from '../tool-registry.js';

/** 注册全部 tool（幂等：先清空再注册） */
export function registerAllTools(): void {
  registerProjectTools();
  registerWorkItemTools();
  registerSprintTools();
  registerMetaTools();
  registerWikiTools();
  registerMyselfTool();
}

function registerProjectTools(): void {
  registerTool({
    name: 'project__list',
    description: '列出当前用户可访问的项目',
    inputSchema: z.object({
      search: z.string().optional().describe('按名称搜索'),
      page_size: z.number().optional().describe('每页条数（默认 30）'),
    }),
    tier: 'core',
    async handler(args, { bundle }) {
      const { values } = await bundle.projects.list({ search: args.search as string | undefined, pageSize: args.page_size as number | undefined });
      return values;
    },
  });
  registerTool({
    name: 'project__get',
    description: '获取项目详情',
    inputSchema: z.object({ id: z.string().describe('项目 ID') }),
    tier: 'core',
    async handler(args, { bundle }) {
      return bundle.projects.get(args.id as string);
    },
  });
  registerTool({
    name: 'project__create',
    description: '创建项目',
    inputSchema: z.object({
      name: z.string().describe('项目名称'),
      type: z.string().optional().describe('项目类型，如 scrum/kanban'),
      identifier: z.string().optional().describe('项目标识'),
    }),
    tier: 'optional',
    dangerous: true,
    async handler(args, { bundle }) {
      return bundle.projects.create({
        name: args.name as string,
        ...(args.type ? { type: args.type as string } : {}),
        ...(args.identifier ? { identifier: args.identifier as string } : {}),
      });
    },
  });
}

function registerWorkItemTools(): void {
  registerTool({
    name: 'work-item__list',
    description: '列出工作项（按项目）',
    inputSchema: z.object({
      project_id: z.string().describe('项目 ID'),
      type_id: z.string().optional().describe('按工作项类型过滤'),
      state_id: z.string().optional().describe('按状态过滤'),
      assignee_id: z.string().optional().describe('按负责人过滤'),
      all: z.boolean().optional().describe('拉取全部（自动分页）'),
      page_size: z.number().optional(),
    }),
    tier: 'core',
    async handler(args, { bundle }) {
      const filter = {
        projectId: args.project_id as string,
        ...(args.type_id ? { typeId: args.type_id as string } : {}),
        ...(args.state_id ? { stateId: args.state_id as string } : {}),
        ...(args.assignee_id ? { assigneeId: args.assignee_id as string } : {}),
      };
      if (args.all) {
        const res = await bundle.workItems.listAll({ ...filter, pageSize: (args.page_size as number) ?? 100 });
        return res.values;
      }
      const { values } = await bundle.workItems.list({ ...filter, pageSize: (args.page_size as number) ?? 100 });
      return values;
    },
  });
  registerTool({
    name: 'work-item__get',
    description: '获取工作项详情',
    inputSchema: z.object({ id: z.string().describe('工作项 ID') }),
    tier: 'core',
    async handler(args, { bundle }) {
      return bundle.workItems.get(args.id as string);
    },
  });
  registerTool({
    name: 'work-item__create',
    description: '创建工作项',
    inputSchema: z.object({
      project_id: z.string().describe('项目 ID'),
      type_id: z.string().describe('工作项类型 ID'),
      title: z.string().describe('标题'),
      description: z.string().optional(),
      priority_id: z.string().optional(),
      assignee_id: z.string().optional(),
      sprint_id: z.string().optional(),
    }),
    tier: 'core',
    dangerous: true,
    async handler(args, { bundle }) {
      return bundle.workItems.create({
        project_id: args.project_id as string,
        type_id: args.type_id as string,
        title: args.title as string,
        ...(args.description ? { description: args.description as string } : {}),
        ...(args.priority_id ? { priority_id: args.priority_id as string } : {}),
        ...(args.assignee_id ? { assignee_id: args.assignee_id as string } : {}),
        ...(args.sprint_id ? { sprint_id: args.sprint_id as string } : {}),
      });
    },
  });
  registerTool({
    name: 'work-item__update',
    description: '更新工作项',
    inputSchema: z.object({
      id: z.string().describe('工作项 ID'),
      title: z.string().optional(),
      description: z.string().optional(),
      priority_id: z.string().optional(),
      assignee_id: z.string().optional(),
    }),
    tier: 'core',
    dangerous: true,
    async handler(args, { bundle }) {
      const body: Record<string, unknown> = {};
      for (const k of ['title', 'description', 'priority_id', 'assignee_id']) {
        if (args[k] !== undefined) body[k] = args[k];
      }
      return bundle.workItems.update(args.id as string, body as never);
    },
  });
}

function registerSprintTools(): void {
  registerTool({
    name: 'sprint__list',
    description: '列出迭代',
    inputSchema: z.object({ project_id: z.string().describe('项目 ID') }),
    tier: 'core',
    async handler(args, { bundle }) {
      const { values } = await bundle.sprints.list({ projectId: args.project_id as string });
      return values;
    },
  });
  registerTool({
    name: 'sprint__create',
    description: '创建迭代',
    inputSchema: z.object({
      project_id: z.string().describe('项目 ID'),
      name: z.string().describe('迭代名称'),
      goal: z.string().optional(),
    }),
    tier: 'optional',
    dangerous: true,
    async handler(args, { bundle }) {
      return bundle.sprints.create({ project_id: args.project_id as string, name: args.name as string, ...(args.goal ? { goal: args.goal as string } : {}) });
    },
  });
}

function registerMetaTools(): void {
  registerTool({
    name: 'work-item-type__list',
    description: '列出工作项类型',
    inputSchema: z.object({ project_id: z.string().describe('项目 ID') }),
    tier: 'core',
    async handler(args, { bundle }) {
      const { values } = await bundle.workItemMeta.types(args.project_id as string);
      return values;
    },
  });
  registerTool({
    name: 'work-item-state__list',
    description: '列出工作项状态',
    inputSchema: z.object({ project_id: z.string(), work_item_type_id: z.string() }),
    tier: 'core',
    async handler(args, { bundle }) {
      const { values } = await bundle.workItemMeta.states(args.project_id as string, args.work_item_type_id as string);
      return values;
    },
  });
  registerTool({
    name: 'work-item-priority__list',
    description: '列出工作项优先级',
    inputSchema: z.object({ project_id: z.string() }),
    tier: 'core',
    async handler(args, { bundle }) {
      const { values } = await bundle.workItemMeta.priorities(args.project_id as string);
      return values;
    },
  });
}

function registerWikiTools(): void {
  registerTool({
    name: 'wiki__space-list',
    description: '列出 Wiki 空间',
    inputSchema: z.object({}),
    tier: 'core',
    async handler(_args, { bundle }) {
      const { values } = await bundle.wiki.spaces.list();
      return values;
    },
  });
  registerTool({
    name: 'wiki__page-list',
    description: '列出 Wiki 页面',
    inputSchema: z.object({ space_id: z.string().describe('空间 ID') }),
    tier: 'core',
    async handler(args, { bundle }) {
      const { values } = await bundle.wiki.pages.list({ spaceId: args.space_id as string });
      return values;
    },
  });
  registerTool({
    name: 'wiki__page-get',
    description: '获取 Wiki 页面详情',
    inputSchema: z.object({ id: z.string() }),
    tier: 'core',
    async handler(args, { bundle }) {
      return bundle.wiki.pages.get(args.id as string);
    },
  });
}

function registerMyselfTool(): void {
  registerTool({
    name: 'myself__get',
    description: '获取当前登录用户信息',
    inputSchema: z.object({}),
    tier: 'core',
    async handler(_args, { bundle }) {
      return bundle.auth.getMyself();
    },
  });
}

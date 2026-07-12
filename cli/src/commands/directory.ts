/**
 * 全局个人/组织命令（L3）—— 集中注册多个顶层命令。
 *
 * myself / user / department / team / role / position / organization。
 */
import type { Command } from 'commander';
import { buildClient, buildOutputContext, getConnectionOptions, runHandler, type OutputOptions } from './shared.js';
import { emitList, emitSingle } from '../core/output.js';

export function registerDirectoryCommands(program: Command): void {
  // ---- myself ----
  program
    .command('myself')
    .description('当前登录用户信息')
    .option('--json', 'JSON 输出')
    .option('--fields <list>', '字段裁剪')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const { directory } = buildClient(getConnectionOptions(program));
        emitSingle(await directory.getMyself(), buildOutputContext(opts));
      }),
    );

  // ---- user ----
  const user = program.command('user').description('企业成员');
  user
    .command('list')
    .option('--page <n>', '页码')
    .option('--page-size <n>', '每页条数')
    .option('--json', 'JSON 输出')
    .option('--quiet', '仅输出 id')
    .action((opts: OutputOptions & { page?: string; pageSize?: string }) =>
      runHandler(async () => {
        const { directory } = buildClient(getConnectionOptions(user));
        const { values } = await directory.listUsers({ pageIndex: Number(opts.page || 0), pageSize: Number(opts.pageSize || 30) });
        emitList(values, buildOutputContext(opts));
      }),
    );
  user.command('get').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { directory } = buildClient(getConnectionOptions(user));
      emitSingle(await directory.getUser(id), buildOutputContext(opts));
    }),
  );
  user
    .command('create')
    .requiredOption('--name <name>', '姓名')
    .requiredOption('--email <email>', '邮箱')
    .option('--dry-run', '仅打印请求体')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { name: string; email: string; dryRun?: boolean }) =>
      runHandler(async () => {
        const body = { name: opts.name, email: opts.email };
        if (opts.dryRun) {
          emitSingle(body, buildOutputContext(opts));
          return;
        }
        const { directory } = buildClient(getConnectionOptions(user));
        emitSingle(await directory.createUser(body), buildOutputContext(opts));
      }),
    );
  user.command('update').argument('<id>').option('--name <name>').option('--email <email>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions & { name?: string; email?: string }) =>
    runHandler(async () => {
      const body: Record<string, unknown> = {};
      if (opts.name !== undefined) body.name = opts.name;
      if (opts.email !== undefined) body.email = opts.email;
      const { directory } = buildClient(getConnectionOptions(user));
      emitSingle(await directory.updateUser(id, body), buildOutputContext(opts));
    }),
  );

  // ---- 简单只读：department / team / role / position / organization ----
  const simpleList = (name: string, desc: string, fn: (b: ReturnType<typeof buildClient>) => Promise<{ values: unknown[] }>) => {
    const cmd = program.command(name).description(desc);
    cmd
      .command('list')
      .option('--json', 'JSON 输出')
      .option('--quiet', '仅输出 id')
      .action((opts: OutputOptions) =>
        runHandler(async () => {
          const bundle = buildClient(getConnectionOptions(cmd));
          const { values } = await fn(bundle);
          emitList(values, buildOutputContext(opts));
        }),
      );
  };

  simpleList('role', '角色', async (b) => b.directory.listRoles());
  simpleList('position', '职位', async (b) => b.directory.listPositions());

  // department 有详情接口，单独提供 get
  const department = program.command('department').description('部门');
  department
    .command('list')
    .option('--json', 'JSON 输出')
    .option('--quiet', '仅输出 id')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const { directory } = buildClient(getConnectionOptions(department));
        const { values } = await directory.listDepartments();
        emitList(values, buildOutputContext(opts));
      }),
    );
  department.command('get').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { directory } = buildClient(getConnectionOptions(department));
      emitSingle(await directory.getDepartment(id), buildOutputContext(opts));
    }),
  );

  // team（含成员）
  const team = program.command('team').description('团队');
  team
    .command('list')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const { directory } = buildClient(getConnectionOptions(team));
        const { values } = await directory.listTeams();
        emitList(values, buildOutputContext(opts));
      }),
    );
  const teamMember = team.command('member').description('团队成员');
  teamMember
    .command('list')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { directory } = buildClient(getConnectionOptions(team));
        const { values } = await directory.listTeamMembers(id);
        emitList(values, buildOutputContext(opts));
      }),
    );
  teamMember
    .command('add')
    .argument('<id>')
    .requiredOption('--user-id <id>', '用户 ID')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { userId: string }) =>
      runHandler(async () => {
        const { directory } = buildClient(getConnectionOptions(team));
        emitSingle(await directory.addTeamMember(id, opts.userId), buildOutputContext(opts));
      }),
    );
  teamMember
    .command('remove')
    .argument('<id>')
    .argument('<userId>')
    .option('--json', 'JSON 输出')
    .action((id: string, userId: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { directory } = buildClient(getConnectionOptions(team));
        await directory.removeTeamMember(id, userId);
        emitSingle({ userId, removed: true }, buildOutputContext(opts));
      }),
    );

  // organization
  program
    .command('organization')
    .description('企业信息')
    .command('info')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const { directory } = buildClient(getConnectionOptions(program));
        emitSingle(await directory.getOrganization(), buildOutputContext(opts));
      }),
    );
}

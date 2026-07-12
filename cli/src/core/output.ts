/**
 * 输出格式化（L1 core）。
 *
 * 规范（阶段 1 §5）：
 *  - 进度/警告一律走 stderr；stdout 只放最终结果（保证 `| jq` 纯净）。
 *  - TTY 默认表格（带颜色），非 TTY / --json 默认 JSON 包络 `{success,data,pagination?}`。
 *  - --quiet 仅输出 id 列（每行一个）。
 *  - --fields 列裁剪（字段选择，顺序敏感）。
 *
 * 依赖：cli-table3（表格）、chalk（颜色，仅 TTY）、csv-stringify（CSV）、yaml（YAML）。
 */
import Table from 'cli-table3';
import chalk from 'chalk';
import { stringify as csvStringify } from 'csv-stringify/sync';
import { stringify as yamlStringify } from 'yaml';

export type OutputFormat = 'json' | 'table' | 'csv' | 'yaml';

/** 分页元信息（仅 --json list 包络中使用） */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

/** 命令输出的上下文选项（来自全局参数） */
export interface OutputContext {
  /** 强制 JSON（--json） */
  json?: boolean;
  /** 强制格式（--format，优先于 json/tty 推断） */
  format?: OutputFormat;
  /** 列裁剪字段 */
  fields?: string[];
  /** 静默：仅输出 id 列 */
  quiet?: boolean;
  /** TTY 探测结果（默认读 process.stdout.isTTY） */
  tty?: boolean;
}

/** 当前进程是否 TTY（便于注入测试） */
export function detectTty(stream: { isTTY?: boolean } = process.stdout): boolean {
  return Boolean(stream.isTTY);
}

type Row = Record<string, unknown>;

/** 按字段选择并排序键；未指定字段时返回原对象的可枚举键值拷贝 */
export function selectFields<T extends Row>(obj: T, fields?: string[]): Row {
  if (!fields || fields.length === 0) {
    return { ...obj };
  }
  const out: Row = {};
  for (const f of fields) {
    if (f in obj) out[f] = obj[f];
  }
  return out;
}

/** 将任意值扁平化为单行字符串（用于表格单元格 / CSV） */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** 解析最终输出格式（ctx.tty 应为已解析的布尔值） */
function resolveFormat(ctx: OutputContext): OutputFormat {
  if (ctx.format) return ctx.format;
  if (ctx.json) return 'json';
  return ctx.tty ? 'table' : 'json';
}

/** 表头：--fields 指定，否则取首个对象的键 */
function inferColumns(rows: Row[], fields?: string[]): string[] {
  if (fields && fields.length > 0) return fields;
  const keys = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) keys.add(k);
  }
  return [...keys];
}

function renderTable(rows: Row[], ctx: OutputContext, tty: boolean): string {
  const columns = inferColumns(rows, ctx.fields);
  const head = tty ? columns.map((c) => chalk.bold(c)) : columns;
  const table = new Table({ head, style: { head: [], border: tty ? [] : [] } });
  for (const r of rows) {
    const selected = selectFields(r, ctx.fields);
    table.push(columns.map((c) => cell(selected[c])));
  }
  return table.toString();
}

function renderCsv(rows: Row[], ctx: OutputContext): string {
  const columns = inferColumns(rows, ctx.fields);
  const data = rows.map((r) => {
    const selected = selectFields(r, ctx.fields);
    return columns.map((c) => cell(selected[c]));
  });
  return csvStringify(data, { header: true, columns });
}

function renderYaml(rows: Row[], ctx: OutputContext): string {
  const selected = rows.map((r) => selectFields(r, ctx.fields));
  return yamlStringify(selected).trimEnd();
}

/** 进度信息（stderr） */
export function logProgress(message: string, stream: NodeJS.WritableStream = process.stderr): void {
  stream.write(`${message}\n`);
}

/** 警告信息（stderr，与数据流分离） */
export function logWarn(message: string, stream: NodeJS.WritableStream = process.stderr): void {
  stream.write(`${chalk.yellow('warn')} ${message}\n`);
}

export interface EmitListOptions extends OutputContext {
  /** 输出流（默认 process.stdout） */
  stream?: NodeJS.WritableStream;
}

/**
 * 输出列表结果。
 *  - quiet：每行一个 id（若无 id 字段则回退 JSON）
 *  - json：`{success:true, data:[...], pagination?}`
 *  - table/csv/yaml：相应格式（含 --fields 裁剪）
 *
 * @param rows 数据行
 * @param opts 输出上下文（--json/--fields/--quiet/stream）
 * @param pagination 仅 --json 包络使用
 */
export function emitList(rows: unknown[], opts: EmitListOptions = {}, pagination?: PaginationMeta): void {
  const stream = opts.stream ?? process.stdout;
  const tty = opts.tty ?? detectTty();
  const recordRows = rows as Row[];

  // --quiet：仅 id
  if (opts.quiet) {
    const ids = recordRows.map((r) => r.id).filter((v) => v !== undefined && v !== null);
    if (ids.length > 0) {
      stream.write(`${ids.map((v) => String(v)).join('\n')}\n`);
      return;
    }
    // 无 id 字段时回退 JSON，避免静默丢数据
  }

  const format = resolveFormat({ ...opts, tty });
  const selected = recordRows.map((r) => selectFields(r, opts.fields));

  switch (format) {
    case 'json': {
      const envelope: Record<string, unknown> = { success: true, data: selected };
      if (pagination) envelope.pagination = pagination;
      stream.write(`${JSON.stringify(envelope)}\n`);
      return;
    }
    case 'csv':
      stream.write(`${renderCsv(recordRows, opts)}\n`);
      return;
    case 'yaml':
      stream.write(`${renderYaml(recordRows, opts)}\n`);
      return;
    case 'table':
    default:
      stream.write(`${renderTable(recordRows, opts, tty)}\n`);
      return;
  }
}

export interface EmitSingleOptions extends OutputContext {
  stream?: NodeJS.WritableStream;
}

/** 输出单个资源：json 包络或 key-value 表格 */
export function emitSingle(obj: unknown, opts: EmitSingleOptions = {}): void {
  const stream = opts.stream ?? process.stdout;
  const tty = opts.tty ?? detectTty();
  const record = obj as Row;
  const selected = selectFields(record, opts.fields);
  const format = resolveFormat({ ...opts, tty });

  if (format === 'json') {
    stream.write(`${JSON.stringify({ success: true, data: selected })}\n`);
    return;
  }

  if (format === 'yaml') {
    stream.write(`${yamlStringify(selected).trimEnd()}\n`);
    return;
  }

  // table / csv 均以 key-value 两列表格呈现单个对象
  const entries = Object.entries(selected);
  if (format === 'csv') {
    stream.write(`${csvStringify(entries.map(([k, v]) => [k, cell(v)]), { header: true, columns: ['field', 'value'] })}\n`);
    return;
  }
  const head = tty ? [chalk.bold('field'), chalk.bold('value')] : ['field', 'value'];
  const table = new Table({ head, style: { head: [], border: [] } });
  for (const [k, v] of entries) table.push([k, cell(v)]);
  stream.write(`${table.toString()}\n`);
}

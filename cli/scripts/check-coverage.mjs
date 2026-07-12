#!/usr/bin/env node
/**
 * API 覆盖率检查脚本（阶段 5）。
 *
 * 解析 cli/docs/api-coverage.csv，按 status 统计：
 *   done / (done + planned) ≥ 阈值（默认 80%）则通过，否则退出 1。
 * skipped 不计入分母（明确不做的部分）。
 *
 * 用法：node cli/scripts/check-coverage.mjs [--threshold 80] [--csv path]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const args = { threshold: 80, csv: path.resolve(__dirname, '../docs/api-coverage.csv') };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--threshold') args.threshold = Number(process.argv[++i]);
    else if (a === '--csv') args.csv = process.argv[++i];
  }
  return args;
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('module,'));
  const STATUSES = new Set(['done', 'planned', 'skipped']);
  return lines.map((line) => {
    const cols = line.split(',');
    // 行内列数不固定（部分行列合并），故扫描已知 status 值
    const statusCol = cols.find((c) => STATUSES.has(c.trim()));
    return { module: cols[0].trim(), status: (statusCol || 'planned').trim() };
  });
}

function main() {
  const { threshold, csv } = parseArgs();
  if (!fs.existsSync(csv)) {
    console.error(`coverage csv 不存在：${csv}`);
    process.exit(2);
  }
  const rows = parseCsv(fs.readFileSync(csv, 'utf-8'));
  const byStatus = { done: 0, planned: 0, skipped: 0 };
  const byModule = new Map();
  for (const r of rows) {
    const st = r.status || 'planned';
    byStatus[st] = (byStatus[st] || 0) + 1;
    const m = r.module || '(unknown)';
    if (!byModule.has(m)) byModule.set(m, { done: 0, planned: 0 });
    byModule.get(m)[st] = (byModule.get(m)[st] || 0) + 1;
  }
  const denom = byStatus.done + byStatus.planned;
  const pct = denom > 0 ? (byStatus.done / denom) * 100 : 0;

  console.log('API 覆盖率报告（done / (done + planned)）');
  console.log(`  done=${byStatus.done}  planned=${byStatus.planned}  skipped=${byStatus.skipped}（不计入分母）`);
  console.log(`  覆盖率 = ${pct.toFixed(1)}%  （阈值 ${threshold}%）\n`);
  console.log('按模块：');
  const sortedModules = [...byModule.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [mod, c] of sortedModules) {
    const d = c.done;
    const p = c.planned;
    const mPct = d + p > 0 ? ((d / (d + p)) * 100).toFixed(0) : 'n/a';
    console.log(`  ${mod.padEnd(16)} done=${d} planned=${p} (${mPct}%)`);
  }

  if (pct >= threshold) {
    console.log(`\n✅ 通过：${pct.toFixed(1)}% ≥ ${threshold}%`);
    process.exit(0);
  }
  console.error(`\n❌ 未达标：${pct.toFixed(1)}% < ${threshold}%`);
  process.exit(1);
}

main();

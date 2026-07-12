#!/usr/bin/env node
/**
 * PingCraft CLI 入口垫片。
 *
 * 生产/构建产物：转发到 dist/main.js（进程入口，调用 run() 后退出）。
 * 开发期请使用 `pnpm -F cli dev`（tsx 直跑 src/main.ts），无需经过本文件。
 */
import('../dist/main.js').catch((err) => {
  // dist/ 尚未构建时给出友好提示。
  if (err && (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND')) {
    process.stderr.write(
      '[pingcode] 未找到构建产物 dist/main.js。请先执行 `pnpm -F cli build`，或开发期使用 `pnpm -F cli dev`。\n',
    );
  } else {
    process.stderr.write(`[pingcode] 启动失败：${err?.stack ?? err}\n`);
  }
  process.exit(1);
});

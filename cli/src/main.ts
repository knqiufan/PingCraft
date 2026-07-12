/**
 * PingCraft CLI 启动入口（副作用模块）。
 *
 * 仅在作为进程入口时使用：`tsx src/main.ts`（dev）/ `node dist/main.js`（start）/
 * `bin/pingcode.js` 转调。**测试与库模式不应 import 本模块**——它们直接使用
 * `index.ts` 导出的 `createProgram` / `run`。
 *
 * 把副作用集中在此，是为了让 `index.ts` 保持纯净、不触发 `import.meta` 相关的
 * 构建工具转换问题。
 */
import { run } from './index.js';

void run().then((code) => {
  process.exit(code);
});

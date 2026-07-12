# @pingcraft/cli

> Agent-first CLI for PingCode + PingCraft。

PingCraft CLI 是面向 [PingCode](https://pingcode.com) 项目管理平台与 PingCraft 需求分析后端的命令行工具，同时可作为 **MCP Server** 接入 AI Agent，也可作为 **库** 在 Node.js 项目中直接调用 SDK。

> 🚧 当前处于 **Phase 0（基础设施与脚手架）**：仅 `--version` / `--help` / `capabilities` 可用，业务命令将在后续阶段逐步落地。完整计划见仓库根 `docs/cli/`。

## 快速开始

```bash
# 在仓库根一次安装全部 workspace 包（backend / frontend / cli）
pnpm install

# 开发期直跑源码（tsx），无需 build。
# 注意：pnpm v10 下 `pnpm -F cli dev -- <flags>` 会把 `--` 字面透传给 tsx，
#       导致 Commander 把 `--version` 等当成未知命令。开发期请用 exec tsx 形式：
pnpm -F cli exec tsx src/main.ts --version
pnpm -F cli exec tsx src/main.ts --help
pnpm -F cli exec tsx src/main.ts capabilities

# 构建（产物在 dist/，可被 bin 垫片加载）
pnpm -F cli build
node dist/main.js --version          # 验证构建产物

# 测试 / 类型检查
pnpm -F cli test
pnpm -F cli typecheck
```

## 三种运行模式

| 模式 | 触发方式 | 引入阶段 |
|------|----------|----------|
| CLI 模式 | `pingcode <cmd>` | Phase 1 |
| 库模式 | `import { ... } from '@pingcraft/cli/sdk'` | Phase 1（Phase 3 抽为独立包） |
| MCP 模式 | `pingcode mcp serve` | Phase 3 |

## 架构（三层）

```
cli/src/
├── commands/   L3 命令定义（Commander）—— 薄层，只做参数解析与输出编排
├── sdk/        L2 PingCode API SDK —— 纯函数/类，无 IO 依赖（除 HTTP）
├── core/       L1 核心运行时 —— config / auth / output / errors / pagination
└── mcp/        MCP Server 模式（Phase 3）
```

层级纪律：`commands/` 只调用 `sdk/` 与 `core/`；`sdk/` 不引用 `core/`；`core/` 不依赖 `sdk/`。

## 更多文档

- 总体规划与阶段拆解：`../docs/cli/00-总体开发规划.md`
- 各阶段实施方案：`../docs/cli/01-阶段0` ~ `06-阶段5`
- 上游蓝图：`../docs/CLI开发计划.md`

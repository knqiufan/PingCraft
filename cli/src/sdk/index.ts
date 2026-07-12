/**
 * PingCode API SDK 聚合导出（L2）。
 *
 * Phase 0 仅占位。Phase 1 起填充：
 *  - `client.ts`：HTTP client（拦截器/重试/限流/分页/令牌刷新）
 *  - `modules/`：按官方模块对齐的资源类（project / work-item / auth / ...）
 *
 * 设计约束（见总体规划 §4.1）：sdk/ 不引用 core/ 的输出/错误格式，
 * 保持可独立测试、可在 Phase 3 抽为独立包发布为库。
 */

/** SDK 版本（与 CLI 同源，Phase 3 抽包后单独维护） */
export const SDK_VERSION = '0.0.0-placeholder';

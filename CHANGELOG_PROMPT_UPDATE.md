# Prompt 优化与输出结果适配更新日志

## 更新时间
2026-02-10

## 更新概述
根据优化后的需求分析 Prompt，调整了后端输出处理和前端展示逻辑，以支持多项目识别、智能工时评估和计划时间等新特性。

---

## 一、Prompt 优化内容

### 新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `project_name` | string | 工作项所属项目名称，支持多项目识别 |
| `start_at` | string | 计划开始时间（ISO 8601 格式） |
| `estimated_hours` | number | 预估工时（小时），由模型根据复杂度智能评估 |

### 增强内容

1. **项目识别能力**
   - 从需求文档中自动识别项目名称
   - 支持多项目混合需求的准确区分
   - 未明确项目时自动推断合理名称

2. **工时评估标准**
   - 简单任务：1-4 小时
   - 中等任务：8-16 小时
   - 复杂任务：24-40 小时
   - 大型任务：40+ 小时

3. **详细的输出规范**
   - 完整的字段说明和取值范围
   - 优先级判断依据
   - 需求拆分和分析要点
   - 典型输出示例

---

## 二、后端调整

### 1. `agent.js` - 输出处理增强

**位置**: `backend/src/services/agent.js`

**改动**:
```javascript
// 添加 current_time 注入
const currentTime = new Date().toISOString();

// 增强返回值处理，确保字段完整性
return workItems.map((item) => ({
  project_name: item.project_name || '未分类项目',
  title: item.title || '未命名工作项',
  description: item.description || '',
  priority: ['High', 'Medium', 'Low'].includes(item.priority) ? item.priority : 'Medium',
  estimated_hours: typeof item.estimated_hours === 'number' ? item.estimated_hours : 8,
  start_at: item.start_at || currentTime,
}));
```

### 2. `workItems.js` - 项目匹配逻辑优化

**位置**: `backend/src/routes/workItems.js`

**改动**:

#### `/match-project` 接口
- 提取所有唯一的 `project_name`
- 为每个项目名称匹配最相似的 PingCode 项目
- 返回匹配结果和识别到的项目名称列表

```javascript
const uniqueProjectNames = [...new Set(requirements.map(r => r.project_name))];

// 为每个项目名称匹配
for (const projectName of uniqueProjectNames) {
  const results = await projectColl.query({
    queryTexts: [projectName],
    nResults: 3,
  });
  // ...
}

res.json(success({ 
  matches, 
  projectNames: uniqueProjectNames 
}, '项目匹配完成'));
```

#### `/import` 接口
- 添加 `start_at` 字段传递给 PingCode

---

## 三、前端调整

### 1. 类型定义更新

**位置**: `frontend/src/api/types.ts`

**改动**:
```typescript
export interface WorkItem {
  id?: string
  project_name: string        // 新增：项目名称
  title: string
  description?: string
  priority: string
  estimated_hours: number      // 改为必填
  start_at: string            // 新增：开始时间
  status?: string
  match?: { id: string; title: string } | null
}

export interface Project {
  id: string
  name: string
  score?: number
  suggestedName?: string      // 新增：建议的项目名称
}

export interface MatchProjectData {
  matches: Project[]
  projectNames?: string[]     // 新增：识别到的项目名称列表
}
```

### 2. 工作项表格增强

**位置**: `frontend/src/components/workItems/WorkItemTable.vue`

**新增功能**:

1. **新增列**
   - 项目列：显示 `project_name`，使用 Tag 样式
   - 开始时间列：格式化显示为 `MM-DD`

2. **双视图模式**
   - 列表视图：传统表格展示
   - 项目分组：按 `project_name` 分组展示

3. **视图切换**
   - 顶部添加视图切换按钮
   - 分组视图中每个项目独立显示

**关键代码**:
```vue
<el-button-group size="small" class="view-toggle">
  <el-button :type="groupByProject ? '' : 'primary'" @click="groupByProject = false">
    列表视图
  </el-button>
  <el-button :type="groupByProject ? 'primary' : ''" @click="groupByProject = true">
    项目分组
  </el-button>
</el-button-group>
```

### 3. 项目选择器增强

**位置**: `frontend/src/components/workItems/ProjectSelector.vue`

**新增功能**:

1. **项目摘要显示**
   - 显示识别到的所有项目名称
   - 使用 Tag 展示，方便查看

2. **布局优化**
   - 选择器和提示信息横向排列
   - 项目摘要单独一行显示

**效果**:
```
[选择框] ✓ 已自动匹配最佳项目
识别到的项目：[用户中心] [商品管理系统] [订单系统]
```

### 4. Store 逻辑更新

**位置**: `frontend/src/stores/app.ts`

**改动**:
- 处理新的匹配响应格式
- 识别到项目但未匹配时给出提示

```typescript
const matches = res.data?.matches || []
const projectNames = res.data?.projectNames || []

if (matches.length) {
  // 匹配成功
} else if (projectNames.length > 0) {
  // 识别到项目但未匹配
  ElMessage.warning(`识别到 ${projectNames.length} 个项目，但未找到匹配的 PingCode 项目`)
}
```

---

## 四、UI 展示效果

### 列表视图

| 项目 | 标题 | 描述 | 优先级 | 预估工时 | 开始时间 | 匹配状态 | 操作 |
|------|------|------|--------|----------|----------|----------|------|
| 用户中心 | 实现用户注册功能 | 支持邮箱和手机号... | 高 | 16h | 02-10 | 新需求 | 删除 |
| 用户中心 | 开发用户登录模块 | 支持邮箱/手机号... | 高 | 20h | 02-10 | 新需求 | 删除 |
| 商品管理 | 商品列表页优化 | 优化查询性能... | 中 | 12h | 02-10 | 新需求 | 删除 |

### 项目分组视图

```
用户中心 (2 个工作项)
┌──────────────────────────────────────────┐
│ 实现用户注册功能  │ 高 │ 16h │ 02-10 │ 新需求 │
│ 开发用户登录模块  │ 高 │ 20h │ 02-10 │ 新需求 │
└──────────────────────────────────────────┘

商品管理系统 (1 个工作项)
┌──────────────────────────────────────────┐
│ 商品列表页优化    │ 中 │ 12h │ 02-10 │ 新需求 │
└──────────────────────────────────────────┘
```

---

## 五、兼容性说明

### 向后兼容
- 所有新增字段都有默认值处理
- 旧数据（无 `project_name`）会被标记为"未分类项目"
- 缺失 `estimated_hours` 默认为 8 小时
- 缺失 `start_at` 使用当前时间

### 数据验证
- 优先级仅接受 `High`/`Medium`/`Low`
- `estimated_hours` 必须为数字类型
- `start_at` 使用 ISO 8601 标准格式

---

## 六、测试建议

### 测试场景

1. **单项目需求**
   - 上传只包含一个项目的需求文档
   - 验证项目名称识别准确性
   - 检查工时评估合理性

2. **多项目需求**
   - 上传包含 2-3 个不同项目的需求文档
   - 验证项目区分准确性
   - 检查项目分组展示效果

3. **复杂度评估**
   - 简单任务（UI 调整）→ 应为 1-4h
   - 中等任务（功能开发）→ 应为 8-16h
   - 复杂任务（架构调整）→ 应为 24-40h

4. **边界情况**
   - 需求文档未明确项目名称
   - 需求描述过于简略
   - 多个需求属于同一项目

### 预期结果

- ✅ 项目名称准确识别
- ✅ 工时评估符合实际复杂度
- ✅ 开始时间为当前时间
- ✅ 分组视图正确展示
- ✅ 项目匹配逻辑正常工作

---

## 七、后续优化方向

1. **智能排期**
   - 根据优先级和依赖关系自动排期
   - 支持自定义开始时间

2. **工时调整**
   - 支持手动调整预估工时
   - 记录调整历史和原因

3. **项目映射**
   - 建立项目名称映射表
   - 提高匹配准确率

4. **批量操作**
   - 批量修改项目归属
   - 批量调整优先级和工时

---

## 八、相关文件清单

### 后端
- ✅ `backend/src/prompts/analyzeRequirements.js` - Prompt 模板
- ✅ `backend/src/prompts/README.md` - Prompt 管理规范
- ✅ `backend/src/services/agent.js` - 输出处理逻辑
- ✅ `backend/src/routes/analyze.js` - 分析接口
- ✅ `backend/src/routes/workItems.js` - 项目匹配和导入

### 前端
- ✅ `frontend/src/api/types.ts` - 类型定义
- ✅ `frontend/src/stores/app.ts` - 状态管理
- ✅ `frontend/src/components/workItems/WorkItemTable.vue` - 工作项表格
- ✅ `frontend/src/components/workItems/ProjectSelector.vue` - 项目选择器

---

## 九、注意事项

1. **Prompt 调优**
   - 根据实际使用效果持续优化 Prompt
   - 记录典型失败案例
   - 定期 review 输出质量

2. **性能考虑**
   - 大量工作项时分组视图可能影响性能
   - 考虑虚拟滚动或分页加载

3. **用户体验**
   - 提供视图切换的快捷键
   - 保存用户的视图偏好
   - 优化移动端展示

---

## 十、更新完成确认

- [x] Prompt 模板优化
- [x] 后端输出处理
- [x] 前端类型定义
- [x] 工作项表格增强
- [x] 项目选择器优化
- [x] 项目匹配逻辑
- [x] 代码 Lint 检查
- [x] 文档编写

**状态**: ✅ 全部完成

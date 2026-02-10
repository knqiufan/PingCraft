# Prompts 管理

本目录统一管理所有 LLM Prompt 模板，便于维护和优化。

## 文件结构

```
prompts/
├── README.md                    # 本说明文档
├── analyzeRequirements.js       # 需求分析 Prompt
└── [其他 Prompt 文件...]
```

## 命名规范

- 文件名使用驼峰命名法，与对应功能一致
- 导出的常量使用 `SCREAMING_SNAKE_CASE`，如 `ANALYZE_REQUIREMENTS_PROMPT`
- 每个文件只包含一个主 Prompt 模板及其相关变体

## Prompt 编写规范

### 1. 文件结构

```javascript
/**
 * [功能名称] Prompt 模板
 * [简要说明 Prompt 的用途]
 */

export const PROMPT_NAME = `
[Prompt 内容]
`;

// 可选：导出 Prompt 的变体
export const PROMPT_NAME_VARIANT = `...`;
```

### 2. Prompt 内容规范

#### 基本结构
```
你是一位 [角色定位]，擅长 [核心能力]。

## 任务
[明确的任务描述]

## 输出要求
[详细的输出格式说明]

### 必填字段
- **字段名** (类型): 说明
  - 详细要求
  - 示例或参考标准

## 分析要点
1. [要点1]
2. [要点2]

## 输出格式
[格式说明和示例]

---

## 输入内容

{input_variable}

---

{format_instructions}
```

#### 编写要点

1. **角色定位清晰**：明确 AI 的角色和专业领域
2. **任务描述具体**：避免模糊的指令，给出明确的目标
3. **输出格式严格**：详细说明每个字段的类型、取值范围、默认值
4. **提供示例**：给出 1-3 个典型的输出示例
5. **考虑边界情况**：说明如何处理缺失信息、异常输入等
6. **使用占位符**：用 `{variable}` 标记动态变量

### 3. 变量占位符

Prompt 中的变量使用 `{variable_name}` 格式，常见变量：

- `{text}`: 输入文本
- `{current_time}`: 当前时间
- `{format_instructions}`: 输出格式指令（由 LangChain 自动生成）
- 自定义变量：根据业务需求添加

### 4. 版本管理

当需要大幅修改 Prompt 时：

1. 保留旧版本作为注释或导出为 `PROMPT_NAME_V1`
2. 在文件顶部注释中记录修改历史
3. 说明修改原因和预期效果

示例：

```javascript
/**
 * 需求分析 Prompt 模板
 * 
 * 版本历史：
 * - v2 (2026-02-10): 增加项目名称识别、优化工时评估逻辑
 * - v1 (2026-01-15): 初始版本，基础需求提取
 */
```

## 测试与优化

### 测试流程

1. **单元测试**：准备多样化的测试用例
   - 简单需求（1-2 个工作项）
   - 复杂需求（多项目、多工作项）
   - 边界情况（模糊描述、缺失信息）

2. **评估指标**
   - 准确性：提取的工作项是否完整、准确
   - 合理性：优先级、工时评估是否合理
   - 稳定性：相同输入是否产生一致输出

3. **迭代优化**
   - 根据实际使用反馈调整 Prompt
   - 记录典型失败案例，针对性优化
   - 定期 review 和更新

### 优化技巧

1. **增强约束**：明确不希望的输出，如"不要包含 markdown 代码块"
2. **提供参考**：给出好的和坏的示例对比
3. **分步引导**：对于复杂任务，拆分为多个步骤
4. **Few-shot Learning**：在 Prompt 中包含 2-3 个示例
5. **温度调节**：根据任务特点调整 `temperature` 参数
   - 结构化提取：0-0.2（确定性高）
   - 创意生成：0.7-1.0（多样性高）

## 使用示例

```javascript
import { ANALYZE_REQUIREMENTS_PROMPT } from '../prompts/analyzeRequirements.js';
import { PromptTemplate } from '@langchain/core/prompts';

const prompt = PromptTemplate.fromTemplate(ANALYZE_REQUIREMENTS_PROMPT);

const result = await prompt.invoke({
  text: '用户需求文档内容...',
  current_time: new Date().toISOString(),
  format_instructions: parser.getFormatInstructions(),
});
```

## 注意事项

1. **不要硬编码敏感信息**：API Key、密码等应通过环境变量传入
2. **控制 Prompt 长度**：过长的 Prompt 会增加 token 消耗和延迟
3. **保持语言一致**：中文 Prompt 用于中文任务，英文 Prompt 用于英文任务
4. **定期清理**：删除不再使用的 Prompt，保持目录整洁

## 贡献指南

添加新 Prompt 时，请确保：

1. 遵循上述命名和编写规范
2. 添加详细的注释说明
3. 提供至少 1 个使用示例
4. 更新本 README 的文件列表

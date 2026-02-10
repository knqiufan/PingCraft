import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { appConfig } from '../config/index.js';
import { ANALYZE_REQUIREMENTS_PROMPT } from '../prompts/analyzeRequirements.js';

const { llm: llmConf } = appConfig;

if (!llmConf.apiKey) {
  console.warn('[Agent] OPENAI_API_KEY 未配置，需求分析功能将不可用');
}

/** LLM 模型实例 */
const model = new ChatOpenAI({
  configuration: {
    baseURL: llmConf.baseUrl,
    apiKey: llmConf.apiKey,
  },
  modelName: llmConf.model,
  temperature: 0,
});

/** JSON 输出解析器 */
const parser = new JsonOutputParser();

/** 需求分析 Prompt 模板 */
const analyzePrompt = PromptTemplate.fromTemplate(ANALYZE_REQUIREMENTS_PROMPT);

/**
 * 调用 LLM 分析需求文档并提取工作项
 * @param {string} text - 文档文本内容
 * @returns {Promise<Array>} 工作项列表，每项包含：
 *   - project_name: 项目名称
 *   - title: 工作项标题
 *   - description: 详细描述
 *   - priority: 优先级 (High/Medium/Low)
 *   - estimated_hours: 预估工时（小时）
 *   - start_at: 计划开始时间 (ISO 8601)
 */
export async function analyzeRequirements(text) {
  const chain = analyzePrompt.pipe(model).pipe(parser);
  const currentTime = new Date().toISOString();

  try {
    const result = await chain.invoke({
      text,
      current_time: currentTime,
      format_instructions: parser.getFormatInstructions(),
    });

    const typeIdAllowList = ['story', 'task', 'bug', 'feature', 'epic'];
    const workItems = Array.isArray(result) ? result : [];
    return workItems.map((item) => ({
      project_name: item.project_name || '未分类项目',
      title: item.title || '未命名工作项',
      description: item.description || '',
      priority: ['High', 'Medium', 'Low'].includes(item.priority) ? item.priority : 'Medium',
      estimated_hours: typeof item.estimated_hours === 'number' ? item.estimated_hours : 8,
      start_at: item.start_at || currentTime,
      type_id: typeIdAllowList.includes(item.type_id) ? item.type_id : 'story',
    }));
  } catch (e) {
    console.error('[Agent] 需求分析失败:', e.message);
    throw e;
  }
}

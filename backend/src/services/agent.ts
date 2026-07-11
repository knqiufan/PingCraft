import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { ANALYZE_REQUIREMENTS_PROMPT } from '../prompts/analyzeRequirements.js';
import { ModelConfig } from '../models/index.js';

/** JSON 输出解析器 */
const parser = new JsonOutputParser();

/** 需求分析 Prompt 模板 */
const analyzePrompt = PromptTemplate.fromTemplate(ANALYZE_REQUIREMENTS_PROMPT);

/** LLM 配置（模型实例 / 前端测试连接均满足此结构） */
interface LLMConfig {
  provider?: string | null;
  api_key: string;
  base_url?: string | null;
  model: string;
  temperature?: number | null;
  max_tokens?: number | null;
}

/** 规范化后的工作项结构 */
export interface NormalizedWorkItem {
  project_name: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  estimated_hours: number;
  start_at: string;
  type_id: string;
  assignee_name: string | null;
  solution_suggestion: string;
}

/**
 * 根据 provider 创建 OpenAI 兼容的 LLM 实例
 */
function createOpenAIModel(config: LLMConfig): ChatOpenAI {
  return new ChatOpenAI({
    configuration: {
      baseURL: config.base_url || undefined,
      apiKey: config.api_key,
    },
    modelName: config.model,
    temperature: config.temperature ?? 0,
    maxTokens: config.max_tokens ?? undefined,
  });
}

/**
 * 根据 provider 创建 Anthropic 的 LLM 实例（动态加载依赖，未安装时抛出明确错误）
 */
async function createAnthropicModel(config: LLMConfig): Promise<any> {
  let ChatAnthropic;
  try {
    const mod = await import('@langchain/anthropic');
    ChatAnthropic = mod.ChatAnthropic;
  } catch (err: any) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' || err.message?.includes('Cannot find package')) {
      throw new Error(
        '使用 Anthropic 模型需要先安装依赖，请在 backend 目录执行: pnpm add @langchain/anthropic',
      );
    }
    throw err;
  }
  return new ChatAnthropic({
    anthropicApiKey: config.api_key,
    anthropicApiUrl: config.base_url || undefined,
    modelName: config.model,
    temperature: config.temperature ?? 0,
    maxTokens: config.max_tokens ?? 4096,
  });
}

/**
 * 获取 LLM 模型实例（仅从模型管理中获取）
 * 优先使用用户默认模型，若无则使用第一个配置
 */
async function getModelInstance(userId: string): Promise<any> {
  // 1. 优先获取用户默认模型配置
  let config = await ModelConfig.findOne({
    where: { user_id: userId, is_default: true },
  });

  // 2. 若无默认配置，使用第一个配置
  if (!config) {
    config = await ModelConfig.findOne({
      where: { user_id: userId },
      order: [['createdAt', 'ASC']],
    });
  }

  if (!config) {
    throw new Error('未配置 LLM 模型，请在「模型配置」中至少添加一个模型，并设为默认');
  }

  console.log(`[Agent] 使用模型: ${config.name} (${config.provider}/${config.model})`);

  if (config.provider === 'anthropic') {
    return await createAnthropicModel(config);
  }
  return createOpenAIModel(config);
}

/**
 * 测试模型连接是否可用
 * @throws 连接失败时抛出
 */
export async function testModelConnection(config: LLMConfig): Promise<void> {
  const model = config.provider === 'anthropic'
    ? await createAnthropicModel(config)
    : createOpenAIModel(config);
  await model.invoke('Hi');
}

/**
 * 调用 LLM 分析需求文档并提取工作项
 */
export async function analyzeRequirements(text: string, userId: string): Promise<NormalizedWorkItem[]> {
  const result = await analyzeRequirementsRaw(text, userId);
  return normalizeWorkItems(result);
}

/** 将 LLM 原始输出规范化为统一的工作项结构 */
function normalizeWorkItems(result: unknown): NormalizedWorkItem[] {
  const typeIdAllowList = ['story', 'task', 'bug', 'feature', 'epic'];
  const currentTime = new Date().toISOString();
  const workItems: any[] = Array.isArray(result) ? result : [];
  return workItems.map((item) => ({
    project_name: item.project_name || '未分类项目',
    title: item.title || '未命名工作项',
    description: item.description || '',
    priority: ['High', 'Medium', 'Low'].includes(item.priority) ? item.priority : 'Medium',
    estimated_hours: typeof item.estimated_hours === 'number' ? item.estimated_hours : 8,
    start_at: item.start_at || currentTime,
    type_id: typeIdAllowList.includes(item.type_id) ? item.type_id : 'story',
    assignee_name: item.assignee_name || null,
    solution_suggestion: item.solution_suggestion || '',
  }));
}

/** 底层调用：返回 LLM 原始解析结果（供非流式和流式复用） */
async function analyzeRequirementsRaw(text: string, userId: string): Promise<unknown> {
  const model = await getModelInstance(userId);
  const chain = analyzePrompt.pipe(model).pipe(parser);
  const currentTime = new Date().toISOString();

  try {
    return await chain.invoke({
      text,
      current_time: currentTime,
      format_instructions: parser.getFormatInstructions(),
    });
  } catch (e) {
    console.error('[Agent] 需求分析失败:', (e as Error).message);
    throw e;
  }
}

/**
 * 流式分析需求文档（P3-5.8）。
 *
 * LangChain 的 chain.stream() 配合 JsonOutputParser 会逐步 yield 已解析的部分结果。
 * 通过 onProgress 回调将部分结果推送给前端（SSE），让用户在大文档分析时获得实时反馈。
 *
 * @param onProgress 回调 (partialItems) => void，收到部分结果时触发
 */
export async function analyzeRequirementsStream(
  text: string,
  userId: string,
  onProgress?: (partialItems: NormalizedWorkItem[]) => void,
): Promise<NormalizedWorkItem[]> {
  const model = await getModelInstance(userId);
  const chain = analyzePrompt.pipe(model).pipe(parser);
  const currentTime = new Date().toISOString();

  let lastResult: unknown = null;
  try {
    const stream = await chain.stream({
      text,
      current_time: currentTime,
      format_instructions: parser.getFormatInstructions(),
    });

    for await (const chunk of stream) {
      if (Array.isArray(chunk) && chunk.length > 0) {
        lastResult = chunk;
        // 推送部分规范化的结果
        onProgress?.(normalizeWorkItems(chunk));
      }
    }
  } catch (e) {
    console.error('[Agent] 流式需求分析失败:', (e as Error).message);
    // 流式失败时回退到非流式调用
    if (lastResult) {
      return normalizeWorkItems(lastResult);
    }
    throw e;
  }

  // 流结束后用最终结果规范化（可能比最后一块更完整）
  const finalRaw = lastResult || (await analyzeRequirementsRaw(text, userId));
  return normalizeWorkItems(finalRaw);
}

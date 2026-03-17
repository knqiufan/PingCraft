import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ANALYZE_STATS_PROMPT } from '../prompts/analyzeStats.js';
import { ModelConfig } from '../models/index.js';

const statsPrompt = PromptTemplate.fromTemplate(ANALYZE_STATS_PROMPT);
const stringParser = new StringOutputParser();

function createOpenAIModel(config) {
  return new ChatOpenAI({
    configuration: {
      baseURL: config.base_url || undefined,
      apiKey: config.api_key,
    },
    modelName: config.model,
    temperature: config.temperature ?? 0.3,
    maxTokens: config.max_tokens ?? 4096,
  });
}

async function createAnthropicModel(config) {
  const mod = await import('@langchain/anthropic');
  return new mod.ChatAnthropic({
    anthropicApiKey: config.api_key,
    anthropicApiUrl: config.base_url || undefined,
    modelName: config.model,
    temperature: config.temperature ?? 0.3,
    maxTokens: config.max_tokens ?? 4096,
  });
}

async function getModelInstance(userId) {
  let config = await ModelConfig.findOne({
    where: { user_id: userId, is_default: true },
  });
  if (!config) {
    config = await ModelConfig.findOne({
      where: { user_id: userId },
      order: [['createdAt', 'ASC']],
    });
  }
  if (!config) {
    throw new Error('未配置 LLM 模型，请在「模型配置」中至少添加一个模型，并设为默认');
  }

  console.log(`[StatsAnalyzer] 使用模型: ${config.name} (${config.provider}/${config.model})`);

  if (config.provider === 'anthropic') {
    return await createAnthropicModel(config);
  }
  return createOpenAIModel(config);
}

/**
 * 使用 AI 分析项目统计数据，生成 Markdown 格式的分析报告
 */
export async function analyzeProjectStats(statsData, userId) {
  const model = await getModelInstance(userId);
  const chain = statsPrompt.pipe(model).pipe(stringParser);

  const statsJson = JSON.stringify({
    assigneeDistribution: statsData.assigneeDistribution,
    typeDistribution: statsData.typeDistribution,
    priorityDistribution: statsData.priorityDistribution,
    stateDistribution: statsData.stateDistribution,
    workloadByAssignee: statsData.workloadByAssignee,
    workloadByType: statsData.workloadByType,
  }, null, 2);

  const report = await chain.invoke({
    project_name: statsData.project.name,
    total_items: String(statsData.totalItems),
    total_hours: String(statsData.totalEstimatedHours),
    stats_json: statsJson,
  });

  return report;
}

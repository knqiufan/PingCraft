import crypto from 'crypto';
import express from 'express';
import type { Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '../middleware/auth.js';
import type { AuthedRequest } from '../types/authRequest.js';
import { ModelConfig } from '../models/index.js';
import { success } from '../utils/response.js';
import { testModelConnection } from '../services/agent.js';
import { maskSecret } from '../utils/crypto.js';

const router = express.Router();

/** 序列化模型配置：列表/详情接口中脱敏 api_key，仅返回掩码 */
function serializeConfig(config: ModelConfig | null): Record<string, any> | null {
  if (!config) return null;
  const json = config.toJSON() as Record<string, any>;
  json.api_key = maskSecret(json.api_key);
  return json;
}

/** 获取用户的所有模型配置 */
router.get('/', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const configs = await ModelConfig.findAll({
      where: { user_id: userId },
      order: [['createdAt', 'DESC']],
    });
    res.json(success(configs.map(serializeConfig)));
  } catch (e) {
    next(e);
  }
});

/** 测试模型连接（通过请求体传入配置，用于新增/编辑前测试） */
router.post('/test', requireAuth, async (req: AuthedRequest, res: Response, _next: NextFunction) => {
  try {
    const { provider, api_key, base_url, model } = req.body;

    if (!provider || !api_key || !model) {
      return res.status(400).json({ success: false, error: '缺少必填字段：provider、api_key、model' });
    }

    if (!['openai', 'anthropic'].includes(provider)) {
      return res.status(400).json({ success: false, error: '不支持的提供商' });
    }

    await testModelConnection({
      provider,
      api_key,
      base_url: base_url || undefined,
      model,
    });

    res.json(success(null, '连接成功'));
  } catch (e: any) {
    const message = e.message || '连接失败';
    return res.status(400).json({ success: false, error: message });
  }
});

/** 获取默认模型配置 */
router.get('/default', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const config = await ModelConfig.findOne({
      where: { user_id: userId, is_default: true },
    });

    if (!config) {
      // 如果没有默认配置，返回第一个配置
      const firstConfig = await ModelConfig.findOne({
        where: { user_id: userId },
        order: [['createdAt', 'ASC']],
      });
      return res.json(success(serializeConfig(firstConfig)));
    }

    res.json(success(serializeConfig(config)));
  } catch (e) {
    next(e);
  }
});

/** 获取单个模型配置 */
router.get('/:id', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const config = await ModelConfig.findOne({
      where: { id: req.params.id, user_id: userId },
    });

    if (!config) {
      return res.status(404).json({ success: false, error: '配置不存在' });
    }

    res.json(success(serializeConfig(config)));
  } catch (e) {
    next(e);
  }
});

/** 测试模型连接 */
router.post('/:id/test', requireAuth, async (req: AuthedRequest, res: Response, _next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const config = await ModelConfig.findOne({
      where: { id: req.params.id, user_id: userId },
    });

    if (!config) {
      return res.status(404).json({ success: false, error: '配置不存在' });
    }

    await testModelConnection({
      provider: config.provider,
      api_key: config.api_key,
      base_url: config.base_url,
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
    });

    res.json(success(null, '连接成功'));
  } catch (e: any) {
    const message = e.message || '连接失败';
    return res.status(400).json({ success: false, error: message });
  }
});

/** 创建模型配置 */
router.post('/', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { name, provider, api_key, base_url, model, temperature, max_tokens, is_default } = req.body;

    // 验证必填字段
    if (!name || !provider || !api_key || !model) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    // 验证 provider
    if (!['openai', 'anthropic'].includes(provider)) {
      return res.status(400).json({ success: false, error: '不支持的提供商' });
    }

    // 如果设置为默认，取消其他配置的默认状态
    if (is_default) {
      await ModelConfig.update(
        { is_default: false },
        { where: { user_id: userId } },
      );
    }

    const config = await ModelConfig.create({
      id: crypto.randomUUID(),
      user_id: userId,
      name,
      provider,
      api_key,
      base_url: base_url || null,
      model,
      temperature: temperature || 0,
      max_tokens: max_tokens || null,
      is_default: is_default || false,
    });

    res.json(success(serializeConfig(config), '创建成功'));
  } catch (e) {
    next(e);
  }
});

/** 更新模型配置 */
router.put('/:id', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const config = await ModelConfig.findOne({
      where: { id: req.params.id, user_id: userId },
    });

    if (!config) {
      return res.status(404).json({ success: false, error: '配置不存在' });
    }

    const { name, provider, api_key, base_url, model, temperature, max_tokens, is_default } = req.body;

    // 验证 provider
    if (provider && !['openai', 'anthropic'].includes(provider)) {
      return res.status(400).json({ success: false, error: '不支持的提供商' });
    }

    // 如果设置为默认，取消其他配置的默认状态
    if (is_default) {
      await ModelConfig.update(
        { is_default: false },
        { where: { user_id: userId, id: { [Op.ne]: req.params.id as string } } },
      );
    }

    // 如果 api_key 是脱敏值（含 ****），说明前端未修改密钥，跳过更新
    const updateFields: Record<string, any> = {
      ...(name && { name }),
      ...(provider && { provider }),
      ...(base_url !== undefined && { base_url }),
      ...(model && { model }),
      ...(temperature !== undefined && { temperature }),
      ...(max_tokens !== undefined && { max_tokens }),
      ...(is_default !== undefined && { is_default }),
    };
    if (api_key && !api_key.includes('****')) {
      updateFields.api_key = api_key;
    }

    await config.update(updateFields);

    res.json(success(serializeConfig(config), '更新成功'));
  } catch (e) {
    next(e);
  }
});

/** 删除模型配置（若删除的是默认模型，自动将最早创建的配置设为默认） */
router.delete('/:id', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const config = await ModelConfig.findOne({
      where: { id: req.params.id, user_id: userId },
    });

    if (!config) {
      return res.status(404).json({ success: false, error: '配置不存在' });
    }

    const wasDefault = config.is_default;
    await config.destroy();

    // P2-4.5: 删除默认模型后，自动将另一个设为默认，避免后续分析找不到默认模型
    if (wasDefault) {
      const nextDefault = await ModelConfig.findOne({
        where: { user_id: userId },
        order: [['createdAt', 'ASC']],
      });
      if (nextDefault) {
        await nextDefault.update({ is_default: true });
      }
    }

    res.json(success(null, '删除成功'));
  } catch (e) {
    next(e);
  }
});

export default router;

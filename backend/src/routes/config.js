import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../utils/response.js';

const router = express.Router();

/** 保存 PingCode 配置 */
router.post('/config', requireAuth, async (req, res, next) => {
  const { client_id, client_secret } = req.body;
  if (!client_id || !client_secret) {
    return res.status(400).json({ success: false, error: 'Client ID 和 Client Secret 不能为空' });
  }

  try {
    const user = req.user;
    user.pingcode_client_id = client_id;
    user.pingcode_client_secret = client_secret;
    await user.save();
    res.json(success(null, '配置已保存'));
  } catch (e) {
    next(e);
  }
});

/** 获取配置信息（含连接状态） */
router.get('/config', requireAuth, async (req, res, next) => {
  try {
    const user = req.user;
    res.json({
      client_id: user.pingcode_client_id || '',
      has_secret: !!user.pingcode_client_secret,
      is_connected: !!user.access_token,
    });
  } catch (e) {
    next(e);
  }
});

export default router;

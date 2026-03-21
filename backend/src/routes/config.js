import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../utils/response.js';
import {
  PINGCODE_GRANT_AUTHORIZATION_CODE,
  PINGCODE_GRANT_CLIENT_CREDENTIALS,
} from '../services/pingcode.js';

const router = express.Router();

const ALLOWED_GRANT_TYPES = new Set([
  PINGCODE_GRANT_AUTHORIZATION_CODE,
  PINGCODE_GRANT_CLIENT_CREDENTIALS,
]);

function clearPingcodeConnection(user) {
  user.access_token = null;
  user.refresh_token = null;
  user.expires_at = null;
  user.pingcode_uid = null;
  user.pingcode_user_id = null;
  user.pingcode_user_name = null;
  user.pingcode_display_name = null;
  user.pingcode_email = null;
  user.pingcode_avatar = null;
}

/** 保存 PingCode 配置 */
router.post('/config', requireAuth, async (req, res, next) => {
  const { client_id, client_secret, grant_type: bodyGrantType } = req.body;
  if (!client_id || !client_secret) {
    return res.status(400).json({ success: false, error: 'Client ID 和 Client Secret 不能为空' });
  }

  try {
    const user = req.user;
    const prevGrant =
      user.pingcode_grant_type || PINGCODE_GRANT_AUTHORIZATION_CODE;
    const nextGrant = bodyGrantType ?? prevGrant;

    if (!ALLOWED_GRANT_TYPES.has(nextGrant)) {
      return res.status(400).json({
        success: false,
        error: 'grant_type 须为 authorization_code 或 client_credentials',
      });
    }

    if (nextGrant !== prevGrant) {
      clearPingcodeConnection(user);
    }

    user.pingcode_client_id = client_id;
    user.pingcode_client_secret = client_secret;
    user.pingcode_grant_type = nextGrant;
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
      grant_type: user.pingcode_grant_type || PINGCODE_GRANT_AUTHORIZATION_CODE,
    });
  } catch (e) {
    next(e);
  }
});

export default router;

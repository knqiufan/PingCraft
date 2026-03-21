import express from 'express';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import {
  getAuthUrl,
  getToken,
  getUserIdFromToken,
  fetchUserInfo,
  getEnterpriseToken,
  computeExpiresAtFromTokenResponse,
  PINGCODE_GRANT_AUTHORIZATION_CODE,
  PINGCODE_GRANT_CLIENT_CREDENTIALS,
} from '../services/pingcode.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { appConfig } from '../config/index.js';

const router = express.Router();

/* ---- 工具函数 ---- */

/** 解析 Cookie 字符串 */
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, part) => {
    const [rawKey, ...rest] = part.trim().split('=');
    const key = decodeURIComponent(rawKey || '');
    const value = decodeURIComponent(rest.join('=') || '');
    if (key) acc[key] = value;
    return acc;
  }, {});
}

/** 通过 state 参数解析用户 */
async function getUserFromState(state) {
  if (!state) return null;
  try {
    const decoded = jwt.verify(state, appConfig.jwt.secret);
    return await User.findByPk(decoded.userId);
  } catch {
    return null;
  }
}

/** 通过 Cookie 兜底获取用户 */
async function getUserFromCookie(req) {
  const cookies = parseCookies(req.headers.cookie);
  const userId = cookies.oauth_user_id;
  if (!userId) return null;
  return await User.findByPk(userId);
}

/** 查找已配置 PingCode 且为「用户授权」模式的用户（兜底；含 grant_type 未迁移的旧行） */
async function findConfiguredUserForOAuth() {
  return await User.findOne({
    where: {
      pingcode_client_id: { [Op.ne]: null },
      [Op.or]: [
        { pingcode_grant_type: PINGCODE_GRANT_AUTHORIZATION_CODE },
        { pingcode_grant_type: { [Op.is]: null } },
      ],
    },
  });
}

/* ---- 路由 ---- */

/** 为当前用户生成授权 URL */
router.get('/login-url', requireAuth, (req, res) => {
  const user = req.user;
  if (user.pingcode_grant_type === PINGCODE_GRANT_CLIENT_CREDENTIALS) {
    return res.status(400).json({ error: '当前为企业授权模式，请使用「连接 PingCode」获取企业令牌，勿使用浏览器 OAuth。' });
  }
  if (!user.pingcode_client_id) {
    return res.status(400).json({ error: '尚未配置 PingCode Client ID' });
  }

  const state = jwt.sign({ userId: user.id }, appConfig.jwt.secret, { expiresIn: '5m' });
  res.cookie('oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 5 * 60 * 1000 });
  res.cookie('oauth_user_id', user.id, { httpOnly: true, sameSite: 'lax', maxAge: 5 * 60 * 1000 });

  const url = getAuthUrl(user.pingcode_client_id, state);
  res.json({ url });
});

/** 公开入口：直接跳转 PingCode 授权 */
router.get('/login', async (req, res, next) => {
  try {
    const user = await findConfiguredUserForOAuth();
    if (!user) {
      return res.status(400).send('未找到已配置「用户授权」模式的账号，请先注册并配置 PingCode 凭证。');
    }

    const state = jwt.sign({ userId: user.id, isLogin: true }, appConfig.jwt.secret, { expiresIn: '5m' });
    res.cookie('oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 5 * 60 * 1000 });
    res.cookie('oauth_user_id', user.id, { httpOnly: true, sameSite: 'lax', maxAge: 5 * 60 * 1000 });

    const url = getAuthUrl(user.pingcode_client_id, state);
    res.redirect(url);
  } catch (e) {
    next(e);
  }
});

/** OAuth 回调 */
router.get('/callback', async (req, res, next) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('缺少授权码');

  try {
    // 依次尝试获取用户
    let user = await getUserFromState(state);
    if (!user) user = await getUserFromCookie(req);
    if (!user) user = await findConfiguredUserForOAuth();
    if (!user) return res.status(400).send('无法确定关联用户');

    if (user.pingcode_grant_type === PINGCODE_GRANT_CLIENT_CREDENTIALS) {
      return res.status(400).send('当前账号为企业授权模式，不应使用 OAuth 回调；请在本应用内获取企业令牌。');
    }

    if (!user.pingcode_client_id || !user.pingcode_client_secret) {
      return res.status(400).send('该用户缺少 PingCode 凭证');
    }

    const tokenData = await getToken(code, user.pingcode_client_id, user.pingcode_client_secret);
    const { access_token, refresh_token, expires_in } = tokenData;

    // 获取 PingCode 用户 ID
    let pingcodeUid = getUserIdFromToken(access_token);
    let domain = req.query.domain || 'open.pingcode.com';

    if (!pingcodeUid) {
      const userInfo = await fetchUserInfo(access_token, domain);
      if (userInfo) pingcodeUid = userInfo.id;
    }

    // 更新用户信息
    user.pingcode_uid = pingcodeUid;
    user.access_token = access_token;
    user.refresh_token = refresh_token;
    user.expires_at = computeExpiresAtFromTokenResponse({ ...tokenData, expires_in });
    user.domain = domain;
    await user.save();

    res.clearCookie('oauth_state');
    res.clearCookie('oauth_user_id');

    // 重定向到前端
    res.redirect(`${appConfig.frontendUrl}/dashboard?connected=true`);
  } catch (e) {
    next(e);
  }
});

/** 企业授权：用 client_credentials 换取 access_token（需已保存凭证与模式） */
router.post('/pingcode/enterprise-token', requireAuth, async (req, res, next) => {
  try {
    const user = req.user;
    if (user.pingcode_grant_type !== PINGCODE_GRANT_CLIENT_CREDENTIALS) {
      return res.status(400).json({
        error: '当前不是企业授权模式，请在配置中选择「企业授权」并保存后再试。',
      });
    }
    if (!user.pingcode_client_id || !user.pingcode_client_secret) {
      return res.status(400).json({ error: '请先配置 Client ID 与 Client Secret' });
    }

    const tokenData = await getEnterpriseToken(user.pingcode_client_id, user.pingcode_client_secret);
    const { access_token: accessToken } = tokenData;
    if (!accessToken) {
      return res.status(502).json({ error: 'PingCode 未返回 access_token' });
    }

    const domain = user.domain || 'open.pingcode.com';
    await user.update({
      access_token: accessToken,
      refresh_token: null,
      expires_at: computeExpiresAtFromTokenResponse(tokenData),
      pingcode_uid: null,
      domain,
    });

    res.json({ success: true, message: '企业令牌已获取' });
  } catch (e) {
    next(e);
  }
});

export default router;

import express from 'express';
import jwt from 'jsonwebtoken';
import {
  getAuthUrl,
  getToken,
  getUserIdFromToken,
  fetchUserInfo,
  getEnterpriseToken,
  computeExpiresAtFromTokenResponse,
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

/** 通过 state 参数解析用户（state JWT 必须有效且与 cookie 中的 oauth_user_id 一致） */
async function getUserFromState(state, expectedUserId) {
  if (!state || !expectedUserId) return null;
  try {
    const decoded = jwt.verify(state, appConfig.jwt.secret);
    // state 中的 userId 必须与 cookie 中的 oauth_user_id 一致（防 CSRF / 篡改攻击）
    if (decoded.userId !== expectedUserId) return null;
    return await User.findByPk(decoded.userId);
  } catch {
    return null;
  }
}

/** 通过 Cookie 获取用户（辅助 state 解析，不做独立兜底） */
async function getUserFromOAuthCookies(req) {
  const cookies = parseCookies(req.headers.cookie);
  const userId = cookies.oauth_user_id;
  const state = cookies.oauth_state || req.query.state;
  if (!userId) return null;
  return await getUserFromState(state, userId);
}

/* ---- 路由 ---- */

/**
 * 为当前登录用户生成 PingCode 授权 URL（需要登录态）。
 * 移除了原先的公开 /auth/login 入口——任意访客不应能以他人身份发起 OAuth。
 */
router.get('/login-url', requireAuth, (req, res) => {
  const user = req.user;
  if (user.pingcode_grant_type === PINGCODE_GRANT_CLIENT_CREDENTIALS) {
    return res.status(400).json({ success: false, error: '当前为企业授权模式，请使用「连接 PingCode」获取企业令牌，勿使用浏览器 OAuth。' });
  }
  if (!user.pingcode_client_id) {
    return res.status(400).json({ success: false, error: '尚未配置 PingCode Client ID' });
  }

  const state = jwt.sign({ userId: user.id }, appConfig.jwt.secret, { expiresIn: '5m' });
  res.cookie('oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 5 * 60 * 1000 });
  res.cookie('oauth_user_id', user.id, { httpOnly: true, sameSite: 'lax', maxAge: 5 * 60 * 1000 });

  const url = getAuthUrl(user.pingcode_client_id, state);
  res.json({ success: true, url });
});

/**
 * OAuth 回调：严格依赖 state JWT + cookie 定位用户，不再使用「取第一个配置了 client_id 的用户」兜底，
 * 避免多用户部署下越权绑定。
 */
router.get('/callback', async (req, res, next) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('缺少授权码');

  try {
    // 严格通过 state JWT + cookie 定位用户，不做公开兜底
    let user = null;
    if (state) {
      // 优先用 query 中的 state（PingCode 回传），但需与 cookie 中的 oauth_user_id 匹配
      const cookies = parseCookies(req.headers.cookie);
      user = await getUserFromState(state, cookies.oauth_user_id);
    }
    if (!user) user = await getUserFromOAuthCookies(req);
    if (!user) {
      return res.status(400).send('无法确定关联用户，请先登录本系统并重新发起 PingCode 授权。');
    }

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
    let domain = req.query.domain || appConfig.pingcode.defaultDomain;

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
        success: false,
        error: '当前不是企业授权模式，请在配置中选择「企业授权」并保存后再试。',
      });
    }
    if (!user.pingcode_client_id || !user.pingcode_client_secret) {
      return res.status(400).json({ success: false, error: '请先配置 Client ID 与 Client Secret' });
    }

    const tokenData = await getEnterpriseToken(user.pingcode_client_id, user.pingcode_client_secret);
    const { access_token: accessToken } = tokenData;
    if (!accessToken) {
      return res.status(502).json({ success: false, error: 'PingCode 未返回 access_token' });
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

import {
  refreshAccessToken,
  getEnterpriseToken,
  computeExpiresAtFromTokenResponse,
  PINGCODE_GRANT_AUTHORIZATION_CODE,
  PINGCODE_GRANT_CLIENT_CREDENTIALS,
} from '../services/pingcode.js';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

function grantTypeOf(user) {
  return user.pingcode_grant_type || PINGCODE_GRANT_AUTHORIZATION_CODE;
}

async function refreshUserOAuthToken(user) {
  const tokenData = await refreshAccessToken(
    user.refresh_token,
    user.pingcode_client_id,
    user.pingcode_client_secret
  );
  const { access_token, refresh_token, expires_in } = tokenData;
  await user.update({
    access_token,
    refresh_token: refresh_token || user.refresh_token,
    expires_at: computeExpiresAtFromTokenResponse({ ...tokenData, expires_in }),
  });
}

async function refreshEnterpriseToken(user) {
  const tokenData = await getEnterpriseToken(
    user.pingcode_client_id,
    user.pingcode_client_secret
  );
  const { access_token: accessToken } = tokenData;
  if (!accessToken) {
    throw new Error('PingCode 企业令牌响应缺少 access_token');
  }
  await user.update({
    access_token: accessToken,
    refresh_token: null,
    expires_at: computeExpiresAtFromTokenResponse(tokenData),
  });
}

/**
 * 中间件：在需要 PingCode API 的路由前检查并自动刷新过期 token
 * 仅当 req.user 存在且 token 即将/已经过期时触发刷新
 */
export async function ensureFreshToken(req, res, next) {
  try {
    const user = req.user;
    if (!user || !user.access_token || !user.expires_at) {
      return next();
    }

    const expiresAt = new Date(user.expires_at).getTime();
    const now = Date.now();

    if (now < expiresAt - TOKEN_REFRESH_BUFFER_MS) {
      return next();
    }

    const mode = grantTypeOf(user);

    if (mode === PINGCODE_GRANT_CLIENT_CREDENTIALS) {
      if (!user.pingcode_client_id || !user.pingcode_client_secret) {
        return next();
      }
      console.log(`[TokenRefresh] 企业令牌即将过期，正在为用户 ${user.id} 重新获取...`);
      await refreshEnterpriseToken(user);
      await user.reload();
      req.user = user;
      console.log(`[TokenRefresh] 用户 ${user.id} 企业令牌已更新`);
      return next();
    }

    if (!user.refresh_token || !user.pingcode_client_id || !user.pingcode_client_secret) {
      return next();
    }

    console.log(`[TokenRefresh] Token 即将过期，正在为用户 ${user.id} 刷新...`);
    await refreshUserOAuthToken(user);
    await user.reload();
    req.user = user;
    console.log(`[TokenRefresh] 用户 ${user.id} Token 刷新成功`);
    next();
  } catch (e) {
    console.error('[TokenRefresh] Token 刷新失败:', e.message);
    next();
  }
}

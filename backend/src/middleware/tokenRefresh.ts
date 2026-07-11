import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from '../types/authRequest.js';
import {
  refreshAccessToken,
  getEnterpriseToken,
  computeExpiresAtFromTokenResponse,
  PINGCODE_GRANT_AUTHORIZATION_CODE,
  PINGCODE_GRANT_CLIENT_CREDENTIALS,
} from '../services/pingcode.js';
import type { User } from '../models/index.js';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

function grantTypeOf(user: User): string {
  return user.pingcode_grant_type || PINGCODE_GRANT_AUTHORIZATION_CODE;
}

async function refreshUserOAuthToken(user: User): Promise<void> {
  const tokenData: any = await refreshAccessToken(
    user.refresh_token!,
    user.pingcode_client_id!,
    user.pingcode_client_secret!,
  );
  const { access_token, refresh_token, expires_in } = tokenData;
  await user.update({
    access_token,
    refresh_token: refresh_token || user.refresh_token,
    expires_at: computeExpiresAtFromTokenResponse({ ...tokenData, expires_in }),
  });
}

async function refreshEnterpriseToken(user: User): Promise<void> {
  const tokenData: any = await getEnterpriseToken(
    user.pingcode_client_id!,
    user.pingcode_client_secret!,
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
 *
 * 刷新失败时返回明确的 401（带 code: 'PINGCODE_AUTH_EXPIRED'），引导前端在保持本地登录态的前提下
 * 提示用户重新连接 PingCode，而非静默放行导致下游报错链路长且不友好。
 */
export async function ensureFreshToken(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;
    if (!user || !user.access_token || !user.expires_at) {
      next();
      return;
    }

    const expiresAt = new Date(user.expires_at).getTime();
    const now = Date.now();

    if (now < expiresAt - TOKEN_REFRESH_BUFFER_MS) {
      next();
      return;
    }

    const mode = grantTypeOf(user);

    if (mode === PINGCODE_GRANT_CLIENT_CREDENTIALS) {
      if (!user.pingcode_client_id || !user.pingcode_client_secret) {
        res.status(401).json({
          success: false,
          code: 'PINGCODE_AUTH_EXPIRED',
          error: 'PingCode 企业凭证不完整，请重新配置 Client ID 与 Secret',
        });
        return;
      }
      console.log(`[TokenRefresh] 企业令牌即将过期，正在为用户 ${user.id} 重新获取...`);
      try {
        await refreshEnterpriseToken(user);
      } catch (refreshErr) {
        console.error('[TokenRefresh] 企业令牌获取失败:', (refreshErr as Error).message);
        res.status(401).json({
          success: false,
          code: 'PINGCODE_AUTH_EXPIRED',
          error: 'PingCode 企业授权已过期或凭证无效，请重新配置',
        });
        return;
      }
      await user.reload();
      req.user = user;
      console.log(`[TokenRefresh] 用户 ${user.id} 企业令牌已更新`);
      next();
      return;
    }

    if (!user.refresh_token || !user.pingcode_client_id || !user.pingcode_client_secret) {
      res.status(401).json({
        success: false,
        code: 'PINGCODE_AUTH_EXPIRED',
        error: 'PingCode 授权已过期且缺少刷新凭证，请重新连接 PingCode',
      });
      return;
    }

    console.log(`[TokenRefresh] Token 即将过期，正在为用户 ${user.id} 刷新...`);
    try {
      await refreshUserOAuthToken(user);
    } catch (refreshErr) {
      console.error('[TokenRefresh] Token 刷新失败:', (refreshErr as Error).message);
      res.status(401).json({
        success: false,
        code: 'PINGCODE_AUTH_EXPIRED',
        error: 'PingCode 授权已过期，请重新连接 PingCode',
      });
      return;
    }
    await user.reload();
    req.user = user;
    console.log(`[TokenRefresh] 用户 ${user.id} Token 刷新成功`);
    next();
  } catch (e) {
    console.error('[TokenRefresh] 中间件异常:', (e as Error).message);
    res.status(401).json({
      success: false,
      code: 'PINGCODE_AUTH_EXPIRED',
      error: 'PingCode 授权状态异常，请重新连接',
    });
  }
}

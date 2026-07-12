/**
 * PingCode OAuth 鉴权模块（L2 sdk）。
 *
 * 对照后端 `services/pingcode.ts`：OAuth token 端点（GET /auth/token）**不需要 Bearer**，
 * 因此这些请求经 client 传 `{ auth: false }`（风险备注 §8）。myself 需鉴权。
 *
 * OAuth scope 默认与后端一致：`project:read work_item:write wiki:read`。
 */
import type { PingCodeClient } from '../client.js';
import type { Id } from '../types.js';

/** token 端点响应（动态，仅取所需字段） */
export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  /** 有效期（秒） */
  expires_in?: number;
  token_type?: string;
  scope?: string;
  [k: string]: unknown;
}

/** /myself 返回的用户信息 */
export interface MyselfInfo {
  id?: Id;
  name?: string;
  email?: string;
  username?: string;
  avatar?: string;
  [k: string]: unknown;
}

/** OAuth 默认 scope（与后端一致） */
export const DEFAULT_SCOPE = 'project:read work_item:write wiki:read';

export interface AuthModuleDefaults {
  /** PingCode 开放平台地址（用于构造授权 URL，非 /v1） */
  host: string;
  /** 回调地址 */
  redirectUri?: string;
  /** 默认 scope */
  scope?: string;
}

export interface BuildAuthUrlParams {
  clientId: string;
  redirectUri?: string;
  scope?: string;
  state?: string;
}

export interface TokenByCodeParams {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

export interface ClientCredentialsParams {
  clientId: string;
  clientSecret: string;
}

export interface RefreshParams {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}

/** 构造授权 URL（不发起请求） */
export function buildAuthUrl(host: string, params: BuildAuthUrlParams): string {
  const url = new URL('/oauth2/authorize', host);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  if (params.redirectUri) url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', params.scope ?? DEFAULT_SCOPE);
  if (params.state) url.searchParams.set('state', params.state);
  return url.toString();
}

export function createAuthModule(client: PingCodeClient, defaults: AuthModuleDefaults) {
  return {
    /** 构造授权 URL */
    buildAuthUrl(params: BuildAuthUrlParams): string {
      return buildAuthUrl(defaults.host, {
        redirectUri: params.redirectUri ?? defaults.redirectUri,
        scope: params.scope ?? defaults.scope ?? DEFAULT_SCOPE,
        ...params,
      });
    },

    /** 授权码换 token（auth:false） */
    async getTokenByCode(params: TokenByCodeParams): Promise<TokenResponse> {
      return client.get<TokenResponse>('/auth/token', {
        auth: false,
        params: {
          grant_type: 'authorization_code',
          client_id: params.clientId,
          client_secret: params.clientSecret,
          code: params.code,
          redirect_uri: params.redirectUri ?? defaults.redirectUri,
        },
      });
    },

    /** 企业令牌 client_credentials（auth:false） */
    async getTokenByClientCredentials(params: ClientCredentialsParams): Promise<TokenResponse> {
      return client.get<TokenResponse>('/auth/token', {
        auth: false,
        params: {
          grant_type: 'client_credentials',
          client_id: params.clientId,
          client_secret: params.clientSecret,
        },
      });
    },

    /** refresh_token 刷新（auth:false） */
    async refresh(params: RefreshParams): Promise<TokenResponse> {
      return client.get<TokenResponse>('/auth/token', {
        auth: false,
        params: {
          grant_type: 'refresh_token',
          client_id: params.clientId,
          client_secret: params.clientSecret,
          refresh_token: params.refreshToken,
        },
      });
    },

    /** 当前用户信息（需鉴权） */
    async getMyself(): Promise<MyselfInfo> {
      return client.get<MyselfInfo>('/myself');
    },
  };
}

export type AuthModule = ReturnType<typeof createAuthModule>;

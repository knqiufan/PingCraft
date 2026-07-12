/**
 * `auth` 命令命名空间（L3）。
 *
 * login / token / refresh / whoami / logout / status。
 * login 走 OAuth authorization_code：默认启动本地回调服务器接 code，--no-server 改为手动粘贴。
 */
import type { Command } from 'commander';
import http from 'node:http';
import readline from 'node:readline/promises';
import { randomBytes } from 'node:crypto';
import {
  buildClient,
  buildOutputContext,
  getConnectionOptions,
  runHandler,
  tokenResponseToCredentials,
  type ConnectionOptions,
  type OutputOptions,
} from './shared.js';
import { saveCredentials, clearCredentials, loadCredentials, isExpired } from '../core/auth.js';
import { loadConfig } from '../core/config.js';
import { emitSingle, logProgress } from '../core/output.js';
import { CliError, ExitCode, ErrorCode } from '../core/errors.js';

const DEFAULT_LOGIN_PORT = 9876;
const DEFAULT_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

/** 启动本地 HTTP 服务器等待 OAuth 回调，取回 code */
function listenForCode(port: number, state: string, timeoutMs = DEFAULT_LOGIN_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      if (url.pathname !== '/callback') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('not found');
        return;
      }
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const oauthError = url.searchParams.get('error');
      if (oauthError) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>授权失败</h1><p>${oauthError}</p>`);
        server.close();
        clearTimeout(timer);
        reject(new CliError({ message: `OAuth 授权失败：${oauthError}`, exitCode: ExitCode.GENERIC }));
        return;
      }
      if (!code || returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>回调无效</h1><p>缺少 code 或 state 不匹配。</p>');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>授权成功</h1><p>请返回终端查看结果。</p>');
      server.close();
      clearTimeout(timer);
      resolve(code);
    });
    const timer = setTimeout(() => {
      server.close();
      reject(new CliError({ message: '登录超时（5 分钟内未收到回调）', exitCode: ExitCode.GENERIC }));
    }, timeoutMs);
    timer.unref();
    server.on('error', (e) => {
      clearTimeout(timer);
      reject(new CliError({ message: `本地回调服务器启动失败（端口 ${port}）：${e.message}`, exitCode: ExitCode.GENERIC, cause: e }));
    });
    server.listen(port);
  });
}

async function readCodeFromStdin(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  try {
    const code = (await rl.question('粘贴授权码 (code): ')).trim();
    if (!code) throw new CliError({ message: '未提供授权码', exitCode: ExitCode.ARGS });
    return code;
  } finally {
    rl.close();
  }
}

/** 校验 client 凭证存在，否则抛参数错 */
function requireClientCreds(profile: { clientId?: string; clientSecret?: string }): { clientId: string; clientSecret: string } {
  if (!profile.clientId || !profile.clientSecret) {
    throw new CliError({
      message: '缺少 client_id / client_secret。请通过 --client-id/--client-secret 或环境变量 PINGCODE_CLIENT_ID/PINGCODE_CLIENT_SECRET 提供。',
      code: ErrorCode.ARGS,
      exitCode: ExitCode.ARGS,
    });
  }
  return { clientId: profile.clientId, clientSecret: profile.clientSecret };
}

interface LoginOptions extends OutputOptions, ConnectionOptions {
  port?: string;
  noServer?: boolean;
  scope?: string;
  code?: string;
}

interface TokenOptions extends OutputOptions, ConnectionOptions {
  grant: 'client' | 'user';
  code?: string;
  scope?: string;
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('认证与凭证管理');

  auth
    .command('login')
    .description('通过 OAuth 授权码登录（启动本地回调服务器接收 code）')
    .option('--client-id <id>', 'OAuth client_id（覆盖配置/环境变量）')
    .option('--client-secret <secret>', 'OAuth client_secret')
    .option('--redirect-uri <url>', '回调地址（默认 http://localhost:PORT/callback）')
    .option('--port <n>', '本地回调服务器端口', String(DEFAULT_LOGIN_PORT))
    .option('--scope <scope>', 'OAuth scope')
    .option('--no-server', '不启动本地服务器，改为手动粘贴授权码')
    .option('--code <code>', '直接提供授权码（跳过回调）')
    .option('--json', 'JSON 输出')
    .action((opts: LoginOptions) =>
      runHandler(async () => {
        const conn = { ...getConnectionOptions(auth), ...opts };
        const { profile, auth: authMod } = buildClient(conn);
        const { clientId, clientSecret } = requireClientCreds(profile);
        const out = buildOutputContext(opts);

        let code = opts.code;
        if (!code) {
          const port = Number(opts.port ?? DEFAULT_LOGIN_PORT);
          const redirectUri = opts.redirectUri ?? `http://localhost:${port}/callback`;
          const state = randomBytes(8).toString('hex');
          const url = authMod.buildAuthUrl({ clientId, redirectUri, scope: opts.scope, state });
          if (opts.noServer) {
            logProgress(`请在浏览器打开以下 URL 完成授权，再把回调中的 code 粘贴到终端：\n${url}`);
            code = await readCodeFromStdin();
          } else {
            logProgress(`本地回调服务器监听 http://localhost:${port}/callback …`);
            logProgress(`请打开以下 URL 完成授权：\n${url}`);
            code = await listenForCode(port, state);
          }
        }
        const token = await authMod.getTokenByCode({ code, clientId, clientSecret });
        saveCredentials(profile.name, tokenResponseToCredentials(token));
        logProgress(`已登录（profile=${profile.name}）`);
        emitSingle({ profile: profile.name, expires_in: token.expires_in }, out);
      }),
    );

  auth
    .command('token')
    .description('获取令牌（--grant client 用企业凭证；--grant user 用授权码）')
    .option('--grant <type>', '授权类型：client | user', 'client')
    .option('--client-id <id>', 'OAuth client_id')
    .option('--client-secret <secret>', 'OAuth client_secret')
    .option('--code <code>', '授权码（--grant user 时必填）')
    .option('--scope <scope>', 'OAuth scope')
    .option('--json', 'JSON 输出')
    .action((opts: TokenOptions) =>
      runHandler(async () => {
        const conn = { ...getConnectionOptions(auth), ...opts };
        const { profile, auth: authMod } = buildClient(conn);
        const { clientId, clientSecret } = requireClientCreds(profile);
        const out = buildOutputContext(opts);

        if (opts.grant === 'user') {
          if (!opts.code) throw new CliError({ message: '--grant user 需要 --code <授权码>', code: ErrorCode.ARGS, exitCode: ExitCode.ARGS });
          const token = await authMod.getTokenByCode({ code: opts.code, clientId, clientSecret });
          saveCredentials(profile.name, tokenResponseToCredentials(token));
          emitSingle({ profile: profile.name, grant: 'user', expires_in: token.expires_in }, out);
        } else {
          const token = await authMod.getTokenByClientCredentials({ clientId, clientSecret });
          saveCredentials(profile.name, tokenResponseToCredentials(token));
          emitSingle({ profile: profile.name, grant: 'client', expires_in: token.expires_in }, out);
        }
      }),
    );

  auth
    .command('refresh')
    .description('使用 refresh_token 刷新令牌并落盘')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const conn = getConnectionOptions(auth);
        const { profile, auth: authMod } = buildClient(conn);
        const creds = loadCredentials(profile.name);
        if (!creds.refreshToken) {
          throw new CliError({ message: '当前 profile 无 refresh_token，请重新登录', code: ErrorCode.UNAUTHORIZED, exitCode: ExitCode.UNAUTHORIZED });
        }
        if (!profile.clientId || !profile.clientSecret) {
          throw new CliError({ message: '刷新需要 client_id/client_secret', code: ErrorCode.ARGS, exitCode: ExitCode.ARGS });
        }
        const token = await authMod.refresh({ refreshToken: creds.refreshToken, clientId: profile.clientId, clientSecret: profile.clientSecret });
        saveCredentials(profile.name, tokenResponseToCredentials(token));
        logProgress(`令牌已刷新（profile=${profile.name}）`);
        emitSingle({ profile: profile.name, expires_in: token.expires_in }, buildOutputContext(opts));
      }),
    );

  auth
    .command('whoami')
    .description('显示当前登录用户信息')
    .option('--json', 'JSON 输出')
    .option('--fields <list>', '字段裁剪')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const { auth: authMod } = buildClient(getConnectionOptions(auth));
        const me = await authMod.getMyself();
        emitSingle(me, buildOutputContext(opts));
      }),
    );

  auth
    .command('logout')
    .description('清除当前 profile 的凭证（保留连接配置）')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const conn = getConnectionOptions(auth);
        const profile = loadConfig({ profile: conn.profile });
        clearCredentials(profile.name);
        emitSingle({ profile: profile.name, loggedOut: true }, buildOutputContext(opts));
      }),
    );

  auth
    .command('status')
    .description('查看当前 profile 的凭证状态（不发起请求）')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const conn = getConnectionOptions(auth);
        const profile = loadConfig({ profile: conn.profile });
        const creds = loadCredentials(profile.name);
        emitSingle(
          {
            profile: profile.name,
            host: profile.host,
            authenticated: Boolean(creds.accessToken),
            hasRefreshToken: Boolean(creds.refreshToken),
            expiresAt: creds.expiresAt ?? null,
            expired: creds.expiresAt ? isExpired(creds.expiresAt) : false,
          },
          buildOutputContext(opts),
        );
      }),
    );
}

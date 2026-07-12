/**
 * PingCraft 后端 client（L2 sdk/pingcraft）。
 *
 * 与 PingCode 官方 client 分离：独立 axios 实例，baseURL=`PINGCRAFT_API_URL`，
 * 注入本地 JWT（`profile.pingcraft_token`）。提供 SSE 解析器消费 import-stream。
 */
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';

export interface PingcraftClientOptions {
  /** PingCraft 后端地址，如 http://localhost:3000 */
  baseURL: string;
  /** 取当前 JWT（可能为空——未登录） */
  getToken(): string | undefined;
  /** 请求超时（默认 0=不超时，SSE 流需长连接） */
  timeout?: number;
}

export interface PingcraftClient {
  readonly axios: AxiosInstance;
  get<T = unknown>(url: string, params?: Record<string, unknown>): Promise<T>;
  post<T = unknown>(url: string, body?: unknown): Promise<T>;
  delete<T = unknown>(url: string): Promise<T>;
  /** 流式 POST，返回原始 response（供 SSE 解析） */
  postStream(url: string, body: unknown): Promise<AxiosResponse>;
  /** multipart POST（上传文件分析） */
  postForm<T = unknown>(url: string, formData: FormData): Promise<T>;
}

export function createPingcraftClient(opts: PingcraftClientOptions): PingcraftClient {
  const ax: AxiosInstance = axios.create({
    baseURL: opts.baseURL.replace(/\/$/, ''),
    timeout: opts.timeout ?? 0,
    headers: { Accept: 'application/json' },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  ax.interceptors.request.use((config) => {
    const token = opts.getToken();
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return {
    axios: ax,
    async get<T = unknown>(url: string, params?: Record<string, unknown>): Promise<T> {
      const res = await ax.get<unknown>(url, { params });
      return res.data as T;
    },
    async post<T = unknown>(url: string, body?: unknown): Promise<T> {
      const res = await ax.post<unknown>(url, body);
      return res.data as T;
    },
    async delete<T = unknown>(url: string): Promise<T> {
      const res = await ax.delete<unknown>(url);
      return res.data as T;
    },
    async postStream(url: string, body: unknown): Promise<AxiosResponse> {
      // responseType stream 供 SSE 逐块读取
      return ax.post(url, body, { responseType: 'stream', headers: { Accept: 'text/event-stream' } });
    },
    async postForm<T = unknown>(url: string, formData: FormData): Promise<T> {
      const res = await ax.post<unknown>(url, formData, { headers: { Accept: 'application/json' } });
      return res.data as T;
    },
  };
}

/** SSE 事件 */
export interface SseEvent {
  event: string;
  data: unknown;
}

/**
 * 消费 SSE 流：解析 `event:`/`data:` 行，按事件回调。
 *
 * 兼容 Windows（`\r\n`）与跨块边界。PingCraft import-stream 事件：
 * start / project_created / progress / complete / error。
 */
export async function consumeSSE(
  stream: NodeJS.ReadableStream,
  onEvent: (ev: SseEvent) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let currentEvent = 'message';
    const dispatch = () => {
      // buffer 内可能含多段（以空行分隔）
      const segments = buffer.split(/\r?\n\r?\n/);
      buffer = segments.pop() ?? '';
      for (const seg of segments) {
        if (!seg.trim()) continue;
        let event = currentEvent;
        const dataLines: string[] = [];
        for (const line of seg.split(/\r?\n/)) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        currentEvent = 'message';
        if (dataLines.length) {
          const raw = dataLines.join('\n');
          let data: unknown = raw;
          try {
            data = JSON.parse(raw);
          } catch {
            /* 非 JSON，保留原字符串 */
          }
          onEvent({ event, data });
        }
      }
    };

    stream.on('data', (chunk: Buffer | string) => {
      buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      dispatch();
    });
    stream.on('end', () => {
      if (buffer.trim()) dispatch();
      resolve();
    });
    stream.on('error', reject);
  });
}

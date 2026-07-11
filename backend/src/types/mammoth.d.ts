// mammoth 没有 @types 包，此处提供本项目实际使用的最小类型声明
// 参考：https://www.npmjs.com/package/mammoth
declare module 'mammoth' {
  /** DOCX 转换结果 */
  export interface MammothResult {
    /** 提取出的文本 / HTML */
    value: string;
    /** 转换过程中产生的消息（警告等） */
    messages: Array<{ type: string; message: string }>;
  }

  /** 输入参数：path（文件路径）或 buffer/arrayBuffer */
  export interface ExtractInput {
    path?: string;
    arrayBuffer?: ArrayBuffer;
    buffer?: Buffer;
  }

  /** 提取纯文本 */
  export function extractRawText(input: ExtractInput): Promise<MammothResult>;

  /** 转换为 HTML */
  export function convertToHtml(input: ExtractInput): Promise<MammothResult>;

  /** 图片转换器集合 */
  export const images: {
    imgElement(
      func: (image: unknown) => Promise<Record<string, string>>
    ): unknown;
  };

  const _default: {
    extractRawText: typeof extractRawText;
    convertToHtml: typeof convertToHtml;
    images: typeof images;
  };
  export default _default;
}

import { describe, it, expect, vi } from 'vitest';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
}));

vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(),
  },
}));

import { parseFile } from '../parser.js';
import fs from 'fs/promises';
import mammoth from 'mammoth';

describe('parseFile()', () => {
  it('should read .txt files with fs.readFile', async () => {
    fs.readFile.mockResolvedValue('text content');
    const result = await parseFile('/path/to/file', 'doc.txt');
    expect(result).toBe('text content');
    expect(fs.readFile).toHaveBeenCalledWith('/path/to/file', 'utf-8');
  });

  it('should read .md files with fs.readFile', async () => {
    fs.readFile.mockResolvedValue('# markdown');
    const result = await parseFile('/path/to/file', 'doc.md');
    expect(result).toBe('# markdown');
  });

  it('should read .docx files with mammoth', async () => {
    mammoth.extractRawText.mockResolvedValue({ value: 'docx content' });
    const result = await parseFile('/path/to/file', 'doc.docx');
    expect(result).toBe('docx content');
    expect(mammoth.extractRawText).toHaveBeenCalledWith({ path: '/path/to/file' });
  });

  it('should throw for unsupported formats', async () => {
    await expect(parseFile('/path/to/file', 'doc.pdf')).rejects.toThrow('Unsupported file format');
  });
});

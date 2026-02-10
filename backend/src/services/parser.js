import fs from 'fs/promises';
import mammoth from 'mammoth';
import path from 'path';

export const parseFile = async (filePath, originalName) => {
    const ext = path.extname(originalName).toLowerCase();
    if (ext === '.txt' || ext === '.md') {
        return await fs.readFile(filePath, 'utf-8');
    } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    } else {
        throw new Error('Unsupported file format');
    }
};

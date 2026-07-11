import { describe, it, expect } from 'vitest';
import { chunk } from '../array.js';

describe('chunk()', () => {
  it('should split array into chunks', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('should handle remainder', () => {
    expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });

  it('should handle empty array', () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it('should return single chunk when size >= length', () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });
});

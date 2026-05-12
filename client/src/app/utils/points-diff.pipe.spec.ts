import { describe, expect, it } from 'vitest';
import { PointsDiffPipe } from './points-diff.pipe';

describe('PointsDiffPipe', () => {
  [
    { input: 5.43, output: '↑ 5.4' },
    { input: 0.12, output: '↑ 0.1' },
    { input: 0.04, output: '-' },
    { input: 0, output: '-' },
    { input: undefined, output: '-' },
    { input: -2.78, output: '↓ 2.8' },
    { input: -0.12, output: '↓ 0.1' },
    { input: -0.04, output: '-' },
  ].forEach(({ input, output }) =>
    it(`formats ${input} as ${output}`, () => {
      const pipe = new PointsDiffPipe();
      expect(pipe.transform(input)).toBe(output);
    })
  );
});

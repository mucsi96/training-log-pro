import { describe, expect, it } from 'vitest';
import { DiffColorPipe } from './diff-color.pipe';

describe('DiffColorPipe', () => {
  [
    { input: 0.34566, output: 'green' },
    { input: 0.002, output: 'green' },
    { input: 0.0005, output: undefined },
    { input: undefined, output: undefined },
    { input: -0.31234, output: 'red' },
    { input: -0.002, output: 'red' },
    { input: -0.0005, output: undefined },

    { input: 0.34566, inverse: true, output: 'red' },
    { input: 0.002, inverse: true, output: 'red' },
    { input: 0.0005, inverse: true, output: undefined },
    { input: undefined, inverse: true, output: undefined },
    { input: -0.31234, inverse: true, output: 'green' },
    { input: -0.002, inverse: true, output: 'green' },
    { input: -0.0005, inverse: true, output: undefined },
  ].forEach(({ input, inverse, output }) =>
    it('formats ${output}', () => {
      const pipe = new DiffColorPipe();
      expect(pipe.transform(input, inverse ? 'inverse' : undefined)).toBe(
        output as any
      );
    })
  );
});

import { describe, expect, test } from 'bun:test';
import { forkMainRoutes } from '@/router/forkMainRoutes';

describe('fork routes', () => {
  test('keeps fork-only pages in the fork-owned route table', () => {
    const paths = forkMainRoutes.map((route) => route.path);

    expect(paths).toContain('/model-routes');
    expect(paths).toContain('/prompt-rules');
    expect(paths).toContain('/usage');
  });
});

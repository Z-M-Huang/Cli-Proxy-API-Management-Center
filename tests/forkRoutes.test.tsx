import { describe, expect, test } from 'bun:test';
import { forkMainRoutes } from '@/router/forkMainRoutes';

describe('fork routes', () => {
  test('keeps Prompt Rules and Usage in the fork-owned route table', () => {
    const paths = forkMainRoutes.map((route) => route.path);

    expect(paths).toContain('/prompt-rules');
    expect(paths).toContain('/usage');
  });
});

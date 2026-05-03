import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="chart-line" />,
  Bar: () => <div data-testid="chart-bar" />,
}));

vi.mock('@/services/api/client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    getRaw: vi.fn().mockResolvedValue({ data: {}, headers: {} }),
    postForm: vi.fn().mockResolvedValue({}),
    requestRaw: vi.fn().mockResolvedValue({ data: {}, headers: {} }),
    setConfig: vi.fn(),
  }
}));

import { PromptRulesPage } from '@/pages/PromptRulesPage';
import { UsagePage } from '@/pages/UsagePage';

const cases: ReadonlyArray<{ name: string; element: ReactElement }> = [
  { name: '/prompt-rules', element: <PromptRulesPage /> },
  { name: '/usage', element: <UsagePage /> },
];

const IGNORED_CONSOLE_ERROR_PATTERNS = [/not implemented:/i];

describe('fork-route smoke tests', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
  });

  for (const { name, element } of cases) {
    it(`mounts ${name} without console.error`, () => {
      render(
        <MemoryRouter initialEntries={[name]}>
          <Routes>
            <Route path="*" element={element} />
          </Routes>
        </MemoryRouter>
      );

      const real = errSpy.mock.calls.filter(
        (args) =>
          !IGNORED_CONSOLE_ERROR_PATTERNS.some((pattern) =>
            pattern.test(String(args[0] ?? ''))
          )
      );
      expect(real).toEqual([]);
    });
  }
});

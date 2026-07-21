import type { RouteObject } from 'react-router-dom';
import { ModelRoutesPage } from '@/pages/ModelRoutesPage';
import { PromptRulesPage } from '@/pages/PromptRulesPage';
import { UsagePage } from '@/pages/UsagePage';

// FORK[routes]: isolate backend-fork pages from upstream's route table.
export const forkMainRoutes: RouteObject[] = [
  { path: '/model-routes', element: <ModelRoutesPage /> },
  { path: '/prompt-rules', element: <PromptRulesPage /> },
  { path: '/usage', element: <UsagePage /> },
];

/**
 * Model Routes management API.
 *
 * Backed by /v0/management/model-routes on the paired backend fork. Routes map
 * a client-facing alias to one or more concrete backend models.
 */

import { apiClient } from './client';

export type ModelRouteStrategy = 'priority' | 'round-robin';

export interface ModelRoute {
  alias: string;
  strategy?: ModelRouteStrategy;
  'cooldown-seconds'?: number;
  models: string[];
}

export const MODEL_ROUTE_STRATEGIES: ReadonlyArray<{
  value: ModelRouteStrategy;
  labelKey: string;
}> = [
  { value: 'priority', labelKey: 'model_routes.strategy_priority' },
  { value: 'round-robin', labelKey: 'model_routes.strategy_round_robin' },
] as const;

const ENDPOINT = '/model-routes';

const normalizeRoute = (route: ModelRoute): ModelRoute => ({
  alias: route.alias,
  strategy: route.strategy || 'priority',
  'cooldown-seconds': route['cooldown-seconds'],
  models: Array.isArray(route.models) ? route.models : [],
});

export const modelRoutesApi = {
  async list(): Promise<ModelRoute[]> {
    const data = await apiClient.get<Record<string, unknown>>(ENDPOINT);
    const routes = data['model-routes'];
    return Array.isArray(routes) ? (routes as ModelRoute[]).map(normalizeRoute) : [];
  },

  replace: (routes: ModelRoute[]) =>
    apiClient.put<{ status?: string; 'model-routes'?: ModelRoute[] }>(ENDPOINT, {
      'model-routes': routes,
    }),
};

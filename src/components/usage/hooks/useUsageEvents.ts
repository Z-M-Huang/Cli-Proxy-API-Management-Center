import { useEffect, useMemo, useRef, useState } from 'react';
import { usageApi, type UsageEventRecord, type UsageEventsParams } from '@/services/api/usage';
import { useAuthStore } from '@/stores/useAuthStore';
import type { UsageTimeRange } from '@/utils/usage/types';

const TIME_RANGE_MS: Record<Exclude<UsageTimeRange, 'all'>, number> = {
  '7h': 7 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

const normalizeFacetValues = (values: unknown): string[] =>
  Array.isArray(values)
    ? Array.from(
        new Set(
          values
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b))
    : [];

export interface UsageEventQueryFilters {
  model?: string;
  source?: string;
  authIndex?: string;
  result?: 'success' | 'failed';
}

export interface UsageEventFacets {
  models: string[];
  sources: string[];
  authIndexes: string[];
}

export interface UseUsageEventsOptions {
  timeRange: UsageTimeRange;
  page: number;
  pageSize: number;
  filters: UsageEventQueryFilters;
}

export const buildUsageEventTimeParams = (
  timeRange: UsageTimeRange,
  nowMs: number = Date.now()
): Pick<UsageEventsParams, 'start_time' | 'end_time'> => {
  if (timeRange === 'all') {
    return {};
  }
  return {
    start_time: new Date(nowMs - TIME_RANGE_MS[timeRange]).toISOString(),
    end_time: new Date(nowMs).toISOString(),
  };
};

export function useUsageEvents({ timeRange, page, pageSize, filters }: UseUsageEventsOptions) {
  const scopeKey = useAuthStore((state) => `${state.apiBase}::${state.managementKey}`);
  const [events, setEvents] = useState<UsageEventRecord[]>([]);
  const [facets, setFacets] = useState<UsageEventFacets>({
    models: [],
    sources: [],
    authIndexes: [],
  });
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventRequestId = useRef(0);
  const facetRequestId = useRef(0);
  const timeWindowKey = `${scopeKey}::${timeRange}`;
  const [timeWindow, setTimeWindow] = useState<{
    key: string;
    params: Pick<UsageEventsParams, 'start_time' | 'end_time'>;
  } | null>(null);
  const timeParams = timeWindow?.key === timeWindowKey ? timeWindow.params : null;

  useEffect(() => {
    setEvents([]);
    setTotalCount(0);
    setTotalPages(0);
    setLoading(true);
    setTimeWindow({
      key: timeWindowKey,
      params: buildUsageEventTimeParams(timeRange, Date.now()),
    });
  }, [timeRange, timeWindowKey]);

  const params = useMemo<UsageEventsParams>(
    () => ({
      ...(timeParams ?? {}),
      page,
      page_size: pageSize,
      ...(filters.model ? { model: filters.model } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.authIndex ? { auth_index: filters.authIndex } : {}),
      ...(filters.result ? { result: filters.result } : {}),
    }),
    [filters.authIndex, filters.model, filters.result, filters.source, page, pageSize, timeParams]
  );

  useEffect(() => {
    if (!timeParams) return;
    const requestId = ++eventRequestId.current;
    setLoading(true);
    setError(null);

    void usageApi
      .getUsageEvents(params)
      .then((response) => {
        if (requestId !== eventRequestId.current) return;
        setEvents(Array.isArray(response?.events) ? response.events : []);
        setTotalCount(Number(response?.total_count) || 0);
        setTotalPages(Number(response?.total_pages) || 0);
      })
      .catch((requestError: unknown) => {
        if (requestId !== eventRequestId.current) return;
        setEvents([]);
        setTotalCount(0);
        setTotalPages(0);
        setError(requestError instanceof Error ? requestError.message : String(requestError));
      })
      .finally(() => {
        if (requestId === eventRequestId.current) setLoading(false);
      });

    return () => {
      eventRequestId.current += 1;
    };
  }, [params, scopeKey, timeParams]);

  useEffect(() => {
    if (!timeParams) return;
    const requestId = ++facetRequestId.current;
    void usageApi
      .getUsageEventFilters(timeParams)
      .then((response) => {
        if (requestId !== facetRequestId.current) return;
        setFacets({
          models: normalizeFacetValues(response?.models),
          sources: normalizeFacetValues(response?.sources),
          authIndexes: normalizeFacetValues(response?.auth_indexes),
        });
      })
      .catch((requestError: unknown) => {
        if (requestId !== facetRequestId.current) return;
        console.warn('Failed to load usage-event filters', requestError);
        setFacets({ models: [], sources: [], authIndexes: [] });
      });

    return () => {
      facetRequestId.current += 1;
    };
  }, [scopeKey, timeParams]);

  return {
    events,
    facets,
    totalCount,
    totalPages,
    loading,
    error,
    timeParams: timeParams ?? {},
    queryParams: params,
  };
}

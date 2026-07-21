import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { authFilesApi } from '@/services/api/authFiles';
import { usageApi, type UsageEventRecord } from '@/services/api/usage';
import { useNotificationStore } from '@/stores/useNotificationStore';
import type { AuthFileItem } from '@/types/authFile';
import type { CredentialInfo } from '@/types/sourceInfo';
import { downloadBlob } from '@/utils/download';
import { resolveSourceDisplay, type SourceInfoMap } from '@/utils/sourceResolver';
import { parseTimestampMs } from '@/utils/timestamp';
import { extractTotalTokens, formatDurationMs, LATENCY_SOURCE_FIELD } from '@/utils/usage';
import { normalizeAuthIndex } from '@/utils/usage/identity';
import type { UsageTimeRange } from '@/utils/usage/types';
import styles from '@/pages/UsagePage.module.scss';
import { useUsageEvents } from './hooks/useUsageEvents';
import { RequestEventDetailModal } from './RequestEventDetailModal';

const ALL_FILTER = '__all__';
const PAGE_SIZE = 100;
const EXPORT_PAGE_SIZE = 1000;

type RequestEventRow = {
  id: string;
  timestamp: string;
  timestampMs: number;
  timestampLabel: string;
  requestedModel: string;
  model: string;
  sourceRaw: string;
  source: string;
  sourceType: string;
  authIndex: string;
  failed: boolean;
  latencyMs: number | null;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
  requestId: string | undefined;
};

export interface RequestEventsDetailsCardProps {
  timeRange: UsageTimeRange;
  sourceInfoMap: SourceInfoMap;
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const encodeCsv = (value: string | number): string => {
  const text = String(value ?? '');
  const trimmedLeft = text.replace(/^\s+/, '');
  const safeText = trimmedLeft && /^[=+\-@]/.test(trimmedLeft) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
};

const getEventTokens = (event: UsageEventRecord) => event.tokens ?? {};

export function RequestEventsDetailsCard({
  timeRange,
  sourceInfoMap,
}: RequestEventsDetailsCardProps) {
  const { t, i18n } = useTranslation();
  const { showNotification } = useNotificationStore();
  const [page, setPage] = useState(1);
  const [modelFilter, setModelFilter] = useState(ALL_FILTER);
  const [sourceFilter, setSourceFilter] = useState(ALL_FILTER);
  const [authIndexFilter, setAuthIndexFilter] = useState(ALL_FILTER);
  const [authFileMap, setAuthFileMap] = useState<Map<string, CredentialInfo>>(new Map());
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(
    () => ({
      ...(modelFilter !== ALL_FILTER ? { model: modelFilter } : {}),
      ...(sourceFilter !== ALL_FILTER ? { source: sourceFilter } : {}),
      ...(authIndexFilter !== ALL_FILTER ? { authIndex: authIndexFilter } : {}),
    }),
    [authIndexFilter, modelFilter, sourceFilter]
  );
  const { events, facets, totalCount, totalPages, loading, error, queryParams } = useUsageEvents({
    timeRange,
    page,
    pageSize: PAGE_SIZE,
    filters,
  });

  useEffect(() => {
    setPage(1);
  }, [timeRange]);

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    let cancelled = false;
    void authFilesApi
      .list()
      .then((response) => {
        if (cancelled) return;
        const files = Array.isArray(response)
          ? response
          : (response as { files?: AuthFileItem[] })?.files;
        if (!Array.isArray(files)) return;
        const map = new Map<string, CredentialInfo>();
        files.forEach((file) => {
          const key = normalizeAuthIndex(file.auth_index ?? file.authIndex);
          if (!key) return;
          map.set(key, {
            name: file.name || key,
            type: (file.type || file.provider || '').toString(),
          });
        });
        setAuthFileMap(map);
      })
      .catch((loadError: unknown) => {
        console.warn('Failed to load auth-file labels for usage events', loadError);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toRows = useCallback(
    (records: UsageEventRecord[]): RequestEventRow[] =>
      records.map((event, index) => {
        const timestamp = typeof event.timestamp === 'string' ? event.timestamp : '';
        const timestampMs = parseTimestampMs(timestamp);
        const date = Number.isNaN(timestampMs) ? null : new Date(timestampMs);
        const sourceRaw = String(event.source ?? '').trim();
        const authIndexRaw = event.auth_index;
        const authIndex = authIndexRaw?.trim() || '-';
        const sourceInfo = resolveSourceDisplay(
          sourceRaw,
          authIndexRaw,
          sourceInfoMap,
          authFileMap
        );
        const tokens = getEventTokens(event);
        const requestId = event.request_id?.trim() || undefined;

        return {
          id:
            event.id === undefined
              ? `${timestamp}-${event.model ?? ''}-${index}`
              : String(event.id),
          timestamp,
          timestampMs: Number.isNaN(timestampMs) ? 0 : timestampMs,
          timestampLabel: date ? date.toLocaleString(i18n.language) : timestamp || '-',
          requestedModel: event.requested_model?.trim() || '',
          model: event.model?.trim() || '-',
          sourceRaw: sourceRaw || '-',
          source: sourceInfo.displayName,
          sourceType: sourceInfo.type,
          authIndex,
          failed: event.failed === true,
          latencyMs: Number.isFinite(Number(event.latency_ms)) ? Number(event.latency_ms) : null,
          inputTokens: Math.max(toNumber(tokens.input_tokens), 0),
          outputTokens: Math.max(toNumber(tokens.output_tokens), 0),
          reasoningTokens: Math.max(toNumber(tokens.reasoning_tokens), 0),
          cachedTokens: Math.max(
            Math.max(toNumber(tokens.cached_tokens), 0),
            Math.max(toNumber(tokens.cache_read_tokens), 0)
          ),
          totalTokens: Math.max(toNumber(tokens.total_tokens), extractTotalTokens({ tokens })),
          requestId,
        };
      }),
    [authFileMap, i18n.language, sourceInfoMap]
  );

  const rows = useMemo(() => toRows(events), [events, toRows]);
  const hasLatencyData = rows.some((row) => row.latencyMs !== null);
  const latencyHint = t('usage_stats.latency_unit_hint', {
    field: LATENCY_SOURCE_FIELD,
    unit: t('usage_stats.duration_unit_ms'),
  });

  const sourceLabel = (source: string) =>
    resolveSourceDisplay(source, null, sourceInfoMap, authFileMap).displayName;
  const withCurrentOption = (values: string[], current: string) =>
    current !== ALL_FILTER && !values.includes(current) ? [current, ...values] : values;
  const modelOptions = [
    { value: ALL_FILTER, label: t('usage_stats.filter_all') },
    ...withCurrentOption(facets.models, modelFilter).map((model) => ({
      value: model,
      label: model,
    })),
  ];
  const sourceOptions = [
    { value: ALL_FILTER, label: t('usage_stats.filter_all') },
    ...withCurrentOption(facets.sources, sourceFilter).map((source) => ({
      value: source,
      label: sourceLabel(source),
    })),
  ];
  const authIndexOptions = [
    { value: ALL_FILTER, label: t('usage_stats.filter_all') },
    ...withCurrentOption(facets.authIndexes, authIndexFilter).map((authIndex) => ({
      value: authIndex,
      label: authIndex,
    })),
  ];
  const hasActiveFilters =
    modelFilter !== ALL_FILTER || sourceFilter !== ALL_FILTER || authIndexFilter !== ALL_FILTER;

  const updateFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };
  const handleClearFilters = () => {
    setModelFilter(ALL_FILTER);
    setSourceFilter(ALL_FILTER);
    setAuthIndexFilter(ALL_FILTER);
    setPage(1);
  };

  const fetchAllFilteredEvents = async (): Promise<UsageEventRecord[]> => {
    const allEvents: UsageEventRecord[] = [];
    let exportPage = 1;
    let expectedPages: number;
    do {
      const response = await usageApi.getUsageEvents({
        ...queryParams,
        page: exportPage,
        page_size: EXPORT_PAGE_SIZE,
      });
      const batch = Array.isArray(response?.events) ? response.events : [];
      allEvents.push(...batch);
      expectedPages = Math.max(Number(response?.total_pages) || 0, batch.length ? 1 : 0);
      exportPage += 1;
    } while (exportPage <= expectedPages);
    return allEvents;
  };

  const exportRows = async (format: 'csv' | 'json') => {
    if (totalCount === 0 || exporting) return;
    setExporting(true);
    try {
      const exportEvents = await fetchAllFilteredEvents();
      const projectedRows = toRows(exportEvents);
      const fileTime = new Date().toISOString().replace(/[:.]/g, '-');
      if (format === 'json') {
        downloadBlob({
          filename: `usage-events-${fileTime}.json`,
          blob: new Blob([JSON.stringify(exportEvents, null, 2)], {
            type: 'application/json;charset=utf-8',
          }),
        });
        return;
      }

      const header = [
        'timestamp',
        'requested_model',
        'model',
        'source',
        'source_raw',
        'auth_index',
        'result',
        'latency_ms',
        'input_tokens',
        'output_tokens',
        'reasoning_tokens',
        'cached_tokens',
        'total_tokens',
        'request_id',
      ];
      const body = projectedRows.map((row) =>
        [
          row.timestamp,
          row.requestedModel,
          row.model,
          row.source,
          row.sourceRaw,
          row.authIndex,
          row.failed ? 'failed' : 'success',
          row.latencyMs ?? '',
          row.inputTokens,
          row.outputTokens,
          row.reasoningTokens,
          row.cachedTokens,
          row.totalTokens,
          row.requestId ?? '',
        ]
          .map(encodeCsv)
          .join(',')
      );
      downloadBlob({
        filename: `usage-events-${fileTime}.csv`,
        blob: new Blob([[header.join(','), ...body].join('\n')], {
          type: 'text/csv;charset=utf-8',
        }),
      });
    } catch (exportError: unknown) {
      const message = exportError instanceof Error ? exportError.message : String(exportError);
      showNotification(`${t('notification.download_failed')}: ${message}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card
      title={t('usage_stats.request_events_title')}
      extra={
        <div className={styles.requestEventsActions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
          >
            {t('usage_stats.clear_filters')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void exportRows('csv')}
            disabled={totalCount === 0}
            loading={exporting}
          >
            {t('usage_stats.export_csv')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void exportRows('json')}
            disabled={totalCount === 0}
            loading={exporting}
          >
            {t('usage_stats.export_json')}
          </Button>
        </div>
      }
    >
      <div className={styles.requestEventsToolbar}>
        <div className={styles.requestEventsFilterItem}>
          <span className={styles.requestEventsFilterLabel}>
            {t('usage_stats.request_events_filter_model')}
          </span>
          <Select
            value={modelFilter}
            options={modelOptions}
            onChange={updateFilter(setModelFilter)}
            className={styles.requestEventsSelect}
            ariaLabel={t('usage_stats.request_events_filter_model')}
            fullWidth={false}
          />
        </div>
        <div className={styles.requestEventsFilterItem}>
          <span className={styles.requestEventsFilterLabel}>
            {t('usage_stats.request_events_filter_source')}
          </span>
          <Select
            value={sourceFilter}
            options={sourceOptions}
            onChange={updateFilter(setSourceFilter)}
            className={styles.requestEventsSelect}
            ariaLabel={t('usage_stats.request_events_filter_source')}
            fullWidth={false}
          />
        </div>
        <div className={styles.requestEventsFilterItem}>
          <span className={styles.requestEventsFilterLabel}>
            {t('usage_stats.request_events_filter_auth_index')}
          </span>
          <Select
            value={authIndexFilter}
            options={authIndexOptions}
            onChange={updateFilter(setAuthIndexFilter)}
            className={styles.requestEventsSelect}
            ariaLabel={t('usage_stats.request_events_filter_auth_index')}
            fullWidth={false}
          />
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className={styles.hint}>{t('common.loading')}</div>
      ) : error ? (
        <EmptyState title={t('usage_stats.loading_error')} description={error} />
      ) : totalCount === 0 ? (
        <EmptyState
          title={
            hasActiveFilters
              ? t('usage_stats.request_events_no_result_title')
              : t('usage_stats.request_events_empty_title')
          }
          description={
            hasActiveFilters
              ? t('usage_stats.request_events_no_result_desc')
              : t('usage_stats.request_events_empty_desc')
          }
        />
      ) : (
        <>
          <div className={styles.requestEventsMeta}>
            <span>{t('usage_stats.request_events_count', { count: totalCount })}</span>
            {hasLatencyData && <span className={styles.requestEventsLimitHint}>{latencyHint}</span>}
          </div>

          <div className={styles.requestEventsTableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('usage_stats.request_events_timestamp')}</th>
                  <th>{t('usage_stats.requested_model')}</th>
                  <th>{t('usage_stats.model_name')}</th>
                  <th>{t('usage_stats.request_events_source')}</th>
                  <th>{t('usage_stats.request_events_auth_index')}</th>
                  <th>{t('usage_stats.request_events_result')}</th>
                  {hasLatencyData && <th title={latencyHint}>{t('usage_stats.time')}</th>}
                  <th>{t('usage_stats.input_tokens')}</th>
                  <th>{t('usage_stats.output_tokens')}</th>
                  <th>{t('usage_stats.reasoning_tokens')}</th>
                  <th>{t('usage_stats.cached_tokens')}</th>
                  <th>{t('usage_stats.total_tokens')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const clickable = Boolean(row.requestId);
                  const openModal = () => {
                    if (row.requestId) setActiveRequestId(row.requestId);
                  };
                  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (!clickable) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openModal();
                    }
                  };
                  const rowTitle = clickable
                    ? t('usage_stats.event_detail.row_hint', { id: row.requestId })
                    : t('usage_stats.event_detail.row_unavailable');
                  return (
                    <tr
                      key={row.id}
                      className={clickable ? styles.clickableRow : undefined}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      aria-label={clickable ? rowTitle : undefined}
                      title={!clickable ? rowTitle : undefined}
                      onClick={clickable ? openModal : undefined}
                      onKeyDown={clickable ? handleKeyDown : undefined}
                    >
                      <td title={row.timestamp} className={styles.requestEventsTimestamp}>
                        {row.timestampLabel}
                      </td>
                      <td className={styles.modelCell}>{row.requestedModel || '-'}</td>
                      <td className={styles.modelCell}>{row.model}</td>
                      <td className={styles.requestEventsSourceCell} title={row.source}>
                        <span>{row.source}</span>
                        {row.sourceType && (
                          <span className={styles.credentialType}>{row.sourceType}</span>
                        )}
                      </td>
                      <td className={styles.requestEventsAuthIndex} title={row.authIndex}>
                        {row.authIndex}
                      </td>
                      <td>
                        <span
                          className={
                            row.failed
                              ? styles.requestEventsResultFailed
                              : styles.requestEventsResultSuccess
                          }
                        >
                          {row.failed ? t('stats.failure') : t('stats.success')}
                        </span>
                      </td>
                      {hasLatencyData && (
                        <td className={styles.durationCell}>{formatDurationMs(row.latencyMs)}</td>
                      )}
                      <td>{row.inputTokens.toLocaleString()}</td>
                      <td>{row.outputTokens.toLocaleString()}</td>
                      <td>{row.reasoningTokens.toLocaleString()}</td>
                      <td>{row.cachedTokens.toLocaleString()}</td>
                      <td>{row.totalTokens.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.requestEventsPagination}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
            >
              {t('usage_stats.request_events_previous')}
            </Button>
            <span>
              {t('usage_stats.request_events_page', {
                current: page,
                total: Math.max(totalPages, 1),
              })}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages || loading}
            >
              {t('usage_stats.request_events_next')}
            </Button>
          </div>
        </>
      )}
      <RequestEventDetailModal
        requestId={activeRequestId}
        onClose={() => setActiveRequestId(null)}
      />
    </Card>
  );
}

import { describe, expect, it } from 'bun:test';
import {
  buildDailySeriesByModel,
  calculateLatencyStats,
  getModelStats,
} from '@/utils/usage/analytics';
import { collectUsageDetails, filterUsageByTimeRange } from '@/utils/usage/details';
import { computeKeyStatsFromDetails } from '@/utils/usage/keyStats';

const usageRollupFixture = {
  total_requests: 6,
  success_count: 4,
  failure_count: 2,
  total_tokens: 180,
  apis: {
    'POST /v1/chat/completions': {
      total_requests: 6,
      success_count: 4,
      failure_count: 2,
      total_tokens: 180,
      models: {
        'gpt-4o-mini': {
          total_requests: 6,
          total_tokens: 180,
          details: [
            {
              timestamp: '2026-07-11T10:00:00.000Z',
              source: 'prefix-a',
              auth_index: 'auth-a',
              failed: false,
              request_count: 4,
              latency_ms: 100,
              latency_total_ms: 400,
              latency_sample_count: 4,
              tokens: {
                input_tokens: 80,
                output_tokens: 40,
                reasoning_tokens: 0,
                cached_tokens: 0,
                total_tokens: 120,
              },
            },
            {
              timestamp: '2026-07-11T10:15:00.000Z',
              source: 'prefix-a',
              auth_index: 'auth-a',
              failed: true,
              request_count: 2,
              latency_ms: 300,
              latency_total_ms: 600,
              latency_sample_count: 2,
              tokens: {
                input_tokens: 40,
                output_tokens: 20,
                reasoning_tokens: 0,
                cached_tokens: 0,
                total_tokens: 60,
              },
            },
          ],
        },
      },
    },
  },
};

describe('persisted usage rollups', () => {
  it('weights request, result, and latency metrics by aggregate counts', () => {
    const details = collectUsageDetails(usageRollupFixture);
    const keyStats = computeKeyStatsFromDetails(details);
    const sourceStats = keyStats.bySource[details[0].source];
    const latency = calculateLatencyStats(usageRollupFixture);
    const [modelStats] = getModelStats(usageRollupFixture, {});

    expect(sourceStats).toEqual({ success: 4, failure: 2 });
    expect(keyStats.byAuthIndex['auth-a']).toEqual({ success: 4, failure: 2 });
    expect(latency).toEqual({ averageMs: 1000 / 6, totalMs: 1000, sampleCount: 6 });
    expect(modelStats).toMatchObject({
      requests: 6,
      successCount: 4,
      failureCount: 2,
      averageLatencyMs: 1000 / 6,
      latencySampleCount: 6,
    });
  });

  it('preserves aggregate counts when filtering and charting rollup buckets', () => {
    const filtered = filterUsageByTimeRange(
      usageRollupFixture,
      '24h',
      Date.parse('2026-07-11T11:00:00.000Z')
    );
    const daily = buildDailySeriesByModel(filtered, 'requests');

    expect(filtered).toMatchObject({
      total_requests: 6,
      success_count: 4,
      failure_count: 2,
      total_tokens: 180,
    });
    expect(daily.labels).toEqual(['2026-07-11']);
    expect(daily.dataByModel.get('gpt-4o-mini')).toEqual([6]);
  });
});

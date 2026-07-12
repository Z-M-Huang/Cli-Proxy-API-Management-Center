import { describe, expect, it } from 'bun:test';
import {
  collectUsageDetailsForAuthIndices,
  collectUsageDetailsForCandidates,
  indexUsageDetailsByAuthIndex,
  indexUsageDetailsBySource,
} from '@/utils/usageIndex';
import { collectUsageDetails } from '@/utils/usage/details';
import type { UsageDetail } from '@/utils/usage/types';

const usageFixture = {
  apis: {
    'POST /v1/chat/completions': {
      models: {
        'gpt-4o-mini': {
          details: [
            {
              timestamp: '2026-05-03T11:40:00.000Z',
              source: 'sk-test-alpha-123456',
              auth_index: 'auth-a',
              failed: false,
              tokens: {
                input_tokens: 10,
                output_tokens: 20,
                reasoning_tokens: 3,
                cached_tokens: 0,
                total_tokens: 33,
              },
            },
            {
              timestamp: '2026-05-03T11:41:00.000Z',
              source: 'prefix-a',
              auth_index: 'auth-a',
              failed: true,
              tokens: {
                input_tokens: 5,
                output_tokens: 0,
                reasoning_tokens: 0,
                cached_tokens: 0,
                total_tokens: 5,
              },
            },
          ],
        },
      },
    },
    'POST /v1/messages': {
      models: {
        'claude-3-7-sonnet': {
          details: [
            {
              timestamp: '2026-05-03T11:42:00.000Z',
              source: 'prefix-b',
              authIndex: 7,
              failed: false,
              tokens: {
                input_tokens: 7,
                output_tokens: 8,
                reasoning_tokens: 1,
                cached_tokens: 2,
                total_tokens: 18,
              },
            },
            {
              timestamp: '2026-05-03T11:43:00.000Z',
              source: 'sk-test-alpha-123456',
              auth_index: 'auth-b',
              failed: false,
              tokens: {
                input_tokens: 9,
                output_tokens: 6,
                reasoning_tokens: 0,
                cached_tokens: 0,
                total_tokens: 15,
              },
            },
          ],
        },
      },
    },
  },
};

const serializeDetails = (details: UsageDetail[]) =>
  details.map((detail) => ({
    source: detail.source,
    auth_index: detail.auth_index,
    model: detail.__modelName,
    failed: detail.failed,
    total_tokens: detail.tokens.total_tokens,
  }));

const serializeMap = (map: Map<string, UsageDetail[]>) =>
  Object.fromEntries(
    Array.from(map.entries()).map(([key, details]) => [key, serializeDetails(details)])
  );

describe('usageIndex snapshots', () => {
  it('indexes usage details by source and auth index', () => {
    const usageDetails = collectUsageDetails(usageFixture);
    const bySource = indexUsageDetailsBySource(usageDetails);
    const byAuthIndex = indexUsageDetailsByAuthIndex(usageDetails);
    const sourceKeys = Array.from(bySource.keys());
    const authKeys = Array.from(byAuthIndex.keys());

    expect({
      usageDetails: serializeDetails(usageDetails),
      bySource: serializeMap(bySource),
      byAuthIndex: serializeMap(byAuthIndex),
      candidateSlice: serializeDetails(
        collectUsageDetailsForCandidates(bySource, [sourceKeys[1], 'missing', sourceKeys[0]])
      ),
      authIndexSlice: serializeDetails(
        collectUsageDetailsForAuthIndices(byAuthIndex, [authKeys[1], 'missing', authKeys[0]])
      ),
    }).toMatchSnapshot();
  });
});

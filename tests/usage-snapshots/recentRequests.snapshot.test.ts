import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  mergeRecentRequestBucketGroups,
  normalizeRecentRequestBuckets,
  normalizeRecentRequestUsageEntry,
  statusBarDataFromRecentRequests,
} from '@/utils/recentRequests';

describe('recentRequests snapshots', () => {
  const realDateNow = Date.now;

  beforeEach(() => {
    Date.now = () => new Date('2026-05-03T12:00:00.000Z').getTime();
  });

  afterEach(() => {
    Date.now = realDateNow;
  });

  it('normalizes bucket fixtures', () => {
    const fixture = [
      { time: '2026-05-03T10:00:00Z', success: '2', failed: 1 },
      { time: '2026-05-03T10:10:00Z', success: null, failed: '4' },
      { success: 5, failed: undefined },
      { success: Number.NaN, failed: Number.POSITIVE_INFINITY },
    ];

    expect(normalizeRecentRequestBuckets(fixture)).toMatchSnapshot();
  });

  it('normalizes usage-entry fixtures', () => {
    const fixture = {
      success: '9',
      failed: '3',
      recent_requests: [
        { time: '2026-05-03T10:00:00Z', success: 2, failed: 0 },
        { time: '2026-05-03T10:10:00Z', success: '1', failed: '2' },
      ],
    };

    expect(normalizeRecentRequestUsageEntry(fixture)).toMatchSnapshot();
  });

  it('merges aligned bucket groups', () => {
    const groups = [
      [
        { time: '2026-05-03T10:00:00Z', success: 3, failed: 0 },
        { time: '2026-05-03T10:10:00Z', success: 2, failed: 1 },
      ],
      [
        { time: '2026-05-03T09:50:00Z', success: 1, failed: 0 },
        { time: '2026-05-03T10:00:00Z', success: 0, failed: 2 },
        { time: '2026-05-03T10:10:00Z', success: 4, failed: 0 },
      ],
    ];

    expect(mergeRecentRequestBucketGroups(groups)).toMatchSnapshot();
  });

  it('builds status-bar data from recent buckets', () => {
    const buckets = [
      { time: '2026-05-03T11:20:00Z', success: 2, failed: 0 },
      { time: '2026-05-03T11:30:00Z', success: 0, failed: 1 },
      { time: '2026-05-03T11:40:00Z', success: 3, failed: 2 },
      { time: '2026-05-03T11:50:00Z', success: 0, failed: 0 },
    ];

    expect(statusBarDataFromRecentRequests(buckets)).toMatchSnapshot();
  });
});

/**
 * 使用统计相关 API
 */

import { apiClient } from './client';
import { computeKeyStats } from '@/utils/usage/keyStats';
import type { KeyStats } from '@/utils/usage/types';

const USAGE_TIMEOUT_MS = 60 * 1000;

export interface UsageExportPayload {
  version?: number;
  exported_at?: string;
  usage?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UsageImportResponse {
  added?: number;
  skipped?: number;
  total_requests?: number;
  failed_requests?: number;
  [key: string]: unknown;
}

export interface UsageEventRecord {
  id?: number;
  timestamp?: string;
  api_group_key?: string;
  provider?: string;
  endpoint?: string;
  auth_type?: string;
  request_id?: string;
  model?: string;
  source?: string;
  auth_index?: string;
  failed?: boolean;
  latency_ms?: number;
  tokens?: Record<string, number>;
}

export interface UsageEventsResponse {
  events?: UsageEventRecord[];
  models?: string[];
  sources?: string[];
  auth_indexes?: string[];
  total_count?: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
  [key: string]: unknown;
}

export interface UsageEventsParams {
  page?: number;
  page_size?: number;
  start_time?: string;
  end_time?: string;
  model?: string;
  source?: string;
  auth_index?: string;
  result?: 'success' | 'failed';
}

export interface UsageEventFiltersResponse {
  models?: string[];
  sources?: string[];
  auth_indexes?: string[];
}

export const usageApi = {
  /**
   * 获取使用统计原始数据
   */
  getUsage: () => apiClient.get<Record<string, unknown>>('/usage', { timeout: USAGE_TIMEOUT_MS }),

  /**
   * 获取由持久化汇总表生成的使用统计
   */
  getUsageOverview: () =>
    apiClient.get<Record<string, unknown>>('/usage/overview', { timeout: USAGE_TIMEOUT_MS }),

  /**
   * 获取持久化使用事件
   */
  getUsageEvents: (params?: UsageEventsParams) =>
    apiClient.get<UsageEventsResponse>('/usage/events', { params, timeout: USAGE_TIMEOUT_MS }),

  /**
   * 获取持久化使用事件筛选项
   */
  getUsageEventFilters: (params?: Pick<UsageEventsParams, 'start_time' | 'end_time'>) =>
    apiClient.get<UsageEventFiltersResponse>('/usage/events/filters', {
      params,
      timeout: USAGE_TIMEOUT_MS,
    }),

  /**
   * 导出使用统计快照
   */
  exportUsage: () =>
    apiClient.get<UsageExportPayload>('/usage/export', { timeout: USAGE_TIMEOUT_MS }),

  /**
   * 导入使用统计快照
   */
  importUsage: (payload: unknown) =>
    apiClient.post<UsageImportResponse>('/usage/import', payload, { timeout: USAGE_TIMEOUT_MS }),

  /**
   * 计算密钥成功/失败统计，必要时会先获取 usage 数据
   */
  async getKeyStats(usageData?: unknown): Promise<KeyStats> {
    let payload = usageData;
    if (!payload) {
      const response = await usageApi.getUsageOverview();
      payload = response?.usage ?? response;
    }
    return computeKeyStats(payload);
  },
};

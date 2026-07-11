/**
 * 使用统计相关工具
 * 迁移自基线 modules/usage.js 的纯逻辑部分
 */

import type { ScriptableContext } from 'chart.js';
import type { LatencyAccumulator, LatencyStats } from './latency';
import {
  addLatencyDetail,
  calculateLatencyStatsFromDetails,
  createLatencyAccumulator,
  finalizeLatencyStats,
} from './latency';
import { collectUsageDetails, extractTotalTokens, getUsageRequestCount } from './details';
import { maskUsageSensitiveValue } from './identity';
import type {
  ApiStats,
  ChartData,
  ChartDataset,
  CostSeries,
  ModelPrice,
  ModelStatsSummary,
  RateStats,
  ServiceHealthData,
  StatusBarData,
  StatusBlockDetail,
  StatusBlockState,
  TokenBreakdown,
  TokenBreakdownSeries,
  TokenCategory,
  UsageDetail,
} from './types';
import { parseTimestampMs } from '../timestamp';

const TOKENS_PER_PRICE_UNIT = 1_000_000;
const MODEL_PRICE_STORAGE_KEY = 'cli-proxy-model-prices-v2';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const getApisRecord = (usageData: unknown): Record<string, unknown> | null => {
  const usageRecord = isRecord(usageData) ? usageData : null;
  const apisRaw = usageRecord ? usageRecord.apis : null;
  return isRecord(apisRaw) ? apisRaw : null;
};

/**
 * 格式化每分钟数值
 */
export function formatPerMinuteValue(value: number): string {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return '0.00';
  }
  const abs = Math.abs(num);
  if (abs >= 1000) {
    return Math.round(num).toLocaleString();
  }
  if (abs >= 100) {
    return num.toFixed(0);
  }
  if (abs >= 10) {
    return num.toFixed(1);
  }
  return num.toFixed(2);
}

/**
 * 格式化紧凑数字
 */
export function formatCompactNumber(value: number): string {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return '0';
  }
  const abs = Math.abs(num);
  if (abs >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return abs >= 1 ? num.toFixed(0) : num.toFixed(2);
}

/**
 * 格式化美元
 */
export function formatUsd(value: number): string {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return '$0.00';
  }
  const fixed = num.toFixed(2);
  const parts = Number(fixed).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${parts}`;
}

export function calculateLatencyStats(usageData: unknown): LatencyStats {
  return calculateLatencyStatsFromDetails(collectUsageDetails(usageData));
}

/**
 * 计算 token 分类统计
 */
export function calculateTokenBreakdown(usageData: unknown): TokenBreakdown {
  const details = collectUsageDetails(usageData);
  if (!details.length) {
    return { cachedTokens: 0, reasoningTokens: 0 };
  }

  let cachedTokens = 0;
  let reasoningTokens = 0;

  details.forEach((detail) => {
    const tokens = detail.tokens;
    cachedTokens += Math.max(
      typeof tokens.cached_tokens === 'number' ? Math.max(tokens.cached_tokens, 0) : 0,
      typeof tokens.cache_tokens === 'number' ? Math.max(tokens.cache_tokens, 0) : 0
    );
    if (typeof tokens.reasoning_tokens === 'number') {
      reasoningTokens += tokens.reasoning_tokens;
    }
  });

  return { cachedTokens, reasoningTokens };
}

/**
 * 计算最近 N 分钟的 RPM/TPM
 */
export function calculateRecentPerMinuteRates(
  windowMinutes: number = 30,
  usageData: unknown
): RateStats {
  const details = collectUsageDetails(usageData);
  const effectiveWindow = Number.isFinite(windowMinutes) && windowMinutes > 0 ? windowMinutes : 30;

  if (!details.length) {
    return { rpm: 0, tpm: 0, windowMinutes: effectiveWindow, requestCount: 0, tokenCount: 0 };
  }

  const now = Date.now();
  const windowStart = now - effectiveWindow * 60 * 1000;
  let requestCount = 0;
  let tokenCount = 0;

  details.forEach((detail) => {
    const timestamp =
      typeof detail.__timestampMs === 'number'
        ? detail.__timestampMs
        : parseTimestampMs(detail.timestamp);
    if (!Number.isFinite(timestamp) || timestamp < windowStart || timestamp > now) {
      return;
    }
    requestCount += getUsageRequestCount(detail);
    tokenCount += extractTotalTokens(detail);
  });

  const denominator = effectiveWindow > 0 ? effectiveWindow : 1;
  return {
    rpm: requestCount / denominator,
    tpm: tokenCount / denominator,
    windowMinutes: effectiveWindow,
    requestCount,
    tokenCount,
  };
}

/**
 * 计算成本数据
 */
export function calculateCost(
  detail: UsageDetail,
  modelPrices: Record<string, ModelPrice>
): number {
  const modelName = detail.__modelName || '';
  const price = modelPrices[modelName];
  if (!price) {
    return 0;
  }
  const tokens = detail.tokens;
  const rawInputTokens = Number(tokens.input_tokens);
  const rawCompletionTokens = Number(tokens.output_tokens);
  const rawCachedTokensPrimary = Number(tokens.cached_tokens);
  const rawCachedTokensAlternate = Number(tokens.cache_tokens);

  const inputTokens = Number.isFinite(rawInputTokens) ? Math.max(rawInputTokens, 0) : 0;
  const completionTokens = Number.isFinite(rawCompletionTokens)
    ? Math.max(rawCompletionTokens, 0)
    : 0;
  const cachedTokens = Math.max(
    Number.isFinite(rawCachedTokensPrimary) ? Math.max(rawCachedTokensPrimary, 0) : 0,
    Number.isFinite(rawCachedTokensAlternate) ? Math.max(rawCachedTokensAlternate, 0) : 0
  );
  const promptTokens = Math.max(inputTokens - cachedTokens, 0);

  const promptCost = (promptTokens / TOKENS_PER_PRICE_UNIT) * (Number(price.prompt) || 0);
  const cachedCost = (cachedTokens / TOKENS_PER_PRICE_UNIT) * (Number(price.cache) || 0);
  const completionCost =
    (completionTokens / TOKENS_PER_PRICE_UNIT) * (Number(price.completion) || 0);
  const total = promptCost + cachedCost + completionCost;
  return Number.isFinite(total) && total > 0 ? total : 0;
}

/**
 * 计算总成本
 */
export function calculateTotalCost(
  usageData: unknown,
  modelPrices: Record<string, ModelPrice>
): number {
  const details = collectUsageDetails(usageData);
  if (!details.length || !Object.keys(modelPrices).length) {
    return 0;
  }
  return details.reduce((sum, detail) => sum + calculateCost(detail, modelPrices), 0);
}

/**
 * 从 localStorage 加载模型价格
 */
export function loadModelPrices(): Record<string, ModelPrice> {
  try {
    if (typeof localStorage === 'undefined') {
      return {};
    }
    const raw = localStorage.getItem(MODEL_PRICE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return {};
    }
    const normalized: Record<string, ModelPrice> = {};
    Object.entries(parsed).forEach(([model, price]: [string, unknown]) => {
      if (!model) return;
      const priceRecord = isRecord(price) ? price : null;
      const promptRaw = Number(priceRecord?.prompt);
      const completionRaw = Number(priceRecord?.completion);
      const cacheRaw = Number(priceRecord?.cache);

      if (
        !Number.isFinite(promptRaw) &&
        !Number.isFinite(completionRaw) &&
        !Number.isFinite(cacheRaw)
      ) {
        return;
      }

      const prompt = Number.isFinite(promptRaw) && promptRaw >= 0 ? promptRaw : 0;
      const completion = Number.isFinite(completionRaw) && completionRaw >= 0 ? completionRaw : 0;
      const cache =
        Number.isFinite(cacheRaw) && cacheRaw >= 0
          ? cacheRaw
          : Number.isFinite(promptRaw) && promptRaw >= 0
            ? promptRaw
            : prompt;

      normalized[model] = {
        prompt,
        completion,
        cache,
      };
    });
    return normalized;
  } catch {
    return {};
  }
}

/**
 * 保存模型价格到 localStorage
 */
export function saveModelPrices(prices: Record<string, ModelPrice>): void {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(MODEL_PRICE_STORAGE_KEY, JSON.stringify(prices));
  } catch {
    console.warn('保存模型价格失败');
  }
}

/**
 * 获取 API 统计数据
 */
export function getApiStats(
  usageData: unknown,
  modelPrices: Record<string, ModelPrice>
): ApiStats[] {
  const apis = getApisRecord(usageData);
  if (!apis) return [];
  const result: ApiStats[] = [];

  Object.entries(apis).forEach(([endpoint, apiData]) => {
    if (!isRecord(apiData)) return;
    const models: Record<
      string,
      { requests: number; successCount: number; failureCount: number; tokens: number }
    > = {};
    let derivedSuccessCount = 0;
    let derivedFailureCount = 0;
    let totalCost = 0;

    const modelsData = isRecord(apiData.models) ? apiData.models : {};
    Object.entries(modelsData).forEach(([modelName, modelData]) => {
      if (!isRecord(modelData)) return;
      const details = Array.isArray(modelData.details) ? modelData.details : [];
      const hasExplicitCounts =
        typeof modelData.success_count === 'number' || typeof modelData.failure_count === 'number';

      let successCount = 0;
      let failureCount = 0;
      if (hasExplicitCounts) {
        successCount += Number(modelData.success_count) || 0;
        failureCount += Number(modelData.failure_count) || 0;
      }

      const price = modelPrices[modelName];
      if (details.length > 0 && (!hasExplicitCounts || price)) {
        details.forEach((detail) => {
          const detailRecord = isRecord(detail) ? detail : null;
          if (!hasExplicitCounts) {
            const requestCount = getUsageRequestCount(detailRecord);
            if (detailRecord?.failed === true) {
              failureCount += requestCount;
            } else {
              successCount += requestCount;
            }
          }

          if (price && detailRecord) {
            totalCost += calculateCost(
              { ...(detailRecord as unknown as UsageDetail), __modelName: modelName },
              modelPrices
            );
          }
        });
      }

      models[modelName] = {
        requests: Number(modelData.total_requests) || 0,
        successCount,
        failureCount,
        tokens: Number(modelData.total_tokens) || 0,
      };
      derivedSuccessCount += successCount;
      derivedFailureCount += failureCount;
    });

    const hasApiExplicitCounts =
      typeof apiData.success_count === 'number' || typeof apiData.failure_count === 'number';
    const successCount = hasApiExplicitCounts
      ? Number(apiData.success_count) || 0
      : derivedSuccessCount;
    const failureCount = hasApiExplicitCounts
      ? Number(apiData.failure_count) || 0
      : derivedFailureCount;

    result.push({
      endpoint: maskUsageSensitiveValue(endpoint) || endpoint,
      totalRequests: Number(apiData.total_requests) || 0,
      successCount,
      failureCount,
      totalTokens: Number(apiData.total_tokens) || 0,
      totalCost,
      models,
    });
  });

  return result;
}

/**
 * 获取模型统计数据
 */
export function getModelStats(
  usageData: unknown,
  modelPrices: Record<string, ModelPrice>
): ModelStatsSummary[] {
  const apis = getApisRecord(usageData);
  if (!apis) return [];

  const modelMap = new Map<
    string,
    {
      requests: number;
      successCount: number;
      failureCount: number;
      tokens: number;
      cost: number;
      latency: LatencyAccumulator;
    }
  >();

  Object.values(apis).forEach((apiData) => {
    if (!isRecord(apiData)) return;
    const modelsRaw = apiData.models;
    const models = isRecord(modelsRaw) ? modelsRaw : null;
    if (!models) return;

    Object.entries(models).forEach(([modelName, modelData]) => {
      if (!isRecord(modelData)) return;
      const existing = modelMap.get(modelName) || {
        requests: 0,
        successCount: 0,
        failureCount: 0,
        tokens: 0,
        cost: 0,
        latency: createLatencyAccumulator(),
      };
      existing.requests += Number(modelData.total_requests) || 0;
      existing.tokens += Number(modelData.total_tokens) || 0;

      const details = Array.isArray(modelData.details) ? modelData.details : [];

      const price = modelPrices[modelName];

      const hasExplicitCounts =
        typeof modelData.success_count === 'number' || typeof modelData.failure_count === 'number';
      if (hasExplicitCounts) {
        existing.successCount += Number(modelData.success_count) || 0;
        existing.failureCount += Number(modelData.failure_count) || 0;
      }

      if (details.length > 0) {
        details.forEach((detail) => {
          const detailRecord = isRecord(detail) ? detail : null;
          if (!hasExplicitCounts) {
            const requestCount = getUsageRequestCount(detailRecord);
            if (detailRecord?.failed === true) {
              existing.failureCount += requestCount;
            } else {
              existing.successCount += requestCount;
            }
          }

          addLatencyDetail(existing.latency, detailRecord);

          if (price && detailRecord) {
            existing.cost += calculateCost(
              { ...(detailRecord as unknown as UsageDetail), __modelName: modelName },
              modelPrices
            );
          }
        });
      }
      modelMap.set(modelName, existing);
    });
  });

  return Array.from(modelMap.entries())
    .map(([model, stats]) => {
      const latencyStats = finalizeLatencyStats(stats.latency);
      return {
        model,
        requests: stats.requests,
        successCount: stats.successCount,
        failureCount: stats.failureCount,
        tokens: stats.tokens,
        cost: stats.cost,
        averageLatencyMs: latencyStats.averageMs,
        latencySampleCount: latencyStats.sampleCount,
      };
    })
    .sort((a, b) => b.requests - a.requests);
}

/**
 * 格式化小时标签
 */
export function formatHourLabel(date: Date): string {
  if (!(date instanceof Date)) {
    return '';
  }
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hour = date.getHours().toString().padStart(2, '0');
  return `${month}-${day} ${hour}:00`;
}

/**
 * 格式化日期标签
 */
export function formatDayLabel(date: Date): string {
  if (!(date instanceof Date)) {
    return '';
  }
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 构建小时级别的数据序列
 */
export function buildHourlySeriesByModel(
  usageData: unknown,
  metric: 'requests' | 'tokens' = 'requests',
  hourWindow: number = 24
): {
  labels: string[];
  dataByModel: Map<string, number[]>;
  hasData: boolean;
} {
  const hourMs = 60 * 60 * 1000;
  const resolvedHourWindow =
    Number.isFinite(hourWindow) && hourWindow > 0
      ? Math.min(Math.max(Math.floor(hourWindow), 1), 24 * 31)
      : 24;
  const now = new Date();
  const currentHour = new Date(now);
  currentHour.setMinutes(0, 0, 0);

  const earliestBucket = new Date(currentHour);
  earliestBucket.setHours(earliestBucket.getHours() - (resolvedHourWindow - 1));
  const earliestTime = earliestBucket.getTime();

  const labels: string[] = [];
  for (let i = 0; i < resolvedHourWindow; i++) {
    const bucketStart = earliestTime + i * hourMs;
    labels.push(formatHourLabel(new Date(bucketStart)));
  }

  const details = collectUsageDetails(usageData);
  const dataByModel = new Map<string, number[]>();
  let hasData = false;

  if (!details.length) {
    return { labels, dataByModel, hasData };
  }

  details.forEach((detail) => {
    const timestamp =
      typeof detail.__timestampMs === 'number'
        ? detail.__timestampMs
        : parseTimestampMs(detail.timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return;
    }

    const normalized = new Date(timestamp);
    normalized.setMinutes(0, 0, 0);
    const bucketStart = normalized.getTime();
    const lastBucketTime = earliestTime + (labels.length - 1) * hourMs;
    if (bucketStart < earliestTime || bucketStart > lastBucketTime) {
      return;
    }

    const bucketIndex = Math.floor((bucketStart - earliestTime) / hourMs);
    if (bucketIndex < 0 || bucketIndex >= labels.length) {
      return;
    }

    const modelName = detail.__modelName || 'Unknown';
    if (!dataByModel.has(modelName)) {
      dataByModel.set(modelName, new Array(labels.length).fill(0));
    }

    const bucketValues = dataByModel.get(modelName)!;
    if (metric === 'tokens') {
      bucketValues[bucketIndex] += extractTotalTokens(detail);
    } else {
      bucketValues[bucketIndex] += getUsageRequestCount(detail);
    }
    hasData = true;
  });

  return { labels, dataByModel, hasData };
}

/**
 * 构建日级别的数据序列
 */
export function buildDailySeriesByModel(
  usageData: unknown,
  metric: 'requests' | 'tokens' = 'requests'
): {
  labels: string[];
  dataByModel: Map<string, number[]>;
  hasData: boolean;
} {
  const details = collectUsageDetails(usageData);
  const valuesByModel = new Map<string, Map<string, number>>();
  const labelsSet = new Set<string>();
  let hasData = false;

  if (!details.length) {
    return { labels: [], dataByModel: new Map(), hasData };
  }

  details.forEach((detail) => {
    const timestamp =
      typeof detail.__timestampMs === 'number'
        ? detail.__timestampMs
        : parseTimestampMs(detail.timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return;
    }
    const dayLabel = formatDayLabel(new Date(timestamp));
    if (!dayLabel) {
      return;
    }

    const modelName = detail.__modelName || 'Unknown';
    if (!valuesByModel.has(modelName)) {
      valuesByModel.set(modelName, new Map());
    }
    const modelDayMap = valuesByModel.get(modelName)!;
    const increment =
      metric === 'tokens' ? extractTotalTokens(detail) : getUsageRequestCount(detail);
    modelDayMap.set(dayLabel, (modelDayMap.get(dayLabel) || 0) + increment);
    labelsSet.add(dayLabel);
    hasData = true;
  });

  const labels = Array.from(labelsSet).sort();
  const dataByModel = new Map<string, number[]>();
  valuesByModel.forEach((dayMap, modelName) => {
    const series = labels.map((label) => dayMap.get(label) || 0);
    dataByModel.set(modelName, series);
  });

  return { labels, dataByModel, hasData };
}

const CHART_COLORS = [
  { borderColor: '#8b8680', backgroundColor: 'rgba(139, 134, 128, 0.15)' },
  { borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  { borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.15)' },
  { borderColor: '#c65746', backgroundColor: 'rgba(198, 87, 70, 0.15)' },
  { borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.15)' },
  { borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.15)' },
  { borderColor: '#ec4899', backgroundColor: 'rgba(236, 72, 153, 0.15)' },
  { borderColor: '#84cc16', backgroundColor: 'rgba(132, 204, 22, 0.15)' },
  { borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.15)' },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const normalized = hex.trim().replace('#', '');
  if (normalized.length !== 6) {
    return null;
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if (![r, g, b].every((channel) => Number.isFinite(channel))) {
    return null;
  }
  return { r, g, b };
};

const withAlpha = (hex: string, alpha: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }
  const clamped = clamp(alpha, 0, 1);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamped})`;
};

const buildAreaGradient = (
  context: ScriptableContext<'line'>,
  baseHex: string,
  fallback: string
) => {
  const chart = context.chart;
  const ctx = chart.ctx;
  const area = chart.chartArea;

  if (!area) {
    return fallback;
  }

  const gradient = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  gradient.addColorStop(0, withAlpha(baseHex, 0.28));
  gradient.addColorStop(0.6, withAlpha(baseHex, 0.12));
  gradient.addColorStop(1, withAlpha(baseHex, 0.02));
  return gradient;
};

/**
 * 构建图表数据
 */
export function buildChartData(
  usageData: unknown,
  period: 'hour' | 'day' = 'day',
  metric: 'requests' | 'tokens' = 'requests',
  selectedModels: string[] = [],
  options: { hourWindowHours?: number } = {}
): ChartData {
  const baseSeries =
    period === 'hour'
      ? buildHourlySeriesByModel(usageData, metric, options.hourWindowHours)
      : buildDailySeriesByModel(usageData, metric);

  const { labels, dataByModel } = baseSeries;

  // Build "All" series as sum of all models
  const getAllSeries = (): number[] => {
    const summed = new Array(labels.length).fill(0);
    dataByModel.forEach((values) => {
      values.forEach((value, idx) => {
        summed[idx] = (summed[idx] || 0) + value;
      });
    });
    return summed;
  };

  // Determine which models to show
  const modelsToShow = selectedModels.length > 0 ? selectedModels : ['all'];

  const datasets: ChartDataset[] = modelsToShow.map((model, index) => {
    const isAll = model === 'all';
    const data = isAll
      ? getAllSeries()
      : dataByModel.get(model) || new Array(labels.length).fill(0);
    const colorIndex = index % CHART_COLORS.length;
    const style = CHART_COLORS[colorIndex];
    const shouldFill = modelsToShow.length === 1 || (isAll && modelsToShow.length > 1);

    return {
      label: isAll ? 'All Models' : model,
      data,
      borderColor: style.borderColor,
      backgroundColor: shouldFill
        ? (ctx) => buildAreaGradient(ctx, style.borderColor, style.backgroundColor)
        : style.backgroundColor,
      pointBackgroundColor: style.borderColor,
      pointBorderColor: style.borderColor,
      fill: shouldFill,
      tension: 0.35,
    };
  });

  return { labels, datasets };
}

/**
 * 依据 usage 数据计算密钥使用统计
 */
/**
 * 状态栏单个格子的状态
 */
export function calculateStatusBarData(
  usageDetails: UsageDetail[],
  sourceFilter?: string,
  authIndexFilter?: string | number
): StatusBarData {
  const BLOCK_COUNT = 20;
  const BLOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes
  const WINDOW_MS = BLOCK_COUNT * BLOCK_DURATION_MS; // 200 minutes

  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Initialize blocks
  const blockStats: Array<{ success: number; failure: number }> = Array.from(
    { length: BLOCK_COUNT },
    () => ({ success: 0, failure: 0 })
  );

  let totalSuccess = 0;
  let totalFailure = 0;

  // Filter and bucket the usage details
  usageDetails.forEach((detail) => {
    const timestamp =
      typeof detail.__timestampMs === 'number'
        ? detail.__timestampMs
        : parseTimestampMs(detail.timestamp);
    if (
      !Number.isFinite(timestamp) ||
      timestamp <= 0 ||
      timestamp < windowStart ||
      timestamp > now
    ) {
      return;
    }

    // Apply filters if provided
    if (sourceFilter !== undefined && detail.source !== sourceFilter) {
      return;
    }
    if (authIndexFilter !== undefined && detail.auth_index !== authIndexFilter) {
      return;
    }

    // Calculate which block this falls into (0 = oldest, 19 = newest)
    const ageMs = now - timestamp;
    const blockIndex = BLOCK_COUNT - 1 - Math.floor(ageMs / BLOCK_DURATION_MS);

    if (blockIndex >= 0 && blockIndex < BLOCK_COUNT) {
      const requestCount = getUsageRequestCount(detail);
      if (detail.failed) {
        blockStats[blockIndex].failure += requestCount;
        totalFailure += requestCount;
      } else {
        blockStats[blockIndex].success += requestCount;
        totalSuccess += requestCount;
      }
    }
  });

  // Convert stats to block states and build details
  const blocks: StatusBlockState[] = [];
  const blockDetails: StatusBlockDetail[] = [];

  blockStats.forEach((stat, idx) => {
    const total = stat.success + stat.failure;
    if (total === 0) {
      blocks.push('idle');
    } else if (stat.failure === 0) {
      blocks.push('success');
    } else if (stat.success === 0) {
      blocks.push('failure');
    } else {
      blocks.push('mixed');
    }

    const blockStartTime = windowStart + idx * BLOCK_DURATION_MS;
    blockDetails.push({
      success: stat.success,
      failure: stat.failure,
      rate: total > 0 ? stat.success / total : -1,
      startTime: blockStartTime,
      endTime: blockStartTime + BLOCK_DURATION_MS,
    });
  });

  // Calculate success rate
  const total = totalSuccess + totalFailure;
  const successRate = total > 0 ? (totalSuccess / total) * 100 : 100;

  return {
    blocks,
    blockDetails,
    successRate,
    totalSuccess,
    totalFailure,
  };
}

/**
 * 服务健康监测数据（最近168小时/7天，7×96网格）
 * 每个格子代表15分钟的健康度
 */
export function calculateServiceHealthData(usageDetails: UsageDetail[]): ServiceHealthData {
  const ROWS = 7;
  const COLS = 96;
  const BLOCK_COUNT = ROWS * COLS; // 672
  const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  const WINDOW_MS = BLOCK_COUNT * BLOCK_DURATION_MS; // 168 hours (7 days)

  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const blockStats: Array<{ success: number; failure: number }> = Array.from(
    { length: BLOCK_COUNT },
    () => ({ success: 0, failure: 0 })
  );

  let totalSuccess = 0;
  let totalFailure = 0;

  usageDetails.forEach((detail) => {
    const timestamp =
      typeof detail.__timestampMs === 'number'
        ? detail.__timestampMs
        : parseTimestampMs(detail.timestamp);
    if (
      !Number.isFinite(timestamp) ||
      timestamp <= 0 ||
      timestamp < windowStart ||
      timestamp > now
    ) {
      return;
    }

    const ageMs = now - timestamp;
    const blockIndex = BLOCK_COUNT - 1 - Math.floor(ageMs / BLOCK_DURATION_MS);

    if (blockIndex >= 0 && blockIndex < BLOCK_COUNT) {
      const requestCount = getUsageRequestCount(detail);
      if (detail.failed) {
        blockStats[blockIndex].failure += requestCount;
        totalFailure += requestCount;
      } else {
        blockStats[blockIndex].success += requestCount;
        totalSuccess += requestCount;
      }
    }
  });

  const blocks: StatusBlockState[] = [];
  const blockDetails: StatusBlockDetail[] = [];

  blockStats.forEach((stat, idx) => {
    const total = stat.success + stat.failure;
    if (total === 0) {
      blocks.push('idle');
    } else if (stat.failure === 0) {
      blocks.push('success');
    } else if (stat.success === 0) {
      blocks.push('failure');
    } else {
      blocks.push('mixed');
    }

    const blockStartTime = windowStart + idx * BLOCK_DURATION_MS;
    blockDetails.push({
      success: stat.success,
      failure: stat.failure,
      rate: total > 0 ? stat.success / total : -1,
      startTime: blockStartTime,
      endTime: blockStartTime + BLOCK_DURATION_MS,
    });
  });

  const total = totalSuccess + totalFailure;
  const successRate = total > 0 ? (totalSuccess / total) * 100 : 100;

  return {
    blocks,
    blockDetails,
    successRate,
    totalSuccess,
    totalFailure,
    rows: ROWS,
    cols: COLS,
  };
}

export function buildHourlyTokenBreakdown(
  usageData: unknown,
  hourWindow: number = 24
): TokenBreakdownSeries {
  const hourMs = 60 * 60 * 1000;
  const resolvedHourWindow =
    Number.isFinite(hourWindow) && hourWindow > 0
      ? Math.min(Math.max(Math.floor(hourWindow), 1), 24 * 31)
      : 24;
  const now = new Date();
  const currentHour = new Date(now);
  currentHour.setMinutes(0, 0, 0);

  const earliestBucket = new Date(currentHour);
  earliestBucket.setHours(earliestBucket.getHours() - (resolvedHourWindow - 1));
  const earliestTime = earliestBucket.getTime();

  const labels: string[] = [];
  for (let i = 0; i < resolvedHourWindow; i++) {
    labels.push(formatHourLabel(new Date(earliestTime + i * hourMs)));
  }

  const dataByCategory: Record<TokenCategory, number[]> = {
    input: new Array(labels.length).fill(0),
    output: new Array(labels.length).fill(0),
    cached: new Array(labels.length).fill(0),
    reasoning: new Array(labels.length).fill(0),
  };

  const details = collectUsageDetails(usageData);
  let hasData = false;

  details.forEach((detail) => {
    const timestamp =
      typeof detail.__timestampMs === 'number'
        ? detail.__timestampMs
        : parseTimestampMs(detail.timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return;
    const normalized = new Date(timestamp);
    normalized.setMinutes(0, 0, 0);
    const bucketStart = normalized.getTime();
    const lastBucketTime = earliestTime + (labels.length - 1) * hourMs;
    if (bucketStart < earliestTime || bucketStart > lastBucketTime) return;
    const bucketIndex = Math.floor((bucketStart - earliestTime) / hourMs);
    if (bucketIndex < 0 || bucketIndex >= labels.length) return;

    const tokens = detail.tokens;
    const input = typeof tokens.input_tokens === 'number' ? Math.max(tokens.input_tokens, 0) : 0;
    const output = typeof tokens.output_tokens === 'number' ? Math.max(tokens.output_tokens, 0) : 0;
    const cached = Math.max(
      typeof tokens.cached_tokens === 'number' ? Math.max(tokens.cached_tokens, 0) : 0,
      typeof tokens.cache_tokens === 'number' ? Math.max(tokens.cache_tokens, 0) : 0
    );
    const reasoning =
      typeof tokens.reasoning_tokens === 'number' ? Math.max(tokens.reasoning_tokens, 0) : 0;

    dataByCategory.input[bucketIndex] += input;
    dataByCategory.output[bucketIndex] += output;
    dataByCategory.cached[bucketIndex] += cached;
    dataByCategory.reasoning[bucketIndex] += reasoning;
    hasData = true;
  });

  return { labels, dataByCategory, hasData };
}

/**
 * 按 token 类别构建日级别的堆叠序列
 */
export function buildDailyTokenBreakdown(usageData: unknown): TokenBreakdownSeries {
  const details = collectUsageDetails(usageData);
  const dayMap: Record<string, Record<TokenCategory, number>> = {};
  let hasData = false;

  details.forEach((detail) => {
    const timestamp =
      typeof detail.__timestampMs === 'number'
        ? detail.__timestampMs
        : parseTimestampMs(detail.timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return;
    const dayLabel = formatDayLabel(new Date(timestamp));
    if (!dayLabel) return;

    if (!dayMap[dayLabel]) {
      dayMap[dayLabel] = { input: 0, output: 0, cached: 0, reasoning: 0 };
    }

    const tokens = detail.tokens;
    const input = typeof tokens.input_tokens === 'number' ? Math.max(tokens.input_tokens, 0) : 0;
    const output = typeof tokens.output_tokens === 'number' ? Math.max(tokens.output_tokens, 0) : 0;
    const cached = Math.max(
      typeof tokens.cached_tokens === 'number' ? Math.max(tokens.cached_tokens, 0) : 0,
      typeof tokens.cache_tokens === 'number' ? Math.max(tokens.cache_tokens, 0) : 0
    );
    const reasoning =
      typeof tokens.reasoning_tokens === 'number' ? Math.max(tokens.reasoning_tokens, 0) : 0;

    dayMap[dayLabel].input += input;
    dayMap[dayLabel].output += output;
    dayMap[dayLabel].cached += cached;
    dayMap[dayLabel].reasoning += reasoning;
    hasData = true;
  });

  const labels = Object.keys(dayMap).sort();
  const dataByCategory: Record<TokenCategory, number[]> = {
    input: labels.map((l) => dayMap[l].input),
    output: labels.map((l) => dayMap[l].output),
    cached: labels.map((l) => dayMap[l].cached),
    reasoning: labels.map((l) => dayMap[l].reasoning),
  };

  return { labels, dataByCategory, hasData };
}

export function buildHourlyCostSeries(
  usageData: unknown,
  modelPrices: Record<string, ModelPrice>,
  hourWindow: number = 24
): CostSeries {
  const hourMs = 60 * 60 * 1000;
  const resolvedHourWindow =
    Number.isFinite(hourWindow) && hourWindow > 0
      ? Math.min(Math.max(Math.floor(hourWindow), 1), 24 * 31)
      : 24;
  const now = new Date();
  const currentHour = new Date(now);
  currentHour.setMinutes(0, 0, 0);

  const earliestBucket = new Date(currentHour);
  earliestBucket.setHours(earliestBucket.getHours() - (resolvedHourWindow - 1));
  const earliestTime = earliestBucket.getTime();

  const labels: string[] = [];
  for (let i = 0; i < resolvedHourWindow; i++) {
    labels.push(formatHourLabel(new Date(earliestTime + i * hourMs)));
  }

  const data = new Array(labels.length).fill(0);
  const details = collectUsageDetails(usageData);
  let hasData = false;

  details.forEach((detail) => {
    const timestamp =
      typeof detail.__timestampMs === 'number'
        ? detail.__timestampMs
        : parseTimestampMs(detail.timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return;
    const normalized = new Date(timestamp);
    normalized.setMinutes(0, 0, 0);
    const bucketStart = normalized.getTime();
    const lastBucketTime = earliestTime + (labels.length - 1) * hourMs;
    if (bucketStart < earliestTime || bucketStart > lastBucketTime) return;
    const bucketIndex = Math.floor((bucketStart - earliestTime) / hourMs);
    if (bucketIndex < 0 || bucketIndex >= labels.length) return;

    const cost = calculateCost(detail, modelPrices);
    if (cost > 0) {
      data[bucketIndex] += cost;
      hasData = true;
    }
  });

  return { labels, data, hasData };
}

/**
 * 按天构建费用时间序列
 */
export function buildDailyCostSeries(
  usageData: unknown,
  modelPrices: Record<string, ModelPrice>
): CostSeries {
  const details = collectUsageDetails(usageData);
  const dayMap: Record<string, number> = {};
  let hasData = false;

  details.forEach((detail) => {
    const timestamp =
      typeof detail.__timestampMs === 'number'
        ? detail.__timestampMs
        : parseTimestampMs(detail.timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return;
    const dayLabel = formatDayLabel(new Date(timestamp));
    if (!dayLabel) return;

    const cost = calculateCost(detail, modelPrices);
    if (cost > 0) {
      dayMap[dayLabel] = (dayMap[dayLabel] || 0) + cost;
      hasData = true;
    }
  });

  const labels = Object.keys(dayMap).sort();
  const data = labels.map((l) => dayMap[l]);

  return { labels, data, hasData };
}

import { createLogger } from '../utils/logger';
import {
  insertMetric,
  queryUsageHistory,
  queryAccountStatsByPeriod,
  queryModelStatsByPeriod,
} from '../repositories/metrics.repository';
import { upsertProviderModel } from '../repositories/provider-model.repository';
import { getConfigValue } from '../repositories/config.repository';

const logger = createLogger('StatsService');

function isStatsEnabled(): boolean {
  try {
    const value = getConfigValue('enable_stats_collection');
    return value !== 'false';
  } catch {
    return true;
  }
}

export async function recordRequest(providerId: string, modelId: string) {
  if (!isStatsEnabled()) return;
  try {
    upsertProviderModel(providerId, modelId, modelId, Date.now());
  } catch (error) {
    logger.error('Error updating request stats:', error);
  }
}

export async function recordSuccess(
  accountId: string,
  providerId: string,
  modelId: string,
  tokens: number,
  conversationId?: string,
) {
  if (!isStatsEnabled()) return;
  try {
    upsertProviderModel(providerId, modelId, modelId, Date.now());
  } catch (error) {
    logger.error('Error updating success stats:', error);
  }
  recordMetric(accountId, providerId, modelId, tokens, conversationId);
}

export function recordMetric(
  accountId: string,
  providerId: string,
  modelId: string,
  tokens: number,
  conversationId?: string,
) {
  if (!isStatsEnabled()) return;
  try {
    insertMetric(providerId, modelId, accountId, tokens, conversationId);
  } catch (error) {
    logger.error('Error recording metric:', error);
  }
}

// =============================================================================
// QUERY HELPERS
// =============================================================================

interface TimeRange {
  startTime: number;
  endTime: number;
}

function getTimeRange(period: string, offset: number): TimeRange {
  const now = new Date();
  let startTime: number;
  let endTime: number = Date.now();

  switch (period) {
    case 'year': {
      const targetYear = now.getFullYear() - offset;
      startTime = new Date(targetYear, 0, 1).getTime();
      endTime = new Date(targetYear, 11, 31, 23, 59, 59).getTime();
      break;
    }
    case 'month': {
      const targetMonthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      startTime = targetMonthDate.getTime();
      endTime = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth() + 1, 0, 23, 59, 59).getTime();
      break;
    }
    case 'week': {
      const weekStart = new Date(now.getTime() - (offset * 7 + 6) * 24 * 60 * 60 * 1000);
      weekStart.setHours(0, 0, 0, 0);
      startTime = weekStart.getTime();
      endTime = startTime + 7 * 24 * 60 * 60 * 1000 - 1;
      break;
    }
    default: {
      const dayStart = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      startTime = dayStart.getTime();
      endTime = dayStart.getTime() + 24 * 60 * 60 * 1000 - 1;
      break;
    }
  }
  return { startTime, endTime };
}

export function getUsageHistory(
  period: 'day' | 'week' | 'month' | 'year' = 'day',
  offset: number = 0,
) {
  let groupBy: string;
  let dateFormat: string;
  const now = new Date();
  const labels: string[] = [];

  let startTime: number;
  let endTime: number;

  switch (period) {
    case 'year': {
      const targetYear = now.getFullYear() - offset;
      startTime = new Date(targetYear, 0, 1).getTime();
      endTime = new Date(targetYear, 11, 31, 23, 59, 59, 999).getTime();
      groupBy = '%Y-%m';
      dateFormat = '%Y-%m';
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      for (let m = 1; m <= 12; m++) {
        const lbl = `${targetYear}-${String(m).padStart(2, '0')}`;
        if (offset === 0 && lbl > currentMonthStr) break;
        labels.push(lbl);
      }
      break;
    }
    case 'month': {
      const targetMonthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      startTime = targetMonthDate.getTime();
      const lastDay = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth() + 1, 0);
      endTime = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59, 59, 999).getTime();
      groupBy = '%Y-%m-%d';
      dateFormat = '%Y-%m-%d';
      const todayStr = now.toISOString().split('T')[0];
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const dateObj = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), d);
        const lbl = dateObj.toISOString().split('T')[0];
        if (offset === 0 && lbl > todayStr) break;
        labels.push(lbl);
      }
      break;
    }
    case 'week': {
      const endOfPeriod = new Date(now.getTime() - offset * 7 * 24 * 60 * 60 * 1000);
      endOfPeriod.setHours(23, 59, 59, 999);
      const startOfPeriod = new Date(endOfPeriod.getTime() - 6 * 24 * 60 * 60 * 1000);
      startOfPeriod.setHours(0, 0, 0, 0);
      startTime = startOfPeriod.getTime();
      endTime = endOfPeriod.getTime();
      groupBy = '%Y-%m-%d';
      dateFormat = '%Y-%m-%d';
      const todayStr = now.toISOString().split('T')[0];
      for (let i = 0; i < 7; i++) {
        const dateObj = new Date(startTime + i * 24 * 60 * 60 * 1000);
        const lbl = dateObj.toISOString().split('T')[0];
        if (offset === 0 && lbl > todayStr) break;
        labels.push(lbl);
      }
      break;
    }
    default: {
      const dayStart = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      startTime = dayStart.getTime();
      endTime = dayStart.getTime() + 24 * 60 * 60 * 1000 - 1;
      groupBy = '%Y-%m-%d %H:00';
      dateFormat = '%H:00';
      const currentHour = now.getHours();
      for (let h = 0; h < 24; h++) {
        const lbl = `${String(h).padStart(2, '0')}:00`;
        if (offset === 0 && h > currentHour) break;
        labels.push(lbl);
      }
      break;
    }
  }

  try {
    const rows = queryUsageHistory(groupBy, startTime, endTime);
    const dataMap = new Map<string, any>();
    rows.forEach((row) => {
      const key = period === 'day' ? row.date.split(' ')[1] : row.date;
      dataMap.set(key, row);
    });
    return labels.map((label) => {
      const entry = dataMap.get(label);
      return { date: label, requests: entry?.requests ?? 0, tokens: entry?.tokens ?? 0 };
    });
  } catch (error) {
    logger.error('Error getting usage history:', error);
    return labels.map((label) => ({ date: label, requests: 0, tokens: 0 }));
  }
}

export function getAccountStatsByPeriod(
  period: 'day' | 'week' | 'month' | 'year' = 'day',
  offset: number = 0,
) {
  const { startTime, endTime } = getTimeRange(period, offset);
  return queryAccountStatsByPeriod(startTime, endTime);
}

export function getModelStatsByPeriod(
  period: 'day' | 'week' | 'month' | 'year' = 'day',
  offset: number = 0,
) {
  const { startTime, endTime } = getTimeRange(period, offset);
  return queryModelStatsByPeriod(startTime, endTime);
}

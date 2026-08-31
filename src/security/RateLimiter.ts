// Rate Limiting, Quotas, and Cost Tracking System

export interface RateLimitConfig {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  tokensPerDay?: number;
  costPerDay?: number; // in USD
}

export interface UsageMetrics {
  userId: string;
  requestCount: number;
  tokenCount: number;
  estimatedCost: number;
  timestamp: Date;
}

export interface QuotaStatus {
  limit: number;
  used: number;
  remaining: number;
  resetsAt: Date;
}

interface RateLimitEntry {
  count: number;
  firstRequest: Date;
  lastRequest: Date;
}

export class RateLimiter {
  private requestCounts: Map<string, RateLimitEntry> = new Map();
  private tokenCounts: Map<string, number> = new Map();
  private costTracking: Map<string, number> = new Map();
  private config: Map<string, RateLimitConfig> = new Map();

  setUserLimits(userId: string, config: RateLimitConfig): void {
    this.config.set(userId, config);
  }

  getUserLimits(userId: string): RateLimitConfig {
    return this.config.get(userId) || {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      tokensPerDay: 1000000,
      costPerDay: 100,
    };
  }

  async checkRateLimit(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    const limits = this.getUserLimits(userId);
    const now = new Date();

    // Check requests per minute
    if (limits.requestsPerMinute) {
      const minuteKey = `${userId}:minute:${this.getMinuteKey(now)}`;
      const minuteCount = this.getRequestCount(minuteKey, now, 60);

      if (minuteCount >= limits.requestsPerMinute) {
        return {
          allowed: false,
          reason: 'Rate limit exceeded: requests per minute',
          retryAfter: 60 - (now.getSeconds()),
        };
      }
    }

    // Check requests per hour
    if (limits.requestsPerHour) {
      const hourKey = `${userId}:hour:${this.getHourKey(now)}`;
      const hourCount = this.getRequestCount(hourKey, now, 3600);

      if (hourCount >= limits.requestsPerHour) {
        return {
          allowed: false,
          reason: 'Rate limit exceeded: requests per hour',
          retryAfter: 3600 - (now.getMinutes() * 60 + now.getSeconds()),
        };
      }
    }

    // Check requests per day
    if (limits.requestsPerDay) {
      const dayKey = `${userId}:day:${this.getDayKey(now)}`;
      const dayCount = this.getRequestCount(dayKey, now, 86400);

      if (dayCount >= limits.requestsPerDay) {
        return {
          allowed: false,
          reason: 'Rate limit exceeded: requests per day',
          retryAfter: this.getSecondsUntilNextDay(now),
        };
      }
    }

    // Check token quota
    if (limits.tokensPerDay) {
      const tokenKey = `${userId}:tokens:${this.getDayKey(now)}`;
      const tokensUsed = this.tokenCounts.get(tokenKey) || 0;

      if (tokensUsed >= limits.tokensPerDay) {
        return {
          allowed: false,
          reason: 'Token quota exceeded',
          retryAfter: this.getSecondsUntilNextDay(now),
        };
      }
    }

    // Check cost quota
    if (limits.costPerDay) {
      const costKey = `${userId}:cost:${this.getDayKey(now)}`;
      const costUsed = this.costTracking.get(costKey) || 0;

      if (costUsed >= limits.costPerDay) {
        return {
          allowed: false,
          reason: `Daily cost limit exceeded ($${limits.costPerDay})`,
          retryAfter: this.getSecondsUntilNextDay(now),
        };
      }
    }

    return { allowed: true };
  }

  recordRequest(userId: string): void {
    const now = new Date();

    // Record for all time windows
    this.incrementCount(`${userId}:minute:${this.getMinuteKey(now)}`, now);
    this.incrementCount(`${userId}:hour:${this.getHourKey(now)}`, now);
    this.incrementCount(`${userId}:day:${this.getDayKey(now)}`, now);
  }

  recordTokenUsage(userId: string, inputTokens: number, outputTokens: number): void {
    const now = new Date();
    const tokenKey = `${userId}:tokens:${this.getDayKey(now)}`;
    const currentTokens = this.tokenCounts.get(tokenKey) || 0;
    this.tokenCounts.set(tokenKey, currentTokens + inputTokens + outputTokens);

    // Estimate cost (example pricing)
    const cost = this.estimateCost(inputTokens, outputTokens);
    this.recordCost(userId, cost);
  }

  recordCost(userId: string, cost: number): void {
    const now = new Date();
    const costKey = `${userId}:cost:${this.getDayKey(now)}`;
    const currentCost = this.costTracking.get(costKey) || 0;
    this.costTracking.set(costKey, currentCost + cost);
  }

  private estimateCost(inputTokens: number, outputTokens: number): number {
    // Example pricing for Claude Sonnet
    const inputCostPer1k = 0.003;
    const outputCostPer1k = 0.015;

    const inputCost = (inputTokens / 1000) * inputCostPer1k;
    const outputCost = (outputTokens / 1000) * outputCostPer1k;

    return inputCost + outputCost;
  }

  getQuotaStatus(userId: string): {
    requests: QuotaStatus;
    tokens: QuotaStatus;
    cost: QuotaStatus;
  } {
    const limits = this.getUserLimits(userId);
    const now = new Date();
    const dayKey = this.getDayKey(now);

    // Requests quota
    const requestKey = `${userId}:day:${dayKey}`;
    const requestCount = this.getRequestCount(requestKey, now, 86400);

    // Tokens quota
    const tokenKey = `${userId}:tokens:${dayKey}`;
    const tokensUsed = this.tokenCounts.get(tokenKey) || 0;

    // Cost quota
    const costKey = `${userId}:cost:${dayKey}`;
    const costUsed = this.costTracking.get(costKey) || 0;

    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);

    return {
      requests: {
        limit: limits.requestsPerDay || 10000,
        used: requestCount,
        remaining: (limits.requestsPerDay || 10000) - requestCount,
        resetsAt: nextDay,
      },
      tokens: {
        limit: limits.tokensPerDay || 1000000,
        used: tokensUsed,
        remaining: (limits.tokensPerDay || 1000000) - tokensUsed,
        resetsAt: nextDay,
      },
      cost: {
        limit: limits.costPerDay || 100,
        used: costUsed,
        remaining: (limits.costPerDay || 100) - costUsed,
        resetsAt: nextDay,
      },
    };
  }

  getUsageMetrics(userId: string): UsageMetrics {
    const now = new Date();
    const dayKey = this.getDayKey(now);
    const requestKey = `${userId}:day:${dayKey}`;
    const tokenKey = `${userId}:tokens:${dayKey}`;
    const costKey = `${userId}:cost:${dayKey}`;

    return {
      userId,
      requestCount: this.getRequestCount(requestKey, now, 86400),
      tokenCount: this.tokenCounts.get(tokenKey) || 0,
      estimatedCost: this.costTracking.get(costKey) || 0,
      timestamp: now,
    };
  }

  private getRequestCount(key: string, now: Date, windowSeconds: number): number {
    const entry = this.requestCounts.get(key);
    if (!entry) return 0;

    const windowStart = new Date(now.getTime() - windowSeconds * 1000);
    if (entry.firstRequest < windowStart) {
      // Window has expired
      this.requestCounts.delete(key);
      return 0;
    }

    return entry.count;
  }

  private incrementCount(key: string, now: Date): void {
    const entry = this.requestCounts.get(key);

    if (entry) {
      entry.count++;
      entry.lastRequest = now;
    } else {
      this.requestCounts.set(key, {
        count: 1,
        firstRequest: now,
        lastRequest: now,
      });
    }
  }

  private getMinuteKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
  }

  private getHourKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
  }

  private getDayKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  private getSecondsUntilNextDay(now: Date): number {
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    return Math.floor((nextDay.getTime() - now.getTime()) / 1000);
  }

  cleanup(): void {
    // Remove expired entries
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 86400 * 1000);

    for (const [key, entry] of this.requestCounts.entries()) {
      if (entry.lastRequest < oneDayAgo) {
        this.requestCounts.delete(key);
      }
    }
  }

  generateReport(userId: string): string {
    const metrics = this.getUsageMetrics(userId);
    const quotas = this.getQuotaStatus(userId);

    let report = '📊 Usage Report\n\n';
    report += `User: ${userId}\n`;
    report += `Date: ${metrics.timestamp.toLocaleDateString()}\n\n`;

    report += '📈 Today\'s Usage:\n';
    report += `  Requests: ${metrics.requestCount}\n`;
    report += `  Tokens: ${metrics.tokenCount.toLocaleString()}\n`;
    report += `  Cost: $${metrics.estimatedCost.toFixed(4)}\n\n`;

    report += '📋 Quota Status:\n';
    report += `  Requests: ${quotas.requests.used}/${quotas.requests.limit} (${quotas.requests.remaining} remaining)\n`;
    report += `  Tokens: ${quotas.tokens.used.toLocaleString()}/${quotas.tokens.limit.toLocaleString()} (${quotas.tokens.remaining.toLocaleString()} remaining)\n`;
    report += `  Cost: $${quotas.cost.used.toFixed(2)}/$${quotas.cost.limit.toFixed(2)} ($${quotas.cost.remaining.toFixed(2)} remaining)\n\n`;

    report += `⏰ Resets at: ${quotas.requests.resetsAt.toLocaleString()}\n`;

    return report;
  }
}

export class CostAnalyzer {
  private costHistory: Map<string, Array<{ date: Date; cost: number }>> = new Map();

  recordDailyCost(userId: string, date: Date, cost: number): void {
    const key = userId;
    const history = this.costHistory.get(key) || [];
    history.push({ date, cost });

    // Keep last 90 days
    const ninetyDaysAgo = new Date(date.getTime() - 90 * 86400 * 1000);
    const filtered = history.filter(entry => entry.date >= ninetyDaysAgo);

    this.costHistory.set(key, filtered);
  }

  getCostTrend(userId: string, days: number = 7): {
    daily: number[];
    average: number;
    total: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    const history = this.costHistory.get(userId) || [];
    const now = new Date();
    const targetDate = new Date(now.getTime() - days * 86400 * 1000);

    const recentCosts = history
      .filter(entry => entry.date >= targetDate)
      .map(entry => entry.cost);

    const total = recentCosts.reduce((sum, cost) => sum + cost, 0);
    const average = recentCosts.length > 0 ? total / recentCosts.length : 0;

    // Simple trend detection
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (recentCosts.length >= 3) {
      const firstHalf = recentCosts.slice(0, Math.floor(recentCosts.length / 2));
      const secondHalf = recentCosts.slice(Math.floor(recentCosts.length / 2));

      const firstAvg = firstHalf.reduce((sum, c) => sum + c, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, c) => sum + c, 0) / secondHalf.length;

      if (secondAvg > firstAvg * 1.2) trend = 'increasing';
      else if (secondAvg < firstAvg * 0.8) trend = 'decreasing';
    }

    return {
      daily: recentCosts,
      average,
      total,
      trend,
    };
  }

  predictMonthlyCost(userId: string): number {
    const trend = this.getCostTrend(userId, 7);
    return trend.average * 30;
  }

  getOptimizationSuggestions(userId: string): string[] {
    const trend = this.getCostTrend(userId, 7);
    const suggestions: string[] = [];

    if (trend.average > 10) {
      suggestions.push('Consider caching frequent requests to reduce API calls');
    }

    if (trend.trend === 'increasing') {
      suggestions.push('Usage is increasing. Review recent activities to identify optimization opportunities');
    }

    if (trend.average > 50) {
      suggestions.push('High daily cost detected. Consider using a smaller model for simple tasks');
    }

    return suggestions;
  }
}

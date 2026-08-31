/**
 * Analytics and Reporting System
 * Usage analytics, performance reports, dashboards, and insights
 */

import { eventBus } from '../core/EventBus';

export interface AnalyticsEvent {
  id: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface Report {
  id: string;
  name: string;
  type: 'usage' | 'performance' | 'errors' | 'custom';
  period: {
    start: Date;
    end: Date;
  };
  data: any;
  generatedAt: Date;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'timeline';
  title: string;
  query: AnalyticsQuery;
  refreshInterval?: number;
}

export interface AnalyticsQuery {
  category?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  limit?: number;
}

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface Insight {
  id: string;
  type: 'trend' | 'anomaly' | 'recommendation';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  timestamp: Date;
  data?: any;
}

/**
 * Analytics Tracker
 */
export class AnalyticsTracker {
  private events: AnalyticsEvent[] = [];
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  /**
   * Track event
   */
  track(
    category: string,
    action: string,
    label?: string,
    value?: number,
    metadata?: Record<string, any>
  ): AnalyticsEvent {
    const event: AnalyticsEvent = {
      id: this.generateEventId(),
      category,
      action,
      label,
      value,
      timestamp: new Date(),
      sessionId: this.sessionId,
      metadata,
    };

    this.events.push(event);

    eventBus.emitSync('analytics.event_tracked', event, 'AnalyticsTracker');

    return event;
  }

  /**
   * Query events
   */
  query(query: AnalyticsQuery): AnalyticsEvent[] {
    let filtered = [...this.events];

    if (query.category) {
      filtered = filtered.filter(e => e.category === query.category);
    }

    if (query.action) {
      filtered = filtered.filter(e => e.action === query.action);
    }

    if (query.startDate) {
      filtered = filtered.filter(e => e.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      filtered = filtered.filter(e => e.timestamp <= query.endDate!);
    }

    if (query.limit) {
      filtered = filtered.slice(0, query.limit);
    }

    return filtered;
  }

  /**
   * Get event count
   */
  count(query: AnalyticsQuery): number {
    return this.query(query).length;
  }

  /**
   * Get aggregated value
   */
  aggregate(query: AnalyticsQuery): number {
    const events = this.query(query);
    const values = events.map(e => e.value || 0);

    switch (query.aggregation) {
      case 'count':
        return events.length;
      case 'sum':
        return values.reduce((sum, v) => sum + v, 0);
      case 'avg':
        return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
      case 'min':
        return values.length > 0 ? Math.min(...values) : 0;
      case 'max':
        return values.length > 0 ? Math.max(...values) : 0;
      default:
        return events.length;
    }
  }

  /**
   * Group events by time period
   */
  groupByTime(query: AnalyticsQuery): Map<string, AnalyticsEvent[]> {
    const events = this.query(query);
    const grouped = new Map<string, AnalyticsEvent[]>();

    for (const event of events) {
      const key = this.getTimeBucket(event.timestamp, query.groupBy || 'day');
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(event);
    }

    return grouped;
  }

  /**
   * Get top actions
   */
  getTopActions(category: string, limit = 10): Array<{ action: string; count: number }> {
    const events = this.query({ category });
    const counts = new Map<string, number>();

    for (const event of events) {
      counts.set(event.action, (counts.get(event.action) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Clear old events
   */
  clearOld(olderThanDays: number): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const before = this.events.length;
    this.events = this.events.filter(e => e.timestamp >= cutoff);

    return before - this.events.length;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private getTimeBucket(date: Date, groupBy: 'hour' | 'day' | 'week' | 'month'): string {
    const d = new Date(date);

    switch (groupBy) {
      case 'hour':
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`;
      case 'day':
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      case 'week':
        const week = Math.floor(d.getDate() / 7);
        return `${d.getFullYear()}-${d.getMonth() + 1}-W${week}`;
      case 'month':
        return `${d.getFullYear()}-${d.getMonth() + 1}`;
    }
  }
}

/**
 * Report Generator
 */
export class ReportGenerator {
  private reports: Map<string, Report> = new Map();

  constructor(private tracker: AnalyticsTracker) {}

  /**
   * Generate usage report
   */
  generateUsageReport(startDate: Date, endDate: Date): Report {
    const events = this.tracker.query({ startDate, endDate });

    const report: Report = {
      id: this.generateReportId(),
      name: 'Usage Report',
      type: 'usage',
      period: { start: startDate, end: endDate },
      data: {
        totalEvents: events.length,
        uniqueSessions: new Set(events.map(e => e.sessionId)).size,
        topCategories: this.getTopCategories(events),
        topActions: this.getTopActions(events),
        timeline: this.getTimeline(events),
      },
      generatedAt: new Date(),
    };

    this.reports.set(report.id, report);

    eventBus.emitSync('report.generated', report, 'ReportGenerator');

    return report;
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(startDate: Date, endDate: Date): Report {
    const events = this.tracker.query({
      category: 'performance',
      startDate,
      endDate,
    });

    const report: Report = {
      id: this.generateReportId(),
      name: 'Performance Report',
      type: 'performance',
      period: { start: startDate, end: endDate },
      data: {
        averageResponseTime: this.getAverageValue(events),
        p50: this.getPercentile(events, 0.5),
        p95: this.getPercentile(events, 0.95),
        p99: this.getPercentile(events, 0.99),
        slowestOperations: this.getSlowest(events, 10),
      },
      generatedAt: new Date(),
    };

    this.reports.set(report.id, report);

    return report;
  }

  /**
   * Generate error report
   */
  generateErrorReport(startDate: Date, endDate: Date): Report {
    const events = this.tracker.query({
      category: 'error',
      startDate,
      endDate,
    });

    const report: Report = {
      id: this.generateReportId(),
      name: 'Error Report',
      type: 'errors',
      period: { start: startDate, end: endDate },
      data: {
        totalErrors: events.length,
        errorsByType: this.groupByAction(events),
        errorTimeline: this.getTimeline(events),
        topErrors: this.getTopActions(events),
      },
      generatedAt: new Date(),
    };

    this.reports.set(report.id, report);

    return report;
  }

  /**
   * Get report by ID
   */
  getReport(id: string): Report | undefined {
    return this.reports.get(id);
  }

  /**
   * List all reports
   */
  listReports(type?: Report['type']): Report[] {
    let reports = Array.from(this.reports.values());

    if (type) {
      reports = reports.filter(r => r.type === type);
    }

    return reports.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  }

  /**
   * Export report to JSON
   */
  exportJSON(reportId: string): string {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    return JSON.stringify(report, null, 2);
  }

  /**
   * Export report to CSV
   */
  exportCSV(reportId: string): string {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    // Simple CSV export for timeline data
    if (report.data.timeline) {
      let csv = 'Date,Count\n';
      for (const [date, count] of Object.entries(report.data.timeline)) {
        csv += `${date},${count}\n`;
      }
      return csv;
    }

    return '';
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private getTopCategories(events: AnalyticsEvent[]): Array<{ category: string; count: number }> {
    const counts = new Map<string, number>();

    for (const event of events) {
      counts.set(event.category, (counts.get(event.category) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }

  private getTopActions(events: AnalyticsEvent[]): Array<{ action: string; count: number }> {
    const counts = new Map<string, number>();

    for (const event of events) {
      counts.set(event.action, (counts.get(event.action) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getTimeline(events: AnalyticsEvent[]): Record<string, number> {
    const timeline: Record<string, number> = {};

    for (const event of events) {
      const date = event.timestamp.toISOString().split('T')[0];
      timeline[date] = (timeline[date] || 0) + 1;
    }

    return timeline;
  }

  private getAverageValue(events: AnalyticsEvent[]): number {
    const values = events.map(e => e.value || 0);
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  }

  private getPercentile(events: AnalyticsEvent[], percentile: number): number {
    const values = events.map(e => e.value || 0).sort((a, b) => a - b);
    if (values.length === 0) return 0;

    const index = Math.floor(values.length * percentile);
    return values[index];
  }

  private getSlowest(events: AnalyticsEvent[], limit: number): Array<{ action: string; value: number }> {
    return events
      .map(e => ({ action: e.action, value: e.value || 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  private groupByAction(events: AnalyticsEvent[]): Record<string, number> {
    const groups: Record<string, number> = {};

    for (const event of events) {
      groups[event.action] = (groups[event.action] || 0) + 1;
    }

    return groups;
  }
}

/**
 * Dashboard Manager
 */
export class DashboardManager {
  private widgets: Map<string, DashboardWidget> = new Map();

  constructor(private tracker: AnalyticsTracker) {}

  /**
   * Add widget to dashboard
   */
  addWidget(widget: DashboardWidget): void {
    this.widgets.set(widget.id, widget);
    eventBus.emitSync('dashboard.widget_added', widget, 'DashboardManager');
  }

  /**
   * Remove widget
   */
  removeWidget(widgetId: string): void {
    this.widgets.delete(widgetId);
    eventBus.emitSync('dashboard.widget_removed', { widgetId }, 'DashboardManager');
  }

  /**
   * Get widget data
   */
  getWidgetData(widgetId: string): any {
    const widget = this.widgets.get(widgetId);
    if (!widget) return null;

    const events = this.tracker.query(widget.query);

    switch (widget.type) {
      case 'metric':
        return {
          value: this.tracker.aggregate(widget.query),
        };

      case 'chart':
        return {
          data: this.tracker.groupByTime(widget.query),
        };

      case 'table':
        return {
          rows: events.slice(0, widget.query.limit || 10),
        };

      case 'timeline':
        return {
          events: events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
        };
    }
  }

  /**
   * Get all widgets
   */
  getWidgets(): DashboardWidget[] {
    return Array.from(this.widgets.values());
  }

  /**
   * Create default dashboard
   */
  static createDefault(): DashboardWidget[] {
    return [
      {
        id: 'total-events',
        type: 'metric',
        title: 'Total Events',
        query: { aggregation: 'count' },
      },
      {
        id: 'events-timeline',
        type: 'chart',
        title: 'Events Over Time',
        query: { groupBy: 'day' },
        refreshInterval: 60000,
      },
      {
        id: 'top-actions',
        type: 'table',
        title: 'Top Actions',
        query: { limit: 10 },
      },
      {
        id: 'recent-events',
        type: 'timeline',
        title: 'Recent Events',
        query: { limit: 20 },
        refreshInterval: 30000,
      },
    ];
  }
}

/**
 * Insights Engine
 */
export class InsightsEngine {
  private insights: Insight[] = [];

  constructor(private tracker: AnalyticsTracker) {}

  /**
   * Analyze and generate insights
   */
  async analyze(): Promise<Insight[]> {
    this.insights = [];

    // Detect trends
    await this.detectTrends();

    // Detect anomalies
    await this.detectAnomalies();

    // Generate recommendations
    await this.generateRecommendations();

    return this.insights;
  }

  /**
   * Get insights
   */
  getInsights(filter?: { type?: Insight['type']; minConfidence?: number }): Insight[] {
    let insights = [...this.insights];

    if (filter?.type) {
      insights = insights.filter(i => i.type === filter.type);
    }

    if (filter?.minConfidence) {
      insights = insights.filter(i => i.confidence >= filter.minConfidence);
    }

    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  private async detectTrends(): Promise<void> {
    // Simple trend detection: compare last 7 days to previous 7 days
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prev7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const recentCount = this.tracker.count({ startDate: last7Days, endDate: now });
    const previousCount = this.tracker.count({ startDate: prev7Days, endDate: last7Days });

    if (previousCount > 0) {
      const change = ((recentCount - previousCount) / previousCount) * 100;

      if (Math.abs(change) > 20) {
        this.insights.push({
          id: this.generateInsightId(),
          type: 'trend',
          title: change > 0 ? 'Activity Increasing' : 'Activity Decreasing',
          description: `Activity has ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}% in the last 7 days`,
          severity: Math.abs(change) > 50 ? 'high' : 'medium',
          confidence: 0.85,
          timestamp: new Date(),
          data: { change, recentCount, previousCount },
        });
      }
    }
  }

  private async detectAnomalies(): Promise<void> {
    // Simple anomaly detection: find unusually high error rates
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const totalEvents = this.tracker.count({ startDate: last24Hours });
    const errorEvents = this.tracker.count({
      category: 'error',
      startDate: last24Hours,
    });

    if (totalEvents > 0) {
      const errorRate = errorEvents / totalEvents;

      if (errorRate > 0.1) {
        this.insights.push({
          id: this.generateInsightId(),
          type: 'anomaly',
          title: 'High Error Rate Detected',
          description: `Error rate is ${(errorRate * 100).toFixed(1)}% in the last 24 hours`,
          severity: errorRate > 0.2 ? 'high' : 'medium',
          confidence: 0.9,
          timestamp: new Date(),
          data: { errorRate, totalEvents, errorEvents },
        });
      }
    }
  }

  private async generateRecommendations(): Promise<void> {
    // Check for low activity
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentCount = this.tracker.count({ startDate: last7Days });

    if (recentCount < 10) {
      this.insights.push({
        id: this.generateInsightId(),
        type: 'recommendation',
        title: 'Low Activity',
        description: 'Consider enabling more analytics tracking to get better insights',
        severity: 'low',
        confidence: 0.7,
        timestamp: new Date(),
      });
    }
  }

  private generateInsightId(): string {
    return `insight_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Singleton instances
 */
export const analyticsTracker = new AnalyticsTracker();
export const reportGenerator = new ReportGenerator(analyticsTracker);
export const dashboardManager = new DashboardManager(analyticsTracker);
export const insightsEngine = new InsightsEngine(analyticsTracker);

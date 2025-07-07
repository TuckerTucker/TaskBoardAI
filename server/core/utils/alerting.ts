import { ObservableLogger } from './observability.js';
import { ErrorEvent } from './errorTracking.js';

export interface AlertChannel {
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'console';
  enabled: boolean;
  config: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: string[];
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered?: string;
}

export interface AlertCondition {
  type: 'error_rate' | 'error_pattern' | 'performance' | 'health_check' | 'custom';
  threshold?: number;
  timeWindow?: number; // minutes
  pattern?: string | RegExp;
  metric?: string;
  operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
}

export interface Alert {
  id: string;
  ruleId: string;
  timestamp: string;
  severity: AlertRule['severity'];
  title: string;
  message: string;
  data?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

export class AlertManager {
  private static instance: AlertManager;
  private observableLogger: ObservableLogger;
  private channels: Map<string, AlertChannel> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private maxAlertHistory = 1000;

  private constructor() {
    this.observableLogger = ObservableLogger.getInstance();
    this.initializeDefaultChannels();
    this.initializeDefaultRules();
  }

  static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  private initializeDefaultChannels(): void {
    // Console channel (always available)
    this.channels.set('console', {
      name: 'Console',
      type: 'console',
      enabled: true,
      config: {}
    });

    // Email channel (requires configuration)
    this.channels.set('email', {
      name: 'Email',
      type: 'email',
      enabled: false,
      config: {
        smtp: {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        },
        from: process.env.ALERT_EMAIL_FROM,
        to: process.env.ALERT_EMAIL_TO?.split(',') || []
      }
    });

    // Slack channel (requires webhook URL)
    this.channels.set('slack', {
      name: 'Slack',
      type: 'slack',
      enabled: !!process.env.SLACK_WEBHOOK_URL,
      config: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_ALERT_CHANNEL || '#alerts',
        username: 'TaskBoardAI Alerts'
      }
    });

    // Generic webhook channel
    this.channels.set('webhook', {
      name: 'Webhook',
      type: 'webhook',
      enabled: !!process.env.ALERT_WEBHOOK_URL,
      config: {
        url: process.env.ALERT_WEBHOOK_URL,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.ALERT_WEBHOOK_TOKEN && {
            'Authorization': `Bearer ${process.env.ALERT_WEBHOOK_TOKEN}`
          })
        }
      }
    });
  }

  private initializeDefaultRules(): void {
    // High error rate rule
    this.rules.set('high_error_rate', {
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: {
        type: 'error_rate',
        threshold: 10, // errors per minute
        timeWindow: 5 // 5 minute window
      },
      severity: 'high',
      channels: ['console', 'slack', 'email'],
      enabled: true,
      cooldownMinutes: 15
    });

    // Critical error pattern rule
    this.rules.set('critical_errors', {
      id: 'critical_errors',
      name: 'Critical Error Detected',
      condition: {
        type: 'error_pattern',
        pattern: /out of memory|heap out of memory|EMFILE|critical/i
      },
      severity: 'critical',
      channels: ['console', 'slack', 'email', 'webhook'],
      enabled: true,
      cooldownMinutes: 5
    });

    // Health check failure rule
    this.rules.set('health_check_failure', {
      id: 'health_check_failure',
      name: 'Health Check Failure',
      condition: {
        type: 'health_check',
        threshold: 1 // any failure
      },
      severity: 'high',
      channels: ['console', 'slack'],
      enabled: true,
      cooldownMinutes: 10
    });

    // Performance degradation rule
    this.rules.set('slow_response', {
      id: 'slow_response',
      name: 'Slow Response Times',
      condition: {
        type: 'performance',
        metric: 'response_time_p95',
        threshold: 5000, // 5 seconds
        operator: 'gt'
      },
      severity: 'medium',
      channels: ['console', 'slack'],
      enabled: true,
      cooldownMinutes: 30
    });
  }

  async checkErrorRate(errors: ErrorEvent[]): Promise<void> {
    const rule = this.rules.get('high_error_rate');
    if (!rule || !rule.enabled) return;

    const now = new Date();
    const timeWindow = (rule.condition.timeWindow || 5) * 60 * 1000; // Convert to milliseconds
    const recentErrors = errors.filter(error => 
      new Date(error.timestamp).getTime() > now.getTime() - timeWindow
    );

    if (recentErrors.length >= (rule.condition.threshold || 10)) {
      await this.triggerAlert(rule, 'High Error Rate Detected', 
        `${recentErrors.length} errors in the last ${rule.condition.timeWindow} minutes`, 
        { errorCount: recentErrors.length, timeWindow: rule.condition.timeWindow }
      );
    }
  }

  async checkErrorPattern(error: ErrorEvent): Promise<void> {
    for (const rule of this.rules.values()) {
      if (rule.condition.type === 'error_pattern' && rule.enabled) {
        const pattern = rule.condition.pattern;
        const errorText = `${error.message} ${error.error || ''}`;

        let matches = false;
        if (pattern instanceof RegExp) {
          matches = pattern.test(errorText);
        } else if (typeof pattern === 'string') {
          matches = errorText.toLowerCase().includes(pattern.toLowerCase());
        }

        if (matches) {
          await this.triggerAlert(rule, 'Critical Error Pattern Detected',
            `Error pattern matched: ${error.message}`,
            { errorId: error.id, errorEvent: error }
          );
          break; // Only trigger one pattern rule per error
        }
      }
    }
  }

  async checkHealthStatus(healthResults: Record<string, any>): Promise<void> {
    const rule = this.rules.get('health_check_failure');
    if (!rule || !rule.enabled) return;

    const failedChecks = Object.entries(healthResults)
      .filter(([, result]: [string, any]) => !result.healthy)
      .map(([component]) => component);

    if (failedChecks.length > 0) {
      await this.triggerAlert(rule, 'Health Check Failures',
        `Failed health checks: ${failedChecks.join(', ')}`,
        { failedChecks, healthResults }
      );
    }
  }

  async checkPerformanceMetrics(metrics: Record<string, any>): Promise<void> {
    for (const rule of this.rules.values()) {
      if (rule.condition.type === 'performance' && rule.enabled) {
        const metric = rule.condition.metric;
        const threshold = rule.condition.threshold;
        const operator = rule.condition.operator || 'gt';

        if (metric && threshold !== undefined && metrics[metric] !== undefined) {
          const value = metrics[metric];
          let shouldAlert = false;

          switch (operator) {
            case 'gt':
              shouldAlert = value > threshold;
              break;
            case 'gte':
              shouldAlert = value >= threshold;
              break;
            case 'lt':
              shouldAlert = value < threshold;
              break;
            case 'lte':
              shouldAlert = value <= threshold;
              break;
            case 'eq':
              shouldAlert = value === threshold;
              break;
          }

          if (shouldAlert) {
            await this.triggerAlert(rule, 'Performance Threshold Exceeded',
              `${metric}: ${value} ${operator} ${threshold}`,
              { metric, value, threshold, operator }
            );
          }
        }
      }
    }
  }

  private async triggerAlert(rule: AlertRule, title: string, message: string, data?: Record<string, any>): Promise<void> {
    // Check cooldown
    if (rule.lastTriggered) {
      const lastTriggered = new Date(rule.lastTriggered);
      const cooldownEnd = new Date(lastTriggered.getTime() + rule.cooldownMinutes * 60 * 1000);
      if (new Date() < cooldownEnd) {
        return; // Still in cooldown period
      }
    }

    const alert: Alert = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      timestamp: new Date().toISOString(),
      severity: rule.severity,
      title,
      message,
      data,
      resolved: false
    };

    // Update rule last triggered time
    rule.lastTriggered = alert.timestamp;

    // Store alert
    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.unshift(alert);
    if (this.alertHistory.length > this.maxAlertHistory) {
      this.alertHistory = this.alertHistory.slice(0, this.maxAlertHistory);
    }

    // Log the alert
    this.observableLogger.error('ALERT TRIGGERED', {
      alertId: alert.id,
      ruleId: rule.id,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      data: alert.data
    });

    // Send notifications
    await this.sendNotifications(rule, alert);
  }

  private async sendNotifications(rule: AlertRule, alert: Alert): Promise<void> {
    for (const channelName of rule.channels) {
      const channel = this.channels.get(channelName);
      if (channel && channel.enabled) {
        try {
          await this.sendToChannel(channel, alert);
        } catch (error) {
          this.observableLogger.error('Failed to send alert notification', {
            alertId: alert.id,
            channel: channelName,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
  }

  private async sendToChannel(channel: AlertChannel, alert: Alert): Promise<void> {
    switch (channel.type) {
      case 'console':
        await this.sendToConsole(alert);
        break;
      case 'slack':
        await this.sendToSlack(channel, alert);
        break;
      case 'email':
        await this.sendToEmail(channel, alert);
        break;
      case 'webhook':
        await this.sendToWebhook(channel, alert);
        break;
    }
  }

  private async sendToConsole(alert: Alert): Promise<void> {
    const severityEmoji = {
      low: '🟡',
      medium: '🟠',
      high: '🔴',
      critical: '🚨'
    };

    console.error(`\n${severityEmoji[alert.severity]} ALERT [${alert.severity.toUpperCase()}]`);
    console.error(`Time: ${new Date(alert.timestamp).toLocaleString()}`);
    console.error(`Title: ${alert.title}`);
    console.error(`Message: ${alert.message}`);
    if (alert.data) {
      console.error(`Data: ${JSON.stringify(alert.data, null, 2)}`);
    }
    console.error(`Alert ID: ${alert.id}\n`);
  }

  private async sendToSlack(channel: AlertChannel, alert: Alert): Promise<void> {
    if (!channel.config.webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const severityColor = {
      low: '#ffeb3b',
      medium: '#ff9800',
      high: '#f44336',
      critical: '#9c27b0'
    };

    const payload = {
      channel: channel.config.channel,
      username: channel.config.username,
      attachments: [{
        color: severityColor[alert.severity],
        title: `${alert.severity.toUpperCase()}: ${alert.title}`,
        text: alert.message,
        timestamp: Math.floor(new Date(alert.timestamp).getTime() / 1000),
        fields: [
          {
            title: 'Alert ID',
            value: alert.id,
            short: true
          },
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          }
        ]
      }]
    };

    const response = await fetch(channel.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }
  }

  private async sendToEmail(channel: AlertChannel, alert: Alert): Promise<void> {
    // This would require a proper email library like nodemailer
    // For now, we'll just log that an email would be sent
    this.observableLogger.info('Email alert would be sent', {
      alertId: alert.id,
      to: channel.config.to,
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`
    });
  }

  private async sendToWebhook(channel: AlertChannel, alert: Alert): Promise<void> {
    if (!channel.config.url) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      alert,
      timestamp: new Date().toISOString(),
      source: 'TaskBoardAI'
    };

    const response = await fetch(channel.config.url, {
      method: channel.config.method || 'POST',
      headers: channel.config.headers || { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook error: ${response.statusText}`);
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async resolveAlert(alertId: string, resolvedBy: string, notes?: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();
    alert.resolvedBy = resolvedBy;

    // Remove from active alerts
    this.activeAlerts.delete(alertId);

    this.observableLogger.info('Alert resolved', {
      alertId,
      resolvedBy,
      notes
    });

    return true;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(limit = 100): Alert[] {
    return this.alertHistory.slice(0, limit);
  }

  addAlertRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.observableLogger.info('Alert rule added', { ruleId: rule.id, rule });
  }

  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    Object.assign(rule, updates);
    this.observableLogger.info('Alert rule updated', { ruleId, updates });
    return true;
  }

  deleteAlertRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    if (deleted) {
      this.observableLogger.info('Alert rule deleted', { ruleId });
    }
    return deleted;
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  addAlertChannel(channel: AlertChannel): void {
    this.channels.set(channel.name.toLowerCase(), channel);
    this.observableLogger.info('Alert channel added', { channelName: channel.name });
  }

  updateAlertChannel(channelName: string, updates: Partial<AlertChannel>): boolean {
    const channel = this.channels.get(channelName.toLowerCase());
    if (!channel) {
      return false;
    }

    Object.assign(channel, updates);
    this.observableLogger.info('Alert channel updated', { channelName, updates });
    return true;
  }

  getAlertChannels(): AlertChannel[] {
    return Array.from(this.channels.values());
  }
}
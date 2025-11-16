/**
 * Sistema de monitoreo y logging centralizado
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  userId?: string;
  propertyId?: string;
  page?: string;
  component?: string;
  action?: string;
  [key: string]: any;
}

class MonitoringService {
  private isDev: boolean;

  constructor() {
    this.isDev = import.meta.env.DEV;
  }

  /**
   * Log genérico
   */
  log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...context,
    };

    if (this.isDev) {
      const style = this.getConsoleStyle(level);
      console.log(`%c[${level.toUpperCase()}]`, style, message, context || '');
    }

    if (!this.isDev && level !== 'debug') {
      this.sendToBackend(logData);
    }
  }

  /**
   * Capturar excepción
   */
  captureException(error: Error, context?: LogContext) {
    console.error('Exception captured:', error, context);

    this.log('error', error.message, {
      ...context,
      stack: error.stack,
      name: error.name,
    });
  }

  /**
   * Métricas de performance
   */
  trackPerformance(name: string, duration: number, context?: LogContext) {
    this.log('info', `Performance: ${name}`, {
      ...context,
      duration,
      metric: 'performance',
    });
  }

  /**
   * Track user action
   */
  trackEvent(eventName: string, properties?: Record<string, any>) {
    this.log('info', `Event: ${eventName}`, {
      event: eventName,
      ...properties,
    });
  }

  /**
   * Helpers
   */
  private getConsoleStyle(level: LogLevel): string {
    const styles: Record<LogLevel, string> = {
      debug: 'color: #888; font-weight: normal;',
      info: 'color: #2196F3; font-weight: bold;',
      warn: 'color: #FF9800; font-weight: bold;',
      error: 'color: #F44336; font-weight: bold;',
    };
    return styles[level];
  }

  private async sendToBackend(logData: any) {
    try {
      // TODO: Implementar endpoint de logging
    } catch (error) {
      // Silently fail
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext) {
    this.log('error', message, context);
  }
}

export const monitoring = new MonitoringService();

export const useMonitoring = () => {
  return {
    log: monitoring.log.bind(monitoring),
    captureException: monitoring.captureException.bind(monitoring),
    trackPerformance: monitoring.trackPerformance.bind(monitoring),
    trackEvent: monitoring.trackEvent.bind(monitoring),
    debug: monitoring.debug.bind(monitoring),
    info: monitoring.info.bind(monitoring),
    warn: monitoring.warn.bind(monitoring),
    error: monitoring.error.bind(monitoring),
  };
};

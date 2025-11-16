/**
 * Sistema de monitoreo y logging centralizado
 * Integrado con Sentry para error tracking y performance monitoring
 */

import * as SentryLib from './sentry';

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

    // Console logging en desarrollo
    if (this.isDev) {
      const style = this.getConsoleStyle(level);
      console.log(`%c[${level.toUpperCase()}]`, style, message, context || '');
    }

    // Enviar a Sentry en producción
    if (!this.isDev) {
      this.sendToSentry(level, message, context);
    }
  }

  /**
   * Capturar excepción con Sentry
   */
  captureException(error: Error, context?: LogContext) {
    console.error('Exception captured:', error, context);

    // Agregar breadcrumb para contexto
    if (context) {
      SentryLib.addBreadcrumb({
        message: 'Exception context',
        category: 'error',
        level: 'error',
        data: context,
      });
    }

    // Capturar en Sentry
    SentryLib.captureException(error, context);

    // Log local
    this.log('error', error.message, {
      ...context,
      stack: error.stack,
      name: error.name,
    });
  }

  /**
   * Métricas de performance con Sentry
   */
  trackPerformance(name: string, duration: number, context?: LogContext) {
    this.log('info', `Performance: ${name}`, {
      ...context,
      duration,
      metric: 'performance',
    });

    // Enviar métrica a Sentry como custom measurement
    if (!this.isDev) {
      SentryLib.addBreadcrumb({
        message: `Performance: ${name}`,
        category: 'performance',
        level: 'info',
        data: {
          duration,
          ...context,
        },
      });
    }
  }

  /**
   * Track user action con breadcrumbs
   */
  trackEvent(eventName: string, properties?: Record<string, any>) {
    this.log('info', `Event: ${eventName}`, {
      event: eventName,
      ...properties,
    });

    // Agregar breadcrumb a Sentry
    SentryLib.addBreadcrumb({
      message: eventName,
      category: 'user-action',
      level: 'info',
      data: properties,
    });
  }

  /**
   * Enviar logs a Sentry según nivel
   */
  private sendToSentry(level: LogLevel, message: string, context?: LogContext) {
    const sentryLevel = this.mapToSentryLevel(level);
    
    if (level === 'error') {
      SentryLib.captureMessage(message, sentryLevel, context);
    } else if (level === 'warn') {
      SentryLib.captureMessage(message, sentryLevel, context);
    }
    // info y debug no se envían a Sentry por defecto
  }

  /**
   * Mapear nivel de log a nivel de Sentry
   */
  private mapToSentryLevel(level: LogLevel): 'fatal' | 'error' | 'warning' | 'info' | 'debug' {
    const map: Record<LogLevel, 'fatal' | 'error' | 'warning' | 'info' | 'debug'> = {
      debug: 'debug',
      info: 'info',
      warn: 'warning',
      error: 'error',
    };
    return map[level];
  }

  /**
   * Helpers de estilo para consola
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

  // Métodos de conveniencia
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

// Re-exportar funciones de Sentry para uso directo
export { setUser, clearUser, addBreadcrumb } from './sentry';

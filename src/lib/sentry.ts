/**
 * Configuración centralizada de Sentry
 * Fase 3: Monitoreo y Error Tracking
 */

import * as Sentry from '@sentry/react';
import { 
  browserTracingIntegration, 
  replayIntegration,
  reactRouterV6BrowserTracingIntegration 
} from '@sentry/react';
import { useEffect } from 'react';
import { 
  useLocation, 
  useNavigationType, 
  createRoutesFromChildren, 
  matchRoutes 
} from 'react-router-dom';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const IS_PRODUCTION = import.meta.env.PROD;
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

// Diagnóstico de carga del DSN
console.log('🔍 Sentry DSN loaded:', SENTRY_DSN ? 'YES' : 'NO');
if (SENTRY_DSN) {
  console.log('🔍 Sentry DSN value:', SENTRY_DSN.substring(0, 30) + '...');
}

export const initSentry = () => {
  if (!SENTRY_DSN) {
    console.warn('⚠️ Sentry DSN no configurado. Monitoring deshabilitado.');
    console.warn('💡 Configura VITE_SENTRY_DSN en las variables de entorno.');
    return;
  }

  console.log('✅ Inicializando Sentry...');

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: IS_PRODUCTION ? 'production' : 'preview',
    release: `kentra@${APP_VERSION}`,
    
    // Sampling: capturar 100% de errores, 10% de transacciones en producción
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,
    
    // Capturar replays de sesión en caso de error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      browserTracingIntegration(),
      replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
      // Integración con React Router v6 para trackear navegación
      reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],

    // Filtrar información sensible
    beforeSend(event, hint) {
      // Limpiar datos sensibles
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }

      return event;
    },

    // Ignorar errores comunes del navegador
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'ChunkLoadError',
    ],
  });

  console.log('✅ Sentry inicializado correctamente');
};

// Helpers para capturar excepciones con contexto
export const captureException = (
  error: Error,
  context?: Record<string, any>
) => {
  if (context) {
    Sentry.setContext('custom', context);
  }
  Sentry.captureException(error);
};

export const captureMessage = (
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
) => {
  if (context) {
    Sentry.setContext('custom', context);
  }
  Sentry.captureMessage(message, level);
};

export const setUser = (user: {
  id: string;
  email?: string;
  username?: string;
}) => {
  Sentry.setUser(user);
};

export const clearUser = () => {
  Sentry.setUser(null);
};

export const addBreadcrumb = (breadcrumb: {
  message: string;
  category?: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, any>;
}) => {
  Sentry.addBreadcrumb(breadcrumb);
};

// Performance monitoring
export const startTransaction = (name: string, op: string) => {
  const transaction = Sentry.startSpan({ name, op }, (span) => span);
  return transaction;
};

export { Sentry };

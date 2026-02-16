const API_ENDPOINT = '/api/feedback/log';

interface FeedbackContext {
  url?: string;
  component?: string;
  userAgent?: string;
  [key: string]: string | number | boolean | null | undefined;
}

interface FeedbackMetadata {
  [key: string]: string | number | boolean | object | null | undefined;
}

async function logEvent(
  eventType: 'error' | 'api_failure' | 'user_action' | 'performance' | 'data_issue',
  severity: 'critical' | 'error' | 'warning' | 'info',
  message: string,
  context?: FeedbackContext,
  stackTrace?: string,
  metadata?: FeedbackMetadata
): Promise<void> {
  try {
    await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        eventType,
        severity,
        message,
        context: {
          url: typeof window !== 'undefined' ? window.location.href : undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          ...context,
        },
        stackTrace,
        metadata,
      }),
    });
  } catch (e) {
    // Silently fail - we don't want feedback logging to cause issues
    console.debug('[Feedback] Failed to log event:', e);
  }
}

export const feedbackLogger = {
  logError: (error: Error, context?: FeedbackContext): void => {
    logEvent(
      'error',
      'error',
      error.message || 'Unknown error',
      context,
      error.stack
    );
  },

  logCriticalError: (error: Error, context?: FeedbackContext): void => {
    logEvent(
      'error',
      'critical',
      error.message || 'Critical error',
      context,
      error.stack
    );
  },

  logApiFailure: (
    url: string,
    status: number,
    response: string | object | null,
    context?: FeedbackContext
  ): void => {
    const severity = status >= 500 ? 'error' : 'warning';
    logEvent(
      'api_failure',
      severity,
      `API ${status}: ${url}`,
      { url: typeof window !== 'undefined' ? window.location.href : undefined, ...context },
      undefined,
      {
        apiUrl: url,
        status,
        response: typeof response === 'string' ? response.slice(0, 500) : response,
      }
    );
  },

  logUserAction: (action: string, context?: FeedbackContext): void => {
    logEvent('user_action', 'info', action, context);
  },

  logPerformance: (
    metric: string,
    value: number,
    context?: FeedbackContext
  ): void => {
    logEvent(
      'performance',
      value > 5000 ? 'warning' : 'info',
      `${metric}: ${value}ms`,
      context,
      undefined,
      { metric, value }
    );
  },

  logDataIssue: (
    message: string,
    context?: FeedbackContext,
    metadata?: FeedbackMetadata
  ): void => {
    logEvent('data_issue', 'warning', message, context, undefined, metadata);
  },
};

/**
 * Centralized logging utility for RPrime
 * Provides environment-aware logging with proper log levels
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    
    if (this.isProduction) {
      // Structured JSON logging for production (better for log aggregation)
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...context,
      });
    } else {
      // Human-readable format for development
      const formattedTime = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      return `${formattedTime} [${level.toUpperCase()}] ${message}${contextStr}`;
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage(LogLevel.INFO, message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      ...(error instanceof Error && {
        error: {
          message: error.message,
          stack: this.isDevelopment ? error.stack : undefined,
          name: error.name,
        },
      }),
    };
    
    console.error(this.formatMessage(LogLevel.ERROR, message, errorContext));
  }

  /**
   * Legacy compatibility: log with source identifier
   * Gradually migrate these to use specific log levels
   */
  log(message: string, source = 'express'): void {
    this.info(message, { source });
  }
}

// Export singleton instance
export const logger = new Logger();

// Helper to get error message from unknown error type
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

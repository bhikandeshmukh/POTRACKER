/**
 * Centralized logging utility
 * Provides consistent logging across the application with environment-based levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
}

class Logger {
  private config: LoggerConfig;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.config = {
      level: this.isDevelopment ? 'debug' : 'error',
      enableConsole: true,
      enableRemote: false, // Set to true when integrating with Sentry/LogRocket
    };
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug') && this.config.enableConsole) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info') && this.config.enableConsole) {
      console.info(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn') && this.config.enableConsole) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, error?: any, data?: any): void {
    if (this.shouldLog('error')) {
      const errorMessage = this.formatMessage('error', message, { error, ...data });
      
      if (this.config.enableConsole) {
        console.error(errorMessage);
        if (error?.stack) {
          console.error(error.stack);
        }
      }

      // TODO: Send to remote logging service (Sentry, LogRocket, etc.)
      if (this.config.enableRemote) {
        this.sendToRemote('error', message, error, data);
      }
    }
  }

  private sendToRemote(level: LogLevel, message: string, error?: any, data?: any): void {
    // Implement remote logging integration here
    // Example: Sentry.captureException(error, { extra: { message, data } });
  }

  // Performance logging
  time(label: string): void {
    if (this.isDevelopment) {
      console.time(label);
    }
  }

  timeEnd(label: string): void {
    if (this.isDevelopment) {
      console.timeEnd(label);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for testing
export { Logger };

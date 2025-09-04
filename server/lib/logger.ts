// Production-ready logging utility
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableApiLogging: boolean;
  enableCanvasLogging: boolean;
}

class Logger {
  private config: LoggerConfig;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    this.config = {
      level: isProduction ? LogLevel.WARN : LogLevel.DEBUG,
      enableConsole: !isProduction,
      enableApiLogging: !isProduction,
      enableCanvasLogging: !isProduction
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level;
  }

  private formatMessage(level: string, source: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `${timestamp} [${level}] [${source}] ${message}`;
    
    if (data && this.config.enableConsole) {
      return `${baseMessage} ${JSON.stringify(data)}`;
    }
    
    return baseMessage;
  }

  error(source: string, message: string, data?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', source, message, data));
    }
  }

  warn(source: string, message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', source, message, data));
    }
  }

  info(source: string, message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO) && this.config.enableConsole) {
      console.log(this.formatMessage('INFO', source, message, data));
    }
  }

  debug(source: string, message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG) && this.config.enableConsole) {
      console.log(this.formatMessage('DEBUG', source, message, data));
    }
  }

  // Specialized loggers for specific components
  api(method: string, path: string, status: number, duration: number, response?: any): void {
    if (!this.config.enableApiLogging) return;
    
    const message = `${method} ${path} ${status} in ${duration}ms`;
    if (status >= 400) {
      this.warn('API', message, response);
    } else {
      this.debug('API', message, response && JSON.stringify(response).length < 200 ? response : '[truncated]');
    }
  }

  canvas(message: string, data?: any): void {
    if (this.config.enableCanvasLogging) {
      this.debug('Canvas', message, data);
    }
  }

  scheduler(message: string, data?: any): void {
    this.info('Scheduler', message, data);
  }
}

// Export singleton instance
export const logger = new Logger();
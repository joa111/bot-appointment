import React from 'react';
import { toast } from "@/hooks/use-toast";

export interface AppError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  timestamp: Date;
  userMessage: string;
}

export class ErrorLogger {
  private static instance: ErrorLogger;
  private logs: AppError[] = [];

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  log(error: Partial<AppError>): void {
    const appError: AppError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      severity: error.severity || 'medium',
      context: error.context || {},
      timestamp: new Date(),
      userMessage: error.userMessage || 'Something went wrong. Please try again.',
    };

    this.logs.push(appError);
    
    // Console logging for development
    if (process.env.NODE_ENV === 'development') {
      console.error('[AppError]', appError);
    }

    // Send to external logging service in production
    if (process.env.NODE_ENV === 'production' && appError.severity === 'critical') {
      this.sendToLoggingService(appError);
    }
  }

  private async sendToLoggingService(error: AppError): Promise<void> {
    try {
      // In a real app, send to services like Sentry, LogRocket, etc.
      console.error('Critical error logged:', error);
    } catch (e) {
      console.error('Failed to send error to logging service:', e);
    }
  }

  getLogs(): AppError[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}

// Error handling utilities
export const handleDatabaseError = (error: any, operation: string): void => {
  const logger = ErrorLogger.getInstance();
  
  let userMessage = 'Something went wrong. Please try again.';
  let severity: AppError['severity'] = 'medium';
  
  if (error?.code === 'PGRST116') {
    userMessage = 'No data found for your request.';
    severity = 'low';
  } else if (error?.code === '23505') {
    userMessage = 'This record already exists.';
    severity = 'low';
  } else if (error?.code === '42501') {
    userMessage = 'You don\'t have permission to perform this action.';
    severity = 'high';
  } else if (error?.message?.includes('JWT')) {
    userMessage = 'Your session has expired. Please log in again.';
    severity = 'medium';
  }

  logger.log({
    code: `DB_ERROR_${operation.toUpperCase()}`,
    message: error?.message || 'Database operation failed',
    severity,
    context: { operation, originalError: error },
    userMessage,
  });

  toast({
    variant: 'destructive',
    title: 'Error',
    description: userMessage,
  });
};

export const handleNetworkError = (error: any, operation: string): void => {
  const logger = ErrorLogger.getInstance();
  
  let userMessage = 'Network error. Please check your connection and try again.';
  let severity: AppError['severity'] = 'medium';
  
  if (error?.name === 'AbortError') {
    userMessage = 'Request timed out. Please try again.';
  } else if (error?.status >= 500) {
    userMessage = 'Server error. Please try again later.';
    severity = 'high';
  }

  logger.log({
    code: `NETWORK_ERROR_${operation.toUpperCase()}`,
    message: error?.message || 'Network request failed',
    severity,
    context: { operation, status: error?.status },
    userMessage,
  });

  toast({
    variant: 'destructive',
    title: 'Connection Error',
    description: userMessage,
  });
};

export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw new Error('Max retries exceeded');
};

// User-friendly error boundaries
export const createErrorBoundary = (fallbackComponent: React.ComponentType<{ error: Error }>) => {
  return class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error?: Error }
  > {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      const logger = ErrorLogger.getInstance();
      logger.log({
        code: 'REACT_ERROR_BOUNDARY',
        message: error.message,
        severity: 'high',
        context: { errorInfo, stack: error.stack },
        userMessage: 'Something went wrong with this section. Please refresh the page.',
      });
    }

    render() {
      if (this.state.hasError) {
        return React.createElement(fallbackComponent, { error: this.state.error! });
      }

      return this.props.children;
    }
  };
};

// Graceful degradation helpers
export const withFallback = <T>(
  primaryOperation: () => Promise<T>,
  fallbackOperation: () => Promise<T> | T,
  errorMessage?: string
): Promise<T> => {
  return primaryOperation().catch(async (error) => {
    const logger = ErrorLogger.getInstance();
    logger.log({
      code: 'FALLBACK_TRIGGERED',
      message: error?.message || 'Primary operation failed',
      severity: 'medium',
      context: { error },
      userMessage: errorMessage || 'Using backup method...',
    });

    return fallbackOperation();
  });
};
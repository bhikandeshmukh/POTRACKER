/**
 * Custom error classes for consistent error handling
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: any) {
    super(message, 500);
    if (originalError) {
      this.stack = originalError.stack;
    }
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

export class NetworkError extends AppError {
  constructor(message: string = 'Network request failed') {
    super(message, 503);
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  static handle(error: Error | AppError): {
    message: string;
    statusCode: number;
    isOperational: boolean;
  } {
    if (error instanceof AppError) {
      return {
        message: error.message,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
      };
    }

    // Handle Firebase errors
    if (error.message.includes('Firebase')) {
      return {
        message: 'Database operation failed',
        statusCode: 500,
        isOperational: true,
      };
    }

    // Handle network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return {
        message: 'Network request failed',
        statusCode: 503,
        isOperational: true,
      };
    }

    // Unknown error
    return {
      message: 'An unexpected error occurred',
      statusCode: 500,
      isOperational: false,
    };
  }

  /**
  * Returns a localized message suitable for displaying to the user based on the supplied error.
  * @example
  * getUserMessage(new Error('Invalid input'))
  * 'Invalid input. Please check your data and try again.'
  * @param {Error | AppError} error - Error object that may originate from application logic or third-party libraries.
  * @returns {string} Returns a friendly message describing the error circumstances or a default fallback.
  **/
  static getUserMessage(error: Error | AppError): string {
    const handled = this.handle(error);
    
    // Return user-friendly messages
    switch (handled.statusCode) {
      case 400:
        return 'Invalid input. Please check your data and try again.';
      case 401:
        return 'Please log in to continue.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 503:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return handled.isOperational 
          ? handled.message 
          : 'An unexpected error occurred. Please try again.';
    }
  }
}

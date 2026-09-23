import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/logger.service';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  LoggerService.error('GLOBAL_ERROR_HANDLER', `Unhandled error at ${req.method} ${req.originalUrl}: ${err.message}`, {
    stack: err.stack,
  });

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}

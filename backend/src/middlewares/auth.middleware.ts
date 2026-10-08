import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

/**
 * Validates internal API key header for incoming Android SMS ingestion.
 */
export function requireInternalApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['x-api-key'] || req.headers['authorization'];
  const queryKey = req.query.apiKey as string | undefined;
  const bodyKey = req.body?.syncKey || req.body?.apiKey;

  const keyToTest = authHeader
    ? (Array.isArray(authHeader) ? authHeader[0] : authHeader).replace(/^Bearer\s+/i, '')
    : (queryKey || bodyKey);

  if (!keyToTest || keyToTest !== config.internalSmsSyncKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing x-api-key header.',
    });
  }

  next();
}

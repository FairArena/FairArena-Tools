/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { NextFunction, Request, Response } from 'express';
import { aj } from './arcjet.js';

// Function to get client IP, handling proxies and containers
function getClientIP(req: Request): string {
  // In production, try X-Forwarded-For first (common for proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // X-Forwarded-For can be a comma-separated list, take the first (original client)
    const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ips = forwardedStr.split(',').map((ip: string) => ip.trim());
    return ips[0];
  }

  // Fallback to X-Real-IP (used by some proxies)
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp;
  }

  // Fallback to req.ip (set by Express trust proxy)
  if (req.ip) {
    return req.ip;
  }

  // Last resort: remote address
  return req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1';
}

export const arcjetMiddleware = async (req: Request, res: Response, next: NextFunction) => {

  if (
    req.path.startsWith('/health')
  ) {
    return next();
  }

  try {
    const decision = await aj.protect(req, { requested: 1, getClientIP: () => getClientIP(req) } as any);

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
        });
      } else if (decision.reason.isBot()) {
        return res.status(403).json({
          error: 'Bot access denied',
          message: 'Automated requests are not allowed.',
        });
      } else {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied by security policy.',
        });
      }
    }

    if (decision.results.some((result) => result.reason.isBot() && result.reason.isSpoofed())) {
      return res.status(403).json({
        error: 'Spoofed bot detected',
        message: 'Malicious bot activity detected.',
      });
    }

    next();
  } catch (error) {
    console.error('Arcjet middleware error:', { error });
    next();
  }
};
import rateLimit from 'express-rate-limit';

const rateLimitHandler = (_req: any, res: any) => {
  res.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Trop de tentatives, réessaye dans quelques minutes.',
    },
  });
};

/** Global fallback - all routes: 100 req / min */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** Login & MFA verify - brute-force protection: 10 req / 15 min */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** Signup & MFA generate - account creation: 5 req / hour */
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** Public link creation & redeem - anonymous abuse: 20 req / 15 min */
export const publicLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

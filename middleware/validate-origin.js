function buildAllowedOrigins() {
  const origins = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

  const configuredOrigins = String(
    process.env.APP_ORIGIN || '',
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  for (const origin of configuredOrigins) {
    origins.add(origin);
  }

  return origins;
}

const allowedOrigins = buildAllowedOrigins();

function validateOrigin(req, res, next) {
  const origin = String(req.get('origin') || '');

  if (!origin || !allowedOrigins.has(origin)) {
    return res.status(403).json({
      success: false,
      message: 'Недопустимый источник запроса.',
    });
  }

  return next();
}

export default validateOrigin;

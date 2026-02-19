'use strict';

/**
 * Standardized API response helpers.
 * All responses follow the same envelope format for consistency.
 */

function success(res, data, statusCode = 200, meta = {}) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

function error(res, code, message, statusCode = 400, field = null) {
  const body = {
    success: false,
    error: { code, message },
  };
  if (field) body.error.field = field;
  return res.status(statusCode).json(body);
}

function paginated(res, data, total, page, limit) {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    },
  });
}

module.exports = { success, error, paginated };

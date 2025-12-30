// Authentication middleware
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Optional auth - allows access but sets user if authenticated
export function optionalAuth(req, res, next) {
  // req.session.userId will be available if authenticated
  next();
}

// Get authenticated user ID
export function getUserId(req) {
  return req.session?.userId || null;
}

// Get user info from session
export function getUser(req) {
  return req.session?.user || null;
}

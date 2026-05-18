const { verifyToken } = require('../services/authService');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error:   'No token provided'
    });
  }

  const token = authHeader.split(' ')[1];
  const user  = await verifyToken(token);

  if (!user) {
    return res.status(401).json({
      success: false,
      error:   'Invalid or expired token'
    });
  }

  req.user = user;
  next();
}

module.exports = authMiddleware;
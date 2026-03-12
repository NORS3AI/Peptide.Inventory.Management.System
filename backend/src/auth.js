import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// JWT secret - in production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'oath-inventory-secret-change-in-production';

// Default password hash - password is "admin" by default
// In production, change this via environment variable
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync(
  process.env.DEFAULT_PASSWORD || 'admin',
  10
);

// Store password in memory (could be moved to database for multiple users)
let currentPasswordHash = DEFAULT_PASSWORD_HASH;

/**
 * Middleware to verify JWT token
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

/**
 * Login endpoint handler
 */
export async function login(req, res) {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    // Compare password with stored hash
    const isValid = await bcrypt.compare(password, currentPasswordHash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate JWT token (expires in 24 hours)
    const token = jwt.sign(
      { authenticated: true, timestamp: Date.now() },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      expiresIn: '24h'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * Change password endpoint handler
 */
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, currentPasswordHash);

    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    currentPasswordHash = await bcrypt.hash(newPassword, 10);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
}

/**
 * Verify token endpoint handler
 */
export function verifyToken(req, res) {
  // If we get here, the authenticateToken middleware already verified the token
  res.json({ valid: true });
}

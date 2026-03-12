# Security Guide - Oath Inventory System

## 🔐 Authentication Overview

Version 0.0.100-alpha introduces **password protection** for your inventory system. All data is now secured behind authentication.

---

## Default Login Credentials

**Default Password:** `admin`

⚠️ **CRITICAL: Change this password immediately after your first login!**

---

## How It Works

### JWT Token Authentication
- Uses industry-standard JSON Web Tokens (JWT)
- Tokens expire after 24 hours
- Stored securely in browser localStorage
- Automatically included in all API requests

### Security Features
- ✅ All API endpoints protected (except login and health check)
- ✅ Password hashing with bcrypt (10 rounds)
- ✅ Automatic logout on token expiration
- ✅ Session persistence across page refreshes
- ✅ Secure Bearer token transmission

---

## Using the System

### First Login
1. Start both backend and frontend servers
2. Navigate to http://localhost:5173
3. You'll see the login screen
4. Enter password: `admin`
5. Click "Login"

### Changing Your Password
1. After logging in, go to Settings (coming soon)
2. Or use the API directly:
   ```bash
   curl -X POST http://localhost:3001/api/auth/change-password \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"currentPassword":"admin","newPassword":"your-new-secure-password"}'
   ```

### Logging Out
- Your session will automatically expire after 24 hours
- Clear your browser cache to force logout
- Or call: `authApi.logout()` from browser console

---

## Security Best Practices

### Recommended Password Requirements
- **Minimum length:** 8-12 characters
- Use a mix of:
  - Uppercase letters (A-Z)
  - Lowercase letters (a-z)
  - Numbers (0-9)
  - Special characters (!@#$%^&*)
- Don't use common words or patterns
- Don't reuse passwords from other sites

### Examples of Strong Passwords
- `Peptide!2024#Secure`
- `0ath-Inv3nt0ry!$afe`
- `MyL@b$3cur3Pa$$`

### Server Security
1. **Change the JWT secret** (production only):
   ```bash
   # In backend/.env
   JWT_SECRET=your-long-random-secret-here-use-64-characters-minimum
   ```

2. **Use HTTPS in production** (not HTTP)
   - Prevents token interception
   - Protects password during login

3. **Regular backups** of your database:
   ```bash
   cp backend/data/inventory.db backups/inventory-$(date +%Y%m%d).db
   ```

---

## Token Management

### Token Storage
- Stored in `localStorage` as `oath_auth_token`
- Persists across browser sessions
- Cleared on logout

### Token Lifetime
- **Expires:** 24 hours from login
- **Renewal:** Login again to get new token
- **Auto-logout:** On expiration or 401 response

---

## API Authentication

### Making Authenticated Requests

All API requests (except `/api/health` and `/api/auth/login`) require authentication.

**Example with curl:**
```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"admin"}' | jq -r '.token')

# Use token to access protected endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/peptides
```

**Example with JavaScript:**
```javascript
// Login
const response = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'admin' })
});
const { token } = await response.json();

// Use token
const data = await fetch('http://localhost:3001/api/peptides', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## Authentication Endpoints

### Public Endpoints (No Auth Required)
- `GET /api/health` - Server health check
- `POST /api/auth/login` - Login with password

### Protected Endpoints (Auth Required)
- `GET /api/auth/verify` - Verify current token
- `POST /api/auth/change-password` - Change password
- `GET /api/peptides` - All inventory endpoints
- `GET /api/exclusions` - All exclusion endpoints
- `GET /api/label-history` - All label history endpoints

---

## Troubleshooting

### "Access token required" Error
- You're not logged in
- Token expired (24 hours)
- Token was cleared from localStorage
- **Solution:** Login again

### "Invalid or expired token" Error
- Token is malformed
- Token signature doesn't match
- Server JWT secret changed
- **Solution:** Logout and login again

### Can't Login - "Invalid password"
- Wrong password entered
- Default password may have been changed
- **Solution:**
  - Try default password: `admin`
  - Check server logs for password hash
  - Reset password by editing `backend/src/auth.js`

### Session Keeps Expiring
- Normal after 24 hours
- Browser clearing localStorage
- **Solution:**
  - Login when prompted
  - Don't clear browser data
  - Consider extending token expiration (edit `backend/src/auth.js`)

---

## Resetting Password

If you forget your password:

1. **Stop the backend server**

2. **Edit `backend/src/auth.js`**:
   ```javascript
   // Change this line to your new password
   const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('your-new-password', 10);
   ```

3. **Restart the backend server**

4. **Login with your new password**

---

## Production Deployment

For production, add these security enhancements:

### 1. Environment Variables
Create `backend/.env.production`:
```env
JWT_SECRET=your-extremely-long-random-secret-minimum-64-characters-abc123...
DEFAULT_PASSWORD=your-initial-secure-password
PORT=3001
NODE_ENV=production
```

### 2. HTTPS Only
- Use nginx or Apache reverse proxy
- Get SSL certificate (Let's Encrypt)
- Force HTTPS redirect

### 3. Rate Limiting
Add to `backend/src/server.js`:
```javascript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later'
});

app.post('/api/auth/login', loginLimiter, login);
```

### 4. Security Headers
```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

---

## Security Checklist

- [ ] Changed default password from "admin"
- [ ] Using strong password (12+ characters)
- [ ] JWT secret is random and secure (production)
- [ ] HTTPS enabled (production)
- [ ] Regular database backups scheduled
- [ ] Server logs monitored for suspicious activity
- [ ] Token expiration appropriate for use case
- [ ] Rate limiting enabled (production)
- [ ] Security headers configured (production)

---

## Support

For security issues or questions:
- Review this guide
- Check server logs: `/tmp/backend.log` or `/tmp/backend-auth.log`
- Test with curl commands above
- Verify token in browser DevTools → Application → Local Storage

---

## Version Information

- **Authentication Added:** v0.0.100-alpha
- **Auth Type:** JWT (JSON Web Tokens)
- **Password Hashing:** bcryptjs (10 rounds)
- **Token Expiration:** 24 hours
- **Default Password:** `admin`

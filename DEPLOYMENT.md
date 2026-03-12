# Oath Peptide Inventory System - Deployment Guide

## Critical Change: Backend Database Required

**Version 0.0.99-alpha introduces a permanent backend database.** Your data will now persist across browser cache clears!

## System Architecture

- **Frontend**: React + Vite (port 5173 for development)
- **Backend**: Node.js + Express (port 3001)
- **Database**: SQLite with WAL mode
- **Storage**: All peptide data now stored in `backend/data/inventory.db`

## Initial Setup

### 1. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Configuration

The environment files are already configured:

- `frontend/.env`: Points to `http://localhost:3001/api`
- `backend/.env`: Sets port to 3001

## Running the Application

You need to run **both** the backend and frontend:

### Option 1: Run in Separate Terminals

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Option 2: Production Build

**Build Frontend:**
```bash
cd frontend
npm run build
```

**Start Backend:**
```bash
cd backend
npm start
```

Then access the built frontend at `frontend/dist/index.html` or serve it with:
```bash
cd frontend
npm run preview
```

## Database Location

The SQLite database is stored at:
```
backend/data/inventory.db
```

### Backing Up Your Data

Simply copy the database file:
```bash
cp backend/data/inventory.db backend/data/inventory-backup-$(date +%Y%m%d).db
```

### Restoring Data

Replace the database file with your backup:
```bash
cp backend/data/inventory-backup-20240209.db backend/data/inventory.db
```

## Migrating from Old Version

If you have data in browser storage from versions before 0.0.99-alpha:

1. **Export your data** from the old version:
   - Go to Import/Export tab
   - Click "Download Current Inventory CSV"

2. **Start the new version** (both backend and frontend)

3. **Import your data**:
   - Go to Import/Export tab
   - Upload your CSV file
   - Choose "Replace All Inventory" mode

Your data is now permanently stored in the backend database!

## API Endpoints

The backend provides these REST API endpoints:

### Peptides
- `GET /api/peptides` - Get all peptides
- `GET /api/peptides/:id` - Get single peptide
- `POST /api/peptides` - Create new peptide
- `PUT /api/peptides/:id` - Update peptide
- `DELETE /api/peptides/:id` - Delete peptide
- `POST /api/peptides/bulk` - Bulk import peptides

### Exclusions
- `GET /api/exclusions` - Get all exclusions
- `POST /api/exclusions` - Add exclusion
- `DELETE /api/exclusions/:pattern` - Delete exclusion
- `POST /api/exclusions/bulk` - Bulk set exclusions

### Health Check
- `GET /api/health` - Server health check

## Troubleshooting

### Backend won't start
- Make sure port 3001 is not in use
- Check that `backend/data` directory exists (created automatically)
- Check logs for error messages

### Frontend can't connect to backend
- Verify backend is running on port 3001
- Check `frontend/.env` has correct API URL
- Open browser console for error messages

### Data not persisting
- Verify backend is running when you make changes
- Check that database file exists: `ls -lh backend/data/inventory.db`
- Check browser console for API errors

### Port conflicts
To change ports:

**Backend port:** Edit `backend/.env`
```env
PORT=3002
```

**Frontend API URL:** Edit `frontend/.env`
```env
VITE_API_URL=http://localhost:3002/api
```

## Development Notes

### Database Schema

The SQLite database uses these tables:

```sql
- peptides: Main inventory table
  - Primary key: peptideId
  - Indexes on: peptideName, quantity, labeledCount

- exclusions: Product exclusion patterns
  - Primary key: id (auto-increment)
  - Unique: pattern

- label_history: Labeling operation history
  - Foreign key to peptides(peptideId)
  - Tracks quantity, action, timestamp
```

### WAL Mode

The database uses Write-Ahead Logging (WAL) for:
- Better concurrent access
- Improved performance
- Reduced lock contention

### API Client

The frontend uses a centralized API client at `frontend/src/services/api.js` with:
- Proper error handling
- JSON serialization
- URL encoding for special characters

## Production Deployment

For production deployment:

1. Build the frontend:
```bash
cd frontend
npm run build
```

2. Serve the frontend (options):
   - Use a static file server (nginx, apache)
   - Use the built-in preview: `npm run preview`
   - Deploy to GitHub Pages: `npm run deploy`

3. Run backend with process manager:
```bash
# Install PM2 globally
npm install -g pm2

# Start backend
cd backend
pm2 start src/server.js --name oath-inventory-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

4. Configure reverse proxy (nginx example):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/Oath-Inventory/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Considerations

For production:

1. **Use HTTPS** for all connections
2. **Add authentication** to API endpoints
3. **Set up CORS** properly in `backend/src/server.js`
4. **Secure the database file** with proper permissions:
```bash
chmod 600 backend/data/inventory.db
```
5. **Use environment variables** for sensitive configuration
6. **Regular backups** of the database file

## Version Information

- Current Version: **0.0.99-alpha**
- Backend Migration: **v0.0.99-alpha** (February 2024)
- Breaking Change: Requires backend server

## Support

For issues or questions:
- Check the main [README.md](README.md)
- Review [TESTING.md](TESTING.md) for testing procedures
- Submit issues on GitHub repository

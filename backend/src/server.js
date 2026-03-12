import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import db from './database.js';
import { authenticateToken, login, changePassword, verifyToken } from './auth.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Ensure data directory exists
const dataDir = join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ========== PUBLIC ENDPOINTS ==========

// Health check - no authentication required
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Login endpoint - no authentication required
app.post('/api/auth/login', login);

// ========== PROTECTED ENDPOINTS ==========
// All endpoints below require authentication

// Verify token endpoint
app.get('/api/auth/verify', authenticateToken, verifyToken);

// Change password endpoint
app.post('/api/auth/change-password', authenticateToken, changePassword);

// ========== PEPTIDES ENDPOINTS ==========

// Get all peptides
app.get('/api/peptides', authenticateToken, (req, res) => {
  try {
    const peptides = db.prepare('SELECT * FROM peptides ORDER BY peptideId').all();
    res.json(peptides);
  } catch (error) {
    console.error('Error fetching peptides:', error);
    res.status(500).json({ error: 'Failed to fetch peptides' });
  }
});

// Get single peptide
app.get('/api/peptides/:id', authenticateToken, (req, res) => {
  try {
    const peptide = db.prepare('SELECT * FROM peptides WHERE peptideId = ?').get(req.params.id);
    if (!peptide) {
      return res.status(404).json({ error: 'Peptide not found' });
    }
    res.json(peptide);
  } catch (error) {
    console.error('Error fetching peptide:', error);
    res.status(500).json({ error: 'Failed to fetch peptide' });
  }
});

// Create new peptide
app.post('/api/peptides', authenticateToken, (req, res) => {
  try {
    const peptide = req.body;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO peptides (
        peptideId, peptideName, quantity, labeledCount, batchNumber,
        shelfLocation, dateAdded, lastModified, notes, coa, sku,
        coaFile, msdsFile, sdsFile, hplcFile, tlcFile, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      peptide.peptideId,
      peptide.peptideName || '',
      peptide.quantity || 0,
      peptide.labeledCount || 0,
      peptide.batchNumber || '',
      peptide.shelfLocation || '',
      peptide.dateAdded || now,
      peptide.lastModified || now,
      peptide.notes || '',
      peptide.coa || '',
      peptide.sku || '',
      peptide.coaFile || '',
      peptide.msdsFile || '',
      peptide.sdsFile || '',
      peptide.hplcFile || '',
      peptide.tlcFile || '',
      now,
      now
    );

    res.status(201).json({ message: 'Peptide created successfully', peptideId: peptide.peptideId });
  } catch (error) {
    console.error('Error creating peptide:', error);
    if (error.code === 'SQLITE_CONSTRAINT') {
      res.status(409).json({ error: 'Peptide ID already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create peptide' });
    }
  }
});

// Update peptide
app.put('/api/peptides/:id', authenticateToken, (req, res) => {
  try {
    const peptide = req.body;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE peptides SET
        peptideName = ?,
        quantity = ?,
        labeledCount = ?,
        batchNumber = ?,
        shelfLocation = ?,
        dateAdded = ?,
        lastModified = ?,
        notes = ?,
        coa = ?,
        sku = ?,
        coaFile = ?,
        msdsFile = ?,
        sdsFile = ?,
        hplcFile = ?,
        tlcFile = ?,
        updatedAt = ?
      WHERE peptideId = ?
    `);

    const result = stmt.run(
      peptide.peptideName || '',
      peptide.quantity || 0,
      peptide.labeledCount || 0,
      peptide.batchNumber || '',
      peptide.shelfLocation || '',
      peptide.dateAdded || now,
      peptide.lastModified || now,
      peptide.notes || '',
      peptide.coa || '',
      peptide.sku || '',
      peptide.coaFile || '',
      peptide.msdsFile || '',
      peptide.sdsFile || '',
      peptide.hplcFile || '',
      peptide.tlcFile || '',
      now,
      req.params.id
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Peptide not found' });
    }

    res.json({ message: 'Peptide updated successfully' });
  } catch (error) {
    console.error('Error updating peptide:', error);
    res.status(500).json({ error: 'Failed to update peptide' });
  }
});

// Delete peptide
app.delete('/api/peptides/:id', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM peptides WHERE peptideId = ?');
    const result = stmt.run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Peptide not found' });
    }

    res.json({ message: 'Peptide deleted successfully' });
  } catch (error) {
    console.error('Error deleting peptide:', error);
    res.status(500).json({ error: 'Failed to delete peptide' });
  }
});

// Bulk import peptides
app.post('/api/peptides/bulk', authenticateToken, (req, res) => {
  try {
    const peptides = req.body.peptides;
    const now = new Date().toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO peptides (
        peptideId, peptideName, quantity, labeledCount, batchNumber,
        shelfLocation, dateAdded, lastModified, notes, coa, sku,
        coaFile, msdsFile, sdsFile, hplcFile, tlcFile, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(peptideId) DO UPDATE SET
        peptideName = excluded.peptideName,
        quantity = excluded.quantity,
        batchNumber = excluded.batchNumber,
        shelfLocation = excluded.shelfLocation,
        dateAdded = excluded.dateAdded,
        lastModified = excluded.lastModified,
        notes = excluded.notes,
        coa = excluded.coa,
        sku = excluded.sku,
        coaFile = excluded.coaFile,
        msdsFile = excluded.msdsFile,
        sdsFile = excluded.sdsFile,
        hplcFile = excluded.hplcFile,
        tlcFile = excluded.tlcFile,
        updatedAt = excluded.updatedAt
    `);

    const bulkInsert = db.transaction((peptides) => {
      for (const peptide of peptides) {
        insertStmt.run(
          peptide.peptideId,
          peptide.peptideName || '',
          peptide.quantity || 0,
          peptide.labeledCount || 0,
          peptide.batchNumber || '',
          peptide.shelfLocation || '',
          peptide.dateAdded || now,
          peptide.lastModified || now,
          peptide.notes || '',
          peptide.coa || '',
          peptide.sku || '',
          peptide.coaFile || '',
          peptide.msdsFile || '',
          peptide.sdsFile || '',
          peptide.hplcFile || '',
          peptide.tlcFile || '',
          now,
          now
        );
      }
    });

    bulkInsert(peptides);

    res.json({ message: `Successfully imported ${peptides.length} peptides` });
  } catch (error) {
    console.error('Error bulk importing peptides:', error);
    res.status(500).json({ error: 'Failed to bulk import peptides' });
  }
});

// ========== EXCLUSIONS ENDPOINTS ==========

// Get all exclusions
app.get('/api/exclusions', authenticateToken, (req, res) => {
  try {
    const exclusions = db.prepare('SELECT pattern FROM exclusions ORDER BY pattern').all();
    res.json(exclusions.map(e => e.pattern));
  } catch (error) {
    console.error('Error fetching exclusions:', error);
    res.status(500).json({ error: 'Failed to fetch exclusions' });
  }
});

// Add exclusion
app.post('/api/exclusions', authenticateToken, (req, res) => {
  try {
    const { pattern } = req.body;
    const stmt = db.prepare('INSERT INTO exclusions (pattern) VALUES (?)');
    stmt.run(pattern);
    res.status(201).json({ message: 'Exclusion added successfully' });
  } catch (error) {
    console.error('Error adding exclusion:', error);
    if (error.code === 'SQLITE_CONSTRAINT') {
      res.status(409).json({ error: 'Exclusion already exists' });
    } else {
      res.status(500).json({ error: 'Failed to add exclusion' });
    }
  }
});

// Delete exclusion
app.delete('/api/exclusions/:pattern', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM exclusions WHERE pattern = ?');
    const result = stmt.run(decodeURIComponent(req.params.pattern));

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Exclusion not found' });
    }

    res.json({ message: 'Exclusion deleted successfully' });
  } catch (error) {
    console.error('Error deleting exclusion:', error);
    res.status(500).json({ error: 'Failed to delete exclusion' });
  }
});

// Bulk set exclusions
app.post('/api/exclusions/bulk', authenticateToken, (req, res) => {
  try {
    const { patterns } = req.body;

    const transaction = db.transaction(() => {
      // Clear existing exclusions
      db.prepare('DELETE FROM exclusions').run();

      // Insert new exclusions
      const stmt = db.prepare('INSERT INTO exclusions (pattern) VALUES (?)');
      for (const pattern of patterns) {
        stmt.run(pattern);
      }
    });

    transaction();

    res.json({ message: 'Exclusions updated successfully' });
  } catch (error) {
    console.error('Error updating exclusions:', error);
    res.status(500).json({ error: 'Failed to update exclusions' });
  }
});

// ========== LABEL HISTORY ENDPOINTS ==========

// Get label history for a peptide
app.get('/api/label-history/:peptideId', authenticateToken, (req, res) => {
  try {
    const history = db.prepare(`
      SELECT * FROM label_history
      WHERE peptideId = ?
      ORDER BY timestamp DESC
    `).all(req.params.peptideId);
    res.json(history);
  } catch (error) {
    console.error('Error fetching label history:', error);
    res.status(500).json({ error: 'Failed to fetch label history' });
  }
});

// Add label history entry
app.post('/api/label-history', authenticateToken, (req, res) => {
  try {
    const { peptideId, quantity, action, notes } = req.body;
    const stmt = db.prepare(`
      INSERT INTO label_history (peptideId, quantity, action, notes)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(peptideId, quantity, action, notes || '');
    res.status(201).json({ message: 'Label history entry added successfully' });
  } catch (error) {
    console.error('Error adding label history:', error);
    res.status(500).json({ error: 'Failed to add label history entry' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Database location: ${dataDir}`);
  console.log(`Authentication: Enabled (default password: "admin")`);
  console.log(`⚠️  IMPORTANT: Change the default password after first login!`);
});

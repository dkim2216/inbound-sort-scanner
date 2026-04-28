import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from dist if it exists
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Initialize database
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS manifest (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        case_id VARCHAR(255) NOT NULL,
        sku VARCHAR(255) NOT NULL,
        qty INTEGER NOT NULL,
        sort_group VARCHAR(255),
        dealer VARCHAR(255),
        done BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_manifest_session ON manifest(session_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_manifest_case ON manifest(case_id)
    `);
    
    console.log('✓ Database initialized');
  } catch (err) {
    console.error('Database init error:', err);
  }
}

// API Routes

// Get all sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sessions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create session with CSV upload
app.post('/api/sessions', upload.single('file'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !req.file) {
      return res.status(400).json({ error: 'Name and CSV file required' });
    }

    // Parse CSV
    const csvText = req.file.buffer.toString('utf-8');
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true
    });

    // Validate and normalize records
    const validRecords = records.filter(r => r.case_id && r.sku && r.qty);
    if (validRecords.length === 0) {
      return res.status(400).json({ error: 'No valid rows in CSV' });
    }

    // Create session
    const sessionResult = await pool.query(
      'INSERT INTO sessions (name) VALUES ($1) RETURNING *',
      [name]
    );
    const sessionId = sessionResult.rows[0].id;

    // Insert manifest rows
    for (const record of validRecords) {
      await pool.query(
        `INSERT INTO manifest (session_id, case_id, sku, qty, sort_group, dealer)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          sessionId,
          String(record.case_id).trim(),
          String(record.sku).trim(),
          parseInt(record.qty) || 0,
          record.sort_group || '',
          record.dealer || ''
        ]
      );
    }

    res.json({ id: sessionId, name, rowsInserted: validRecords.length });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get session details
app.get('/api/sessions/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all cases in session
app.get('/api/sessions/:id/cases', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT case_id FROM manifest WHERE session_id = $1 ORDER BY case_id`,
      [req.params.id]
    );
    res.json(result.rows.map(r => r.case_id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get SKUs for a case
app.get('/api/sessions/:id/case/:caseId/skus', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT sku FROM manifest WHERE session_id = $1 AND case_id = $2 ORDER BY sku`,
      [req.params.id, req.params.caseId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    res.json(result.rows.map(r => r.sku));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get sort destinations for case + SKU
app.get('/api/sessions/:id/case/:caseId/sku/:sku', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, dealer, sort_group, qty, done FROM manifest 
       WHERE session_id = $1 AND case_id = $2 AND sku = $3 ORDER BY id`,
      [req.params.id, req.params.caseId, req.params.sku]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'SKU not found' });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark row as done
app.patch('/api/manifest/:id/done', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE manifest SET done = true WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Row not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get session progress
app.get('/api/sessions/:id/progress', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN done THEN 1 ELSE 0 END) as completed
       FROM manifest WHERE session_id = $1`,
      [req.params.id]
    );
    const { total, completed } = result.rows[0];
    res.json({
      total: parseInt(total),
      completed: parseInt(completed) || 0,
      percentage: total > 0 ? Math.round((parseInt(completed) / parseInt(total)) * 100) : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get case progress
app.get('/api/sessions/:id/case-progress', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        case_id,
        COUNT(*) as total,
        SUM(CASE WHEN done THEN 1 ELSE 0 END) as completed
       FROM manifest WHERE session_id = $1
       GROUP BY case_id
       ORDER BY case_id`,
      [req.params.id]
    );
    res.json(result.rows.map(row => ({
      case_id: row.case_id,
      total: parseInt(row.total),
      completed: parseInt(row.completed) || 0,
      percentage: parseInt(row.total) > 0 ? Math.round((parseInt(row.completed) / parseInt(row.total)) * 100) : 0
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send completion email
app.post('/api/sessions/:id/complete', async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    // Get session details
    const sessionResult = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
    if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const session = sessionResult.rows[0];
    
    // Get progress
    const progressResult = await pool.query(
      `SELECT COUNT(*) as total, SUM(CASE WHEN done THEN 1 ELSE 0 END) as completed
       FROM manifest WHERE session_id = $1`,
      [sessionId]
    );
    const { total, completed } = progressResult.rows[0];
    
    // Send email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'jongwonkim93@gmail.com',
      subject: `Sorting Complete: ${session.name}`,
      html: `
        <h2>Sorting Session Completed</h2>
        <p><strong>Session:</strong> ${session.name}</p>
        <p><strong>Total Items:</strong> ${total}</p>
        <p><strong>Items Sorted:</strong> ${completed}</p>
        <p><strong>Completion:</strong> ${Math.round((completed / total) * 100)}%</p>
        <p><strong>Date:</strong> ${new Date(session.created_at).toLocaleString()}</p>
      `
    };
    
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent' });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('App not built. Run: npm run build');
  }
});

// Start server
const PORT = process.env.PORT || 3000;
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

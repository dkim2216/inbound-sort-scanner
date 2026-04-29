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

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

    // Safe schema upgrades for existing DB
    await pool.query(`ALTER TABLE manifest ADD COLUMN IF NOT EXISTS item_description TEXT`);
    await pool.query(`ALTER TABLE manifest ADD COLUMN IF NOT EXISTS actual_qty INTEGER`);
    await pool.query(`ALTER TABLE manifest ADD COLUMN IF NOT EXISTS remark TEXT`);

    // Backfill existing rows
    await pool.query(`UPDATE manifest SET item_description = '' WHERE item_description IS NULL`);
    await pool.query(`UPDATE manifest SET actual_qty = qty WHERE actual_qty IS NULL`);
    await pool.query(`UPDATE manifest SET remark = '' WHERE remark IS NULL`);

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

    const csvText = req.file.buffer.toString('utf-8');
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true
    });

    const preparedRecords = records
      .map((record) => {
        const parsedQty = Number.parseInt(record.qty, 10);

        if (!record.case_id || !record.sku || Number.isNaN(parsedQty)) {
          return null;
        }

        return {
          case_id: String(record.case_id).trim(),
          sku: String(record.sku).trim(),
          item_description: String(
            record.item_description ?? record.description ?? ''
          ).trim(),
          qty: parsedQty,
          sort_group: String(record.sort_group ?? '').trim(),
          dealer: String(record.dealer ?? '').trim(),
          actual_qty: parsedQty,
          remark: ''
        };
      })
      .filter(Boolean);

    if (preparedRecords.length === 0) {
      return res.status(400).json({
        error: 'No valid rows in CSV. Required columns: case_id, sku, qty'
      });
    }

    const sessionResult = await pool.query(
      'INSERT INTO sessions (name) VALUES ($1) RETURNING *',
      [name]
    );
    const sessionId = sessionResult.rows[0].id;

    for (const record of preparedRecords) {
      await pool.query(
        `INSERT INTO manifest (
          session_id,
          case_id,
          sku,
          item_description,
          qty,
          sort_group,
          dealer,
          actual_qty,
          remark
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          sessionId,
          record.case_id,
          record.sku,
          record.item_description,
          record.qty,
          record.sort_group,
          record.dealer,
          record.actual_qty,
          record.remark
        ]
      );
    }

    res.json({ id: sessionId, name, rowsInserted: preparedRecords.length });
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

// Get SKU progress for a case
app.get('/api/sessions/:id/case/:caseId/skus', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        sku,
        COUNT(*) AS total,
        SUM(CASE WHEN done THEN 1 ELSE 0 END) AS completed
       FROM manifest
       WHERE session_id = $1 AND case_id = $2
       GROUP BY sku
       ORDER BY sku`,
      [req.params.id, req.params.caseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    res.json(
      result.rows.map((row) => {
        const total = toInt(row.total);
        const completed = toInt(row.completed);
        return {
          sku: row.sku,
          total,
          completed,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0
        };
      })
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get sort destinations for case + SKU
app.get('/api/sessions/:id/case/:caseId/sku/:sku', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        id,
        dealer,
        sort_group,
        qty,
        COALESCE(item_description, '') AS item_description,
        COALESCE(actual_qty, qty) AS actual_qty,
        COALESCE(actual_qty, qty) - qty AS discrepancy_qty,
        COALESCE(remark, '') AS remark,
        done
       FROM manifest
       WHERE session_id = $1 AND case_id = $2 AND sku = $3
       ORDER BY id`,
      [req.params.id, req.params.caseId, req.params.sku]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'SKU not found' });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save actual qty / remark and mark done
app.patch('/api/manifest/:id/done', async (req, res) => {
  try {
    const { actual_qty, remark, done } = req.body || {};

    let parsedActualQty = null;
    if (actual_qty !== undefined && actual_qty !== null && actual_qty !== '') {
      parsedActualQty = Number.parseInt(actual_qty, 10);
      if (Number.isNaN(parsedActualQty) || parsedActualQty < 0) {
        return res.status(400).json({ error: 'actual_qty must be a valid non-negative integer' });
      }
    }

    const result = await pool.query(
      `UPDATE manifest
       SET
         done = COALESCE($2, done),
         actual_qty = COALESCE($3, actual_qty, qty),
         remark = COALESCE($4, remark, '')
       WHERE id = $1
       RETURNING
         id,
         dealer,
         sort_group,
         qty,
         COALESCE(item_description, '') AS item_description,
         COALESCE(actual_qty, qty) AS actual_qty,
         COALESCE(actual_qty, qty) - qty AS discrepancy_qty,
         COALESCE(remark, '') AS remark,
         done`,
      [
        req.params.id,
        done === undefined ? null : Boolean(done),
        parsedActualQty,
        remark === undefined ? null : String(remark).trim()
      ]
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
      total: toInt(total),
      completed: toInt(completed),
      percentage: toInt(total) > 0 ? Math.round((toInt(completed) / toInt(total)) * 100) : 0
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
      total: toInt(row.total),
      completed: toInt(row.completed),
      percentage: toInt(row.total) > 0
        ? Math.round((toInt(row.completed) / toInt(row.total)) * 100)
        : 0
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send completion email
app.post('/api/sessions/:id/complete', async (req, res) => {
  try {
    const sessionId = req.params.id;

    const sessionResult = await pool.query(
      'SELECT * FROM sessions WHERE id = $1',
      [sessionId]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionResult.rows[0];

    const manifestResult = await pool.query(
      `SELECT
        case_id,
        sku,
        COALESCE(item_description, '') AS item_description,
        dealer,
        sort_group,
        qty,
        COALESCE(actual_qty, qty) AS actual_qty,
        COALESCE(actual_qty, qty) - qty AS discrepancy_qty,
        COALESCE(remark, '') AS remark,
        done
       FROM manifest
       WHERE session_id = $1
       ORDER BY case_id, sku, id`,
      [sessionId]
    );
    const items = manifestResult.rows;

    const progressResult = await pool.query(
      `SELECT COUNT(*) as total, SUM(CASE WHEN done THEN 1 ELSE 0 END) as completed
       FROM manifest WHERE session_id = $1`,
      [sessionId]
    );
    const total = toInt(progressResult.rows[0].total);
    const completed = toInt(progressResult.rows[0].completed);
    const discrepancyCount = items.filter(item => toInt(item.discrepancy_qty) !== 0).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    let tableHTML = `
      <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
        <tr style="background: #333; color: white;">
          <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Case</th>
          <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">SKU</th>
          <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Description</th>
          <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Dealer</th>
          <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Group</th>
          <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Original Qty</th>
          <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Actual Qty</th>
          <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Discrepancy Qty</th>
          <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Remark</th>
          <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Status</th>
        </tr>
    `;

    items.forEach((item) => {
      const discrepancy = toInt(item.discrepancy_qty);
      const status = item.done
        ? discrepancy !== 0
          ? '✓ Completed with discrepancy'
          : '✓ Completed'
        : '✗ Incomplete';

      const bgColor = !item.done
        ? '#f8d7da'
        : discrepancy !== 0
          ? '#fff3cd'
          : '#d4edda';

      tableHTML += `
        <tr style="background: ${bgColor};">
          <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(item.case_id)}</td>
          <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(item.sku)}</td>
          <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(item.item_description)}</td>
          <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(item.dealer)}</td>
          <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(item.sort_group)}</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${toInt(item.qty)}</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${toInt(item.actual_qty)}</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: bold; color: ${discrepancy === 0 ? '#374151' : discrepancy > 0 ? '#1d4ed8' : '#dc2626'};">
            ${discrepancy > 0 ? `+${discrepancy}` : discrepancy}
          </td>
          <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(item.remark)}</td>
          <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">${status}</td>
        </tr>
      `;
    });

    tableHTML += '</table>';

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
      subject: `Sorting Session Report: ${session.name}`,
      html: `
        <h2>Warehouse Sorting Session Report</h2>
        <p><strong>Session:</strong> ${escapeHtml(session.name)}</p>
        <p><strong>Date:</strong> ${new Date(session.created_at).toLocaleString()}</p>

        <h3 style="margin-top: 20px;">Summary</h3>
        <p><strong>Total Items:</strong> ${total}</p>
        <p><strong>Completed:</strong> <span style="color: green; font-weight: bold;">${completed} ✓</span></p>
        <p><strong>Incomplete:</strong> <span style="color: red; font-weight: bold;">${total - completed} ✗</span></p>
        <p><strong>Rows with discrepancy:</strong> <span style="color: #d97706; font-weight: bold;">${discrepancyCount}</span></p>
        <p><strong>Completion Rate:</strong> <span style="font-size: 20px; font-weight: bold; color: ${completionRate === 100 ? 'green' : 'orange'};">${completionRate}%</span></p>

        <h3 style="margin-top: 20px;">Detailed Items</h3>
        ${tableHTML}
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent' });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get dealer summary
app.get('/api/sessions/:id/dealer-summary', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT dealer, sort_group, case_id, sku, qty FROM manifest
       WHERE session_id = $1 ORDER BY dealer, sort_group, case_id, sku`,
      [req.params.id]
    );

    const dealerMap = {};
    result.rows.forEach(row => {
      if (!dealerMap[row.dealer]) {
        dealerMap[row.dealer] = {
          name: row.dealer,
          groups: new Set(),
          cases: [],
          totalQty: 0
        };
      }
      dealerMap[row.dealer].groups.add(row.sort_group);
      dealerMap[row.dealer].cases.push({
        case_id: row.case_id,
        sku: row.sku,
        sort_group: row.sort_group,
        qty: row.qty
      });
      dealerMap[row.dealer].totalQty += row.qty;
    });

    const dealers = Object.values(dealerMap).map(d => ({
      ...d,
      groups: Array.from(d.groups)
    }));

    res.json(dealers);
  } catch (err) {
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

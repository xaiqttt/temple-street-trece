const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const dbPath = path.join(__dirname, 'sal_funds.db');
const db = new sqlite3.Database(dbPath);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ==================== MEMBER ROUTES ====================

// Get all members grouped by rank
app.get('/api/members', (req, res) => {
  db.all('SELECT * FROM members WHERE active = 1 ORDER BY rank, name', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const grouped = {
      ALAS: [],
      POINTMAN: [],
      JUNIOR: [],
      MINORS: []
    };
    
    rows.forEach(member => {
      if (grouped[member.rank]) {
        grouped[member.rank].push(member);
      }
    });
    
    res.json(grouped);
  });
});

// Get single member
app.get('/api/members/:id', (req, res) => {
  db.get('SELECT * FROM members WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(row);
  });
});

// Add new member
app.post('/api/members', (req, res) => {
  const { name, rank } = req.body;
  
  if (!name || !rank) {
    return res.status(400).json({ error: 'Name and rank are required' });
  }
  
  db.run(
    'INSERT INTO members (name, rank) VALUES (?, ?)',
    [name.toUpperCase(), rank],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, name, rank, message: 'Member added successfully' });
    }
  );
});

// Update member
app.put('/api/members/:id', (req, res) => {
  const { name, rank, active } = req.body;
  const updates = [];
  const values = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name.toUpperCase());
  }
  if (rank !== undefined) {
    updates.push('rank = ?');
    values.push(rank);
  }
  if (active !== undefined) {
    updates.push('active = ?');
    values.push(active ? 1 : 0);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }
  
  values.push(req.params.id);
  
  db.run(
    `UPDATE members SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Member updated successfully', changes: this.changes });
    }
  );
});

// Delete (deactivate) member
app.delete('/api/members/:id', (req, res) => {
  db.run(
    'UPDATE members SET active = 0 WHERE id = ?',
    [req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Member deactivated successfully', changes: this.changes });
    }
  );
});

// ==================== PAYMENT ROUTES ====================

// Get payments for a specific month
app.get('/api/payments/:year/:month', (req, res) => {
  const { year, month } = req.params;
  
  const query = `
    SELECT 
      p.*,
      m.name,
      m.rank
    FROM members m
    LEFT JOIN payments p ON m.id = p.member_id 
      AND p.year = ? 
      AND p.month = ?
    WHERE m.active = 1
    ORDER BY m.rank, m.name
  `;
  
  db.all(query, [year, month], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get payment summary for a month
app.get('/api/payments/:year/:month/summary', (req, res) => {
  const { year, month } = req.params;
  
  const query = `
    SELECT 
      SUM(CASE WHEN northside_paid = 1 THEN northside_amount ELSE 0 END) as northside_total,
      SUM(CASE WHEN la_paid = 1 THEN la_amount ELSE 0 END) as la_total,
      COUNT(CASE WHEN northside_paid = 1 THEN 1 END) as northside_paid_count,
      COUNT(CASE WHEN la_paid = 1 THEN 1 END) as la_paid_count,
      COUNT(*) as total_members
    FROM payments
    WHERE year = ? AND month = ?
  `;
  
  db.get(query, [year, month], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row || { northside_total: 0, la_total: 0, northside_paid_count: 0, la_paid_count: 0, total_members: 0 });
  });
});

// Initialize payments for a month
app.post('/api/payments/initialize', (req, res) => {
  const { year, month } = req.body;
  
  if (!year || !month) {
    return res.status(400).json({ error: 'Year and month are required' });
  }
  
  // Get all active members with their rank settings
  const query = `
    SELECT m.id, m.rank, fs.northside_default, fs.la_default
    FROM members m
    LEFT JOIN fund_settings fs ON m.rank = fs.rank
    WHERE m.active = 1
  `;
  
  db.all(query, (err, members) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO payments 
      (member_id, year, month, northside_amount, la_amount)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    members.forEach(member => {
      stmt.run(
        member.id,
        year,
        month,
        member.northside_default || 0,
        member.la_default || 0
      );
    });
    
    stmt.finalize((err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Payments initialized for the month', count: members.length });
    });
  });
});

// Update payment status
app.put('/api/payments/:id', (req, res) => {
  const { northside_paid, la_paid, northside_amount, la_amount } = req.body;
  const updates = [];
  const values = [];
  
  if (northside_paid !== undefined) {
    updates.push('northside_paid = ?');
    values.push(northside_paid ? 1 : 0);
    if (northside_paid) {
      updates.push('northside_paid_date = CURRENT_TIMESTAMP');
    }
  }
  
  if (la_paid !== undefined) {
    updates.push('la_paid = ?');
    values.push(la_paid ? 1 : 0);
    if (la_paid) {
      updates.push('la_paid_date = CURRENT_TIMESTAMP');
    }
  }
  
  if (northside_amount !== undefined) {
    updates.push('northside_amount = ?');
    values.push(northside_amount);
  }
  
  if (la_amount !== undefined) {
    updates.push('la_amount = ?');
    values.push(la_amount);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }
  
  values.push(req.params.id);
  
  db.run(
    `UPDATE payments SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Payment updated successfully', changes: this.changes });
    }
  );
});

// Create or update payment for specific member/month
app.post('/api/payments', (req, res) => {
  const { member_id, year, month, northside_amount, la_amount, northside_paid, la_paid } = req.body;
  
  const query = `
    INSERT INTO payments (member_id, year, month, northside_amount, la_amount, northside_paid, la_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(member_id, year, month) 
    DO UPDATE SET 
      northside_amount = excluded.northside_amount,
      la_amount = excluded.la_amount,
      northside_paid = excluded.northside_paid,
      la_paid = excluded.la_paid
  `;
  
  db.run(
    query,
    [member_id, year, month, northside_amount || 0, la_amount || 0, northside_paid ? 1 : 0, la_paid ? 1 : 0],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, message: 'Payment saved successfully' });
    }
  );
});

// ==================== FUND SETTINGS ROUTES ====================

// Get fund settings
app.get('/api/settings', (req, res) => {
  db.all('SELECT * FROM fund_settings ORDER BY rank', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Update fund settings
app.put('/api/settings/:rank', (req, res) => {
  const { northside_default, la_default } = req.body;
  
  db.run(
    'UPDATE fund_settings SET northside_default = ?, la_default = ? WHERE rank = ?',
    [northside_default, la_default, req.params.rank],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Settings updated successfully', changes: this.changes });
    }
  );
});

// ==================== STATS ROUTES ====================

// Get overall statistics
app.get('/api/stats', (req, res) => {
  const stats = {};
  
  // Get member count by rank
  db.all(
    'SELECT rank, COUNT(*) as count FROM members WHERE active = 1 GROUP BY rank',
    (err, rankCounts) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      stats.membersByRank = rankCounts;
      
      // Get total collected this year
      const currentYear = new Date().getFullYear();
      db.get(
        `SELECT 
          SUM(CASE WHEN northside_paid = 1 THEN northside_amount ELSE 0 END) as northside_year_total,
          SUM(CASE WHEN la_paid = 1 THEN la_amount ELSE 0 END) as la_year_total
        FROM payments
        WHERE year = ?`,
        [currentYear],
        (err, totals) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          stats.yearTotals = totals;
          res.json(stats);
        }
      );
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SAL Fund Manager Backend running on port ${PORT}`);
  console.log(`📊 API endpoint: http://localhost:${PORT}/api`);
});
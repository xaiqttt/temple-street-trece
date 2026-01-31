const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'sal_funds.db');
const db = new sqlite3.Database(dbPath);

const initialMembers = [
  // ALAS
  { name: '######', rank: 'ALAS' },
  
  // POINTMAN
  { name: 'DARWIN', rank: 'POINTMAN' },
  { name: 'CALOY', rank: 'POINTMAN' },
  { name: 'BOK', rank: 'POINTMAN' },
  
  // JUNIOR
  { name: 'BEMBEM', rank: 'JUNIOR' },
  { name: 'CHRISTIAN', rank: 'JUNIOR' },
  { name: 'CM', rank: 'JUNIOR' },
  { name: 'DENDEN', rank: 'JUNIOR' },
  { name: 'BITOY', rank: 'JUNIOR' },
  { name: 'JESSIERYLL', rank: 'JUNIOR' },
  { name: 'TOPER', rank: 'JUNIOR' },
  { name: 'LEEVAN', rank: 'JUNIOR' },
  { name: 'CALYX', rank: 'JUNIOR' },
  { name: 'SAM', rank: 'JUNIOR' },
  { name: 'ASUL', rank: 'JUNIOR' },
  { name: 'RAMIL', rank: 'JUNIOR' },
  { name: 'TINTIN', rank: 'JUNIOR' },
  { name: 'KYLE', rank: 'JUNIOR' },
  { name: 'ALLEN', rank: 'JUNIOR' },
  { name: 'BIBO', rank: 'JUNIOR' },
  { name: 'OTNIS', rank: 'JUNIOR' },
  { name: 'CHAD', rank: 'JUNIOR' },
  { name: 'CLYDE', rank: 'JUNIOR' },
  { name: 'CRISLAN', rank: 'JUNIOR' },
  { name: 'DAVID', rank: 'JUNIOR' },
  { name: 'EDRIN', rank: 'JUNIOR' },
  { name: 'EL UNO', rank: 'JUNIOR' },
  { name: 'ERIC', rank: 'JUNIOR' },
  { name: 'ERWIN', rank: 'JUNIOR' },
  { name: 'JEROME', rank: 'JUNIOR' },
  { name: 'JHONROO', rank: 'JUNIOR' },
  { name: 'JUSTINE', rank: 'JUNIOR' },
  { name: 'KHENG', rank: 'JUNIOR' },
  { name: 'KHING', rank: 'JUNIOR' },
  { name: 'KURT', rank: 'JUNIOR' },
  { name: 'MARK', rank: 'JUNIOR' },
  { name: 'NHATZ', rank: 'JUNIOR' },
  { name: 'ROBERT', rank: 'JUNIOR' },
  { name: 'SHANE', rank: 'JUNIOR' },
  { name: 'GAB', rank: 'JUNIOR' },
  
  // MINORS
  { name: 'AMA', rank: 'MINORS' },
  { name: 'JURE', rank: 'MINORS' },
  { name: 'AGUIRRE', rank: 'MINORS' },
  { name: 'CALBARIO', rank: 'MINORS' },
  { name: 'DEAN', rank: 'MINORS' },
  { name: 'DEXTER', rank: 'MINORS' },
  { name: 'DREW', rank: 'MINORS' },
  { name: 'GAMBINO', rank: 'MINORS' },
  { name: 'RICHA', rank: 'MINORS' },
  { name: 'JACK', rank: 'MINORS' },
  { name: 'JACOB', rank: 'MINORS' },
  { name: 'JAZ', rank: 'MINORS' },
  { name: 'REX', rank: 'MINORS' },
  { name: 'JHON REY', rank: 'MINORS' },
  { name: 'LANCE', rank: 'MINORS' },
  { name: 'LIMUEL', rank: 'MINORS' },
  { name: 'MARK', rank: 'MINORS' },
  { name: 'NISHAN', rank: 'MINORS' },
  { name: 'PETER', rank: 'MINORS' },
  { name: 'SEANLEE', rank: 'MINORS' },
  { name: 'ANGELO', rank: 'MINORS' },
  { name: 'TEDYBLAKE', rank: 'MINORS' },
  { name: 'REB', rank: 'MINORS' },
  { name: 'ICEY', rank: 'MINORS' }
];

db.serialize(() => {
  // Drop existing tables
  db.run('DROP TABLE IF EXISTS payments');
  db.run('DROP TABLE IF EXISTS members');
  db.run('DROP TABLE IF EXISTS fund_settings');

  // Create members table
  db.run(`
    CREATE TABLE members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rank TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create payments table
  db.run(`
    CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      northside_amount REAL DEFAULT 0,
      la_amount REAL DEFAULT 0,
      northside_paid INTEGER DEFAULT 0,
      la_paid INTEGER DEFAULT 0,
      northside_paid_date DATETIME,
      la_paid_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id),
      UNIQUE(member_id, year, month)
    )
  `);

  // Create fund settings table
  db.run(`
    CREATE TABLE fund_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rank TEXT NOT NULL UNIQUE,
      northside_default REAL DEFAULT 0,
      la_default REAL DEFAULT 0
    )
  `);

  // Insert initial members
  const insertMember = db.prepare('INSERT INTO members (name, rank) VALUES (?, ?)');
  initialMembers.forEach(member => {
    insertMember.run(member.name, member.rank);
  });
  insertMember.finalize();

  // Insert default fund settings
  const insertSetting = db.prepare('INSERT INTO fund_settings (rank, northside_default, la_default) VALUES (?, ?, ?)');
  insertSetting.run('ALAS', 75, 75);
  insertSetting.run('POINTMAN', 75, 75);
  insertSetting.run('JUNIOR', 75, 75);
  insertSetting.run('MINORS', 75, 75);
  insertSetting.finalize();

  console.log('✅ Database initialized successfully!');
  console.log(`📁 Database location: ${dbPath}`);
  console.log(`👥 Total members inserted: ${initialMembers.length}`);
  
  db.close();
});
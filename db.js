const mysql = require('mysql2');

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'donation_manager',
  port: Number(process.env.DB_PORT || 3306),
});

db.connect((err) => {
  if (err) {
    console.log('DB ERROR:', err);
  } else {
    console.log('CONNECTED TO DB:', process.env.DB_NAME || 'donation_manager');
  }
});

module.exports = db;
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = 'donation_manager_secret_key';

console.log('AUTH ROUTES FILE LOADED');

/* ---------------- TEST ---------------- */

router.get('/test-signup', (req, res) => {
  res.json({
    success: true,
    message: 'Auth signup route is working',
  });
});

/* ---------------- LOGIN ---------------- */

router.post('/login', (req, res) => {
  console.log('LOGIN HIT:', req.body);

  const identifier = String(req.body.identifier || '').trim();
  const password = String(req.body.password || '').trim();

  console.log("IDENTIFIER RECEIVED:", identifier);
  console.log("PASSWORD RECEIVED:", password);

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'NEW LOGIN ROUTE ACTIVE',
    });
  }

  const sql = `
    SELECT id, name, email, phone, password, role, member_id
    FROM users
    WHERE TRIM(email) = ? OR TRIM(phone) = ?
    LIMIT 1
  `;

  db.query(sql, [identifier, identifier], async (err, results) => {
    if (err) {
      console.log('DB ERROR:', err);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        error: err.message,
      });
    }

    if (results.length === 0) {
      console.log('USER NOT FOUND FOR IDENTIFIER:', identifier);
      return res.status(401).json({
        success: false,
        message: 'Invalid email/phone or password',
      });
    }

    const user = results[0];
    const dbPassword = String(user.password || '').trim();

    console.log('DB USER:', {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      member_id: user.member_id,
    });

    try {
      let isMatch = false;

      if (
        dbPassword.startsWith('$2a$') ||
        dbPassword.startsWith('$2b$') ||
        dbPassword.startsWith('$2y$')
      ) {
        isMatch = await bcrypt.compare(password, dbPassword);
      } else {
        isMatch = password === dbPassword;
      }

      console.log('PASSWORD MATCH:', isMatch);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email/phone or password',
        });
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: String(user.email || '').trim(),
          phone: String(user.phone || '').trim(),
          role: user.role,
          member_id: user.member_id || null,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: String(user.email || '').trim(),
          phone: String(user.phone || '').trim(),
          role: user.role,
          member_id: user.member_id || null,
        },
      });
    } catch (e) {
      console.log('LOGIN ERROR:', e);
      return res.status(500).json({
        success: false,
        message: 'Login error',
        error: e.toString(),
      });
    }
  });
});

module.exports = router;
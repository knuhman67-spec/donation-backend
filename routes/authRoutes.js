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

  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '').trim();

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
    });
  }

  const sql = `
    SELECT id, name, email, password, role, member_id
    FROM users
    WHERE TRIM(email) = ?
    LIMIT 1
  `;

  db.query(sql, [email], async (err, results) => {
    if (err) {
      console.log('DB ERROR:', err);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        error: err.message,
      });
    }

    if (results.length === 0) {
      console.log('USER NOT FOUND FOR EMAIL:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const user = results[0];
    const dbPassword = String(user.password || '').trim();

    console.log('DB USER:', {
      id: user.id,
      email: user.email,
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
          message: 'Invalid email or password',
        });
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: String(user.email || '').trim(),
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

/* ---------------- SIGNUP ---------------- */

router.post('/signup', async (req, res) => {
  console.log('SIGNUP ROUTE HIT');

  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '').trim();

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required',
      });
    }

    const checkSql = 'SELECT id FROM users WHERE TRIM(email) = ?';

    db.query(checkSql, [email], async (checkErr, checkResult) => {
      if (checkErr) {
        console.log('SIGNUP CHECK ERROR:', checkErr);
        return res.status(500).json({
          success: false,
          message: 'Database error',
          error: checkErr.message,
        });
      }

      if (checkResult.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered',
        });
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const insertSql = `
          INSERT INTO users (name, email, password, role, member_id)
          VALUES (?, ?, ?, ?, ?)
        `;

        db.query(
          insertSql,
          [name, email, hashedPassword, 'member', null],
          (insertErr, result) => {
            if (insertErr) {
              console.log('SIGNUP INSERT ERROR:', insertErr);
              return res.status(500).json({
                success: false,
                message: 'Failed to register user',
                error: insertErr.message,
              });
            }

            return res.json({
              success: true,
              message: 'User registered successfully',
              userId: result.insertId,
            });
          }
        );
      } catch (hashErr) {
        console.log('BCRYPT HASH ERROR:', hashErr);
        return res.status(500).json({
          success: false,
          message: 'Password hashing failed',
          error: hashErr.toString(),
        });
      }
    });
  } catch (e) {
    console.log('SIGNUP SERVER ERROR:', e);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: e.toString(),
    });
  }
});

module.exports = router;
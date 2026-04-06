const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();

/* GET ALL MEMBERS */
/* Optional: /members?organization_id=1 */
router.get('/', (req, res) => {
  const organizationId = req.query.organization_id;

  let sql = `
    SELECT 
      m.*,
      o.name AS organization_name,
      o.type AS organization_type
    FROM members m
    JOIN organizations o ON o.id = m.organization_id
  `;

  const values = [];

  if (organizationId) {
    sql += ` WHERE m.organization_id = ?`;
    values.push(organizationId);
  }

  sql += ` ORDER BY m.full_name ASC`;

  db.query(sql, values, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    res.json({
      success: true,
      data: results,
    });
  });
});

/* GET SINGLE MEMBER WITH PAYMENT HISTORY */
router.get('/:id', (req, res) => {
  const memberId = req.params.id;

  const memberSql = `
  SELECT 
    m.*,
    o.name AS organization_name,
    o.type AS organization_type,
    o.upi_id,
    o.qr_image,
    o.payment_note
  FROM members m
  JOIN organizations o ON o.id = m.organization_id
  WHERE m.id = ?
`;

  const paymentSql = `
    SELECT *
    FROM payments
    WHERE member_id = ?
    ORDER BY payment_year DESC, payment_month DESC, id DESC
  `;

  db.query(memberSql, [memberId], (err, memberResults) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    if (memberResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
      });
    }

    db.query(paymentSql, [memberId], (err2, paymentResults) => {
      if (err2) {
        return res.status(500).json({
          success: false,
          message: err2.message,
        });
      }

      res.json({
        success: true,
        member: memberResults[0],
        payments: paymentResults,
      });
    });
  });
});

/* ADD NEW MEMBER */
router.post('/', async (req, res) => {
  try {
    const {
      organization_id,
      full_name,
      house_name,
      house_number,
      phone,
      whatsapp,
      email,
      address,
      category_type,
      monthly_due,
      live_status,
      member_status,
      notes,
      profile_image,
      create_login,
      login_email,
      login_password,
    } = req.body;

    console.log('ADD MEMBER BODY:', req.body);

    const insertMemberSql = `
      INSERT INTO members (
        organization_id,
        full_name,
        house_name,
        house_number,
        phone,
        whatsapp,
        email,
        address,
        category_type,
        monthly_due,
        live_status,
        member_status,
        notes,
        profile_image
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      insertMemberSql,
      [
        organization_id,
        full_name,
        house_name || null,
        house_number || null,
        phone || null,
        whatsapp || null,
        email || null,
        address || null,
        category_type || 'masjid',
        monthly_due || 0,
        live_status || 'alive',
        member_status || 'active',
        notes || null,
        profile_image || null,
      ],
      async (err, result) => {
        if (err) {
          console.log('MEMBER INSERT ERROR:', err);
          return res.status(500).json({
            success: false,
            message: err.message,
          });
        }

        const memberId = result.insertId;
        console.log('MEMBER CREATED:', memberId);

        const shouldCreateLogin =
          create_login === true || create_login === 'true';

        console.log('create_login:', create_login, typeof create_login);
        console.log('shouldCreateLogin:', shouldCreateLogin);

        if (shouldCreateLogin && login_email && login_password) {
          const checkUserSql = 'SELECT id FROM users WHERE email = ? LIMIT 1';

          db.query(checkUserSql, [login_email], async (checkErr, checkResults) => {
            if (checkErr) {
              console.log('USER CHECK ERROR:', checkErr);
              return res.status(500).json({
                success: false,
                message: 'Failed to check login email',
                error: checkErr.message,
              });
            }

            if (checkResults.length > 0) {
              return res.status(400).json({
                success: false,
                message: 'Login email already exists',
              });
            }

            try {
              const hashedPassword = await bcrypt.hash(login_password, 10);

              const insertUserSql = `
                INSERT INTO users (name, email, password, role, member_id)
                VALUES (?, ?, ?, ?, ?)
              `;

              db.query(
                insertUserSql,
                [full_name, login_email, hashedPassword, 'member', memberId],
                (userErr, userResult) => {
                  if (userErr) {
                    console.log('USER INSERT ERROR:', userErr);
                    return res.status(500).json({
                      success: false,
                      message: 'Member saved, but login creation failed',
                      error: userErr.message,
                    });
                  }

                  console.log('USER CREATED:', userResult.insertId);

                  return res.json({
                    success: true,
                    message: 'Member and login account created successfully',
                    member_id: memberId,
                  });
                }
              );
            } catch (hashErr) {
              console.log('HASH ERROR:', hashErr);
              return res.status(500).json({
                success: false,
                message: 'Password hashing failed',
                error: hashErr.toString(),
              });
            }
          });

          return;
        }

        return res.json({
          success: true,
          message: 'Member added successfully',
          member_id: memberId,
        });
      }
    );
  } catch (e) {
    console.log('ADD MEMBER SERVER ERROR:', e);
    return res.status(500).json({
      success: false,
      message: e.toString(),
    });
  }
});

/* UPDATE MEMBER */
router.put('/:id', (req, res) => {
  const memberId = req.params.id;

  const {
    organization_id,
    full_name,
    house_name,
    house_number,
    phone,
    whatsapp,
    email,
    address,
    category_type,
    monthly_due,
    live_status,
    member_status,
    notes,
    profile_image,
  } = req.body;

  if (!organization_id || !full_name) {
    return res.status(400).json({
      success: false,
      message: 'organization_id and full_name are required',
    });
  }

  const sql = `
    UPDATE members
    SET
      organization_id = ?,
      full_name = ?,
      house_name = ?,
      house_number = ?,
      phone = ?,
      whatsapp = ?,
      email = ?,
      address = ?,
      category_type = ?,
      monthly_due = ?,
      live_status = ?,
      member_status = ?,
      notes = ?,
      profile_image = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [
      organization_id,
      full_name,
      house_name || null,
      house_number || null,
      phone || null,
      whatsapp || null,
      email || null,
      address || null,
      category_type || 'masjid',
      monthly_due || null,
      live_status || 'alive',
      member_status || 'active',
      notes || null,
      profile_image || null,
      memberId,
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Member not found',
        });
      }

      res.json({
        success: true,
        message: 'Member updated successfully',
      });
    }
  );
});

/* DELETE MEMBER */
router.delete('/:id', (req, res) => {
  const memberId = req.params.id;

  const checkSql =
    'SELECT COUNT(*) AS payment_count FROM payments WHERE member_id = ?';

  db.query(checkSql, [memberId], (checkErr, checkResults) => {
    if (checkErr) {
      return res.status(500).json({
        success: false,
        message: checkErr.message,
      });
    }

    const paymentCount = Number(checkResults[0].payment_count || 0);

    if (paymentCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete member because payment records exist',
      });
    }

    db.query('DELETE FROM members WHERE id = ?', [memberId], (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Member not found',
        });
      }

      res.json({
        success: true,
        message: 'Member deleted successfully',
      });
    });
  });
});

module.exports = router;
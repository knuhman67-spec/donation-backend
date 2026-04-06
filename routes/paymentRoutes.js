const express = require('express');
const db = require('../db');

const router = express.Router();

/* =========================================================
   GET PAYMENTS
   Optional:
   /payments?member_id=1
   /payments?organization_id=1
========================================================= */
router.get('/', (req, res) => {
  const memberId = req.query.member_id;
  const organizationId = req.query.organization_id;

  let sql = `
    SELECT 
      p.*,
      m.full_name,
      m.house_name,
      o.name AS organization_name
    FROM payments p
    JOIN members m ON m.id = p.member_id
    JOIN organizations o ON o.id = p.organization_id
    WHERE 1 = 1
  `;

  const values = [];

  if (memberId) {
    sql += ` AND p.member_id = ?`;
    values.push(memberId);
  }

  if (organizationId) {
    sql += ` AND p.organization_id = ?`;
    values.push(organizationId);
  }

  sql += ` ORDER BY p.payment_year DESC, p.payment_month DESC, p.id DESC`;

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

/* =========================================================
   ADD PAYMENT
   Admin / Collector only should use this route from app flow
========================================================= */
router.post('/', (req, res) => {
  const {
    member_id,
    organization_id,
    payment_month,
    payment_year,
    amount_paid,
    payment_method,
    collector_name,
    note,
  } = req.body;

  if (!member_id || !organization_id || !payment_month || !payment_year || !amount_paid) {
    return res.status(400).json({
      success: false,
      message:
        'member_id, organization_id, payment_month, payment_year and amount_paid are required',
    });
  }

  const amount = Number(amount_paid);
  const month = Number(payment_month);
  const year = Number(payment_year);

  if (amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Amount must be greater than 0',
    });
  }

  if (month < 1 || month > 12) {
    return res.status(400).json({
      success: false,
      message: 'Payment month must be between 1 and 12',
    });
  }

  const checkMemberSql = `
    SELECT id, organization_id
    FROM members
    WHERE id = ?
    LIMIT 1
  `;

  db.query(checkMemberSql, [member_id], (memberErr, memberResults) => {
    if (memberErr) {
      return res.status(500).json({
        success: false,
        message: memberErr.message,
      });
    }

    if (memberResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
      });
    }

    const member = memberResults[0];

    if (Number(member.organization_id) !== Number(organization_id)) {
      return res.status(400).json({
        success: false,
        message: 'Member does not belong to this organization',
      });
    }

    const checkOrgSql = `
      SELECT id
      FROM organizations
      WHERE id = ?
      LIMIT 1
    `;

    db.query(checkOrgSql, [organization_id], (orgErr, orgResults) => {
      if (orgErr) {
        return res.status(500).json({
          success: false,
          message: orgErr.message,
        });
      }

      if (orgResults.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found',
        });
      }

      const sql = `
        INSERT INTO payments (
          member_id,
          organization_id,
          payment_month,
          payment_year,
          amount_paid,
          payment_method,
          collector_name,
          note
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(
        sql,
        [
          member_id,
          organization_id,
          month,
          year,
          amount,
          payment_method || null,
          collector_name || null,
          note || null,
        ],
        (err, result) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: err.message,
            });
          }

          res.json({
            success: true,
            message: 'Payment added successfully',
            payment_id: result.insertId,
          });
        }
      );
    });
  });
});

/* =========================================================
   UPDATE PAYMENT
========================================================= */
router.put('/:id', (req, res) => {
  const paymentId = req.params.id;

  const {
    member_id,
    organization_id,
    payment_month,
    payment_year,
    amount_paid,
    payment_method,
    collector_name,
    note,
  } = req.body;

  if (!member_id || !organization_id || !payment_month || !payment_year || !amount_paid) {
    return res.status(400).json({
      success: false,
      message:
        'member_id, organization_id, payment_month, payment_year and amount_paid are required',
    });
  }

  const amount = Number(amount_paid);
  const month = Number(payment_month);
  const year = Number(payment_year);

  if (amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Amount must be greater than 0',
    });
  }

  if (month < 1 || month > 12) {
    return res.status(400).json({
      success: false,
      message: 'Payment month must be between 1 and 12',
    });
  }

  const sql = `
    UPDATE payments
    SET
      member_id = ?,
      organization_id = ?,
      payment_month = ?,
      payment_year = ?,
      amount_paid = ?,
      payment_method = ?,
      collector_name = ?,
      note = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [
      member_id,
      organization_id,
      month,
      year,
      amount,
      payment_method || null,
      collector_name || null,
      note || null,
      paymentId,
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
          message: 'Payment not found',
        });
      }

      res.json({
        success: true,
        message: 'Payment updated successfully',
      });
    }
  );
});

/* =========================================================
   DELETE PAYMENT
========================================================= */
router.delete('/:id', (req, res) => {
  const paymentId = req.params.id;

  db.query('DELETE FROM payments WHERE id = ?', [paymentId], (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    res.json({
      success: true,
      message: 'Payment deleted successfully',
    });
  });
});

module.exports = router;
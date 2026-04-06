const express = require('express');
const db = require('../db');

const router = express.Router();

console.log('PAYMENT REQUEST ROUTES FILE LOADED');

/* --------------------------------------------------
   MEMBER: SUBMIT PAYMENT REQUEST
-------------------------------------------------- */
router.post('/', (req, res) => {
  const {
    member_id,
    organization_id,
    payment_month,
    payment_year,
    amount_paid,
    utr_number,
    screenshot,
    note,
  } = req.body;

  if (!member_id || !organization_id || !payment_month || !payment_year || !amount_paid) {
    return res.status(400).json({
      success: false,
      message: 'member_id, organization_id, payment_month, payment_year and amount_paid are required',
    });
  }

  const sql = `
    INSERT INTO payment_requests (
      member_id,
      organization_id,
      payment_month,
      payment_year,
      amount_paid,
      utr_number,
      screenshot,
      note,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `;

  db.query(
    sql,
    [
      member_id,
      organization_id,
      payment_month,
      payment_year,
      amount_paid,
      utr_number || null,
      screenshot || null,
      note || null,
    ],
    (err, result) => {
      if (err) {
        console.log('ADD PAYMENT REQUEST ERROR:', err);
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }

      return res.json({
        success: true,
        message: 'Payment request submitted successfully',
        request_id: result.insertId,
      });
    }
  );
});

/* --------------------------------------------------
   MEMBER: GET OWN PAYMENT REQUESTS
-------------------------------------------------- */
router.get('/member/:memberId', (req, res) => {
  const { memberId } = req.params;

  const sql = `
    SELECT *
    FROM payment_requests
    WHERE member_id = ?
    ORDER BY submitted_at DESC, id DESC
  `;

  db.query(sql, [memberId], (err, results) => {
    if (err) {
      console.log('GET MEMBER PAYMENT REQUESTS ERROR:', err);
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    return res.json({
      success: true,
      data: results,
    });
  });
});

/* --------------------------------------------------
   ADMIN: GET ALL PENDING REQUESTS
   optional: ?organization_id=8
-------------------------------------------------- */
router.get('/pending', (req, res) => {
  const organizationId = req.query.organization_id;

  let sql = `
    SELECT
      pr.*,
      m.full_name AS member_name,
      m.phone,
      o.name AS organization_name
    FROM payment_requests pr
    JOIN members m ON m.id = pr.member_id
    JOIN organizations o ON o.id = pr.organization_id
    WHERE pr.status = 'pending'
  `;

  const values = [];

  if (organizationId) {
    sql += ` AND pr.organization_id = ?`;
    values.push(organizationId);
  }

  sql += ` ORDER BY pr.submitted_at DESC, pr.id DESC`;

  db.query(sql, values, (err, results) => {
    if (err) {
      console.log('GET PENDING REQUESTS ERROR:', err);
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    return res.json({
      success: true,
      data: results,
    });
  });
});

/* --------------------------------------------------
   ADMIN: APPROVE REQUEST
   - inserts into payments
   - marks request approved
-------------------------------------------------- */
router.post('/:id/approve', (req, res) => {
  const requestId = req.params.id;
  const { reviewer_id, payment_method, collector_name } = req.body;

  const findSql = `
    SELECT *
    FROM payment_requests
    WHERE id = ? AND status = 'pending'
    LIMIT 1
  `;

  db.query(findSql, [requestId], (findErr, findResults) => {
    if (findErr) {
      console.log('FIND REQUEST ERROR:', findErr);
      return res.status(500).json({
        success: false,
        message: findErr.message,
      });
    }

    if (findResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pending request not found',
      });
    }

    const request = findResults[0];

    const insertPaymentSql = `
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
      insertPaymentSql,
      [
        request.member_id,
        request.organization_id,
        request.payment_month,
        request.payment_year,
        request.amount_paid,
        payment_method || 'UPI',
        collector_name || 'Admin Verification',
        request.note || null,
      ],
      (payErr, payResult) => {
        if (payErr) {
          console.log('INSERT PAYMENT ERROR:', payErr);
          return res.status(500).json({
            success: false,
            message: payErr.message,
          });
        }

        const updateRequestSql = `
          UPDATE payment_requests
          SET
            status = 'approved',
            reviewed_at = NOW(),
            reviewed_by = ?
          WHERE id = ?
        `;

        db.query(
          updateRequestSql,
          [reviewer_id || null, requestId],
          (updateErr) => {
            if (updateErr) {
              console.log('UPDATE REQUEST APPROVED ERROR:', updateErr);
              return res.status(500).json({
                success: false,
                message: updateErr.message,
              });
            }

            return res.json({
              success: true,
              message: 'Payment request approved successfully',
              payment_id: payResult.insertId,
            });
          }
        );
      }
    );
  });
});

/* --------------------------------------------------
   ADMIN: REJECT REQUEST
-------------------------------------------------- */
router.post('/:id/reject', (req, res) => {
  const requestId = req.params.id;
  const { reviewer_id } = req.body;

  const sql = `
    UPDATE payment_requests
    SET
      status = 'rejected',
      reviewed_at = NOW(),
      reviewed_by = ?
    WHERE id = ? AND status = 'pending'
  `;

  db.query(sql, [reviewer_id || null, requestId], (err, result) => {
    if (err) {
      console.log('REJECT REQUEST ERROR:', err);
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pending request not found',
      });
    }

    return res.json({
      success: true,
      message: 'Payment request rejected',
    });
  });
});

module.exports = router;
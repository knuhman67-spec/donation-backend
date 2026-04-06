const express = require('express');
const db = require('../db');

const router = express.Router();

/* GET ALL ORGANIZATIONS */
router.get('/', (req, res) => {
  const sql = 'SELECT * FROM organizations ORDER BY id DESC';

  db.query(sql, (err, results) => {
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

/* ADD ORGANIZATION */
router.post('/', (req, res) => {
  console.log('ADD ORGANIZATION BODY:', req.body);
  const {
    name,
    type,
    total_target,
    monthly_target,
    upi_id,
    qr_image,
    payment_note,
  } = req.body;

  if (!name || !type || total_target == null || monthly_target == null) {
    return res.status(400).json({
      success: false,
      message: 'name, type, total_target and monthly_target are required',
    });
  }

  const sql = `
    INSERT INTO organizations (
      name,
      type,
      total_target,
      monthly_target,
      upi_id,
      qr_image,
      payment_note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      name,
      type,
      total_target,
      monthly_target,
      upi_id || null,
      qr_image || null,
      payment_note || null,
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
        message: 'Organization created successfully',
        organization_id: result.insertId,
      });
    }
  );
});

/* UPDATE ORGANIZATION */
router.put('/:id', (req, res) => {
  const id = req.params.id;

  const {
    name,
    type,
    total_target,
    monthly_target,
    upi_id,
    qr_image,
    payment_note,
  } = req.body;

  if (!name || !type || total_target == null || monthly_target == null) {
    return res.status(400).json({
      success: false,
      message: 'name, type, total_target and monthly_target are required',
    });
  }

  const sql = `
    UPDATE organizations
    SET 
      name = ?,
      type = ?,
      total_target = ?,
      monthly_target = ?,
      upi_id = ?,
      qr_image = ?,
      payment_note = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [
      name,
      type,
      total_target,
      monthly_target,
      upi_id || null,
      qr_image || null,
      payment_note || null,
      id,
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
          message: 'Organization not found',
        });
      }

      res.json({
        success: true,
        message: 'Organization updated successfully',
      });
    }
  );
});

/* ORGANIZATION DASHBOARD */
router.get('/:id/dashboard', (req, res) => {
  const organizationId = req.params.id;
  const month = parseInt(req.query.month);
  const year = parseInt(req.query.year);

  if (!month || !year) {
    return res.status(400).json({
      success: false,
      message: 'month and year query parameters are required',
    });
  }

  const sql = `
    SELECT 
      o.*,

      (
        SELECT COUNT(*)
        FROM members m
        WHERE m.organization_id = o.id
      ) AS total_members,

      (
        SELECT IFNULL(SUM(p.amount_paid), 0)
        FROM payments p
        WHERE p.organization_id = o.id
          AND p.payment_month = ?
          AND p.payment_year = ?
      ) AS current_month_collected,

      (
        SELECT IFNULL(SUM(p.amount_paid), 0)
        FROM payments p
        WHERE p.organization_id = o.id
      ) AS total_collected

    FROM organizations o
    WHERE o.id = ?
  `;

  db.query(sql, [month, year, organizationId], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    const row = results[0];

    const totalTarget = Number(row.total_target || 0);
    const monthlyTarget = Number(row.monthly_target || 0);
    const totalCollected = Number(row.total_collected || 0);
    const currentMonthCollected = Number(row.current_month_collected || 0);

    res.json({
      success: true,
      data: {
        ...row,
        total_balance: totalTarget - totalCollected,
        monthly_balance: monthlyTarget - currentMonthCollected,
        monthly_progress_percent:
          monthlyTarget > 0
            ? Number(((currentMonthCollected / monthlyTarget) * 100).toFixed(2))
            : 0,
        total_progress_percent:
          totalTarget > 0
            ? Number(((totalCollected / totalTarget) * 100).toFixed(2))
            : 0,
      },
    });
  });
});

/* GET SINGLE ORGANIZATION */
router.get('/:id', (req, res) => {
  const id = req.params.id;

  const sql = 'SELECT * FROM organizations WHERE id = ?';

  db.query(sql, [id], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    res.json({
      success: true,
      data: results[0],
    });
  });
});

/* DELETE ORGANIZATION */
router.delete('/:id', (req, res) => {
  const id = req.params.id;

  const checkSql = `
    SELECT
      (SELECT COUNT(*) FROM members WHERE organization_id = ?) AS member_count,
      (SELECT COUNT(*) FROM payments WHERE organization_id = ?) AS payment_count
  `;

  db.query(checkSql, [id, id], (checkErr, checkResults) => {
    if (checkErr) {
      return res.status(500).json({
        success: false,
        message: checkErr.message,
      });
    }

    const memberCount = Number(checkResults[0].member_count || 0);
    const paymentCount = Number(checkResults[0].payment_count || 0);

    console.log('DELETE ORG ID:', id);
    console.log('MEMBER COUNT:', memberCount);
    console.log('PAYMENT COUNT:', paymentCount);

    if (memberCount > 0 || paymentCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot delete organization because members or payments exist under it',
      });
    }

    const deleteSql = 'DELETE FROM organizations WHERE id = ?';

    db.query(deleteSql, [id], (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found',
        });
      }

      res.json({
        success: true,
        message: 'Organization deleted successfully',
      });
    });
  });
});

router.get('/debug/:id', (req, res) => {
  const id = req.params.id;

  const sql = `
    SELECT
      (SELECT COUNT(*) FROM members WHERE organization_id = ?) AS member_count,
      (SELECT COUNT(*) FROM payments WHERE organization_id = ?) AS payment_count
  `;

  db.query(sql, [id, id], (err, results) => {
    res.json(results[0]);
  });
});

module.exports = router;
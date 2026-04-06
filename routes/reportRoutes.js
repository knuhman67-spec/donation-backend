const express = require('express');
const db = require('../db');

const router = express.Router();

/*
  Monthly report
  Example:
  /reports/monthly?organization_id=1&month=4&year=2026
*/
router.get('/monthly', (req, res) => {
  const organizationId = req.query.organization_id;
  const month = parseInt(req.query.month);
  const year = parseInt(req.query.year);

  if (!organizationId || !month || !year) {
    return res.status(400).json({
      success: false,
      message: 'organization_id, month and year are required',
    });
  }

  const summarySql = `
    SELECT
      COUNT(CASE WHEN m.member_status = 'active' THEN 1 END) AS total_members,
      IFNULL(SUM(CASE WHEN m.member_status = 'active' THEN m.monthly_due ELSE 0 END), 0) AS total_expected,
      IFNULL(SUM(CASE WHEN m.member_status = 'active' THEN p.amount_paid ELSE 0 END), 0) AS total_collected
    FROM members m
    LEFT JOIN payments p
      ON p.member_id = m.id
      AND p.organization_id = m.organization_id
      AND p.payment_month = ?
      AND p.payment_year = ?
    WHERE m.organization_id = ?
  `;

  const detailSql = `
    SELECT
      m.id,
      m.organization_id,
      m.full_name,
      m.house_name,
      m.house_number,
      m.phone,
      m.category_type,
      m.monthly_due,
      m.live_status,
      m.member_status,
      IFNULL(SUM(p.amount_paid), 0) AS paid_amount,
      (IFNULL(m.monthly_due, 0) - IFNULL(SUM(p.amount_paid), 0)) AS balance
    FROM members m
    LEFT JOIN payments p
      ON p.member_id = m.id
      AND p.payment_month = ?
      AND p.payment_year = ?
      AND p.organization_id = m.organization_id
    WHERE m.organization_id = ?
      AND m.member_status = 'active'
    GROUP BY
      m.id,
      m.organization_id,
      m.full_name,
      m.house_name,
      m.house_number,
      m.phone,
      m.category_type,
      m.monthly_due,
      m.live_status,
      m.member_status
    ORDER BY m.full_name ASC
  `;

  db.query(summarySql, [month, year, organizationId], (err, summaryResults) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    db.query(detailSql, [month, year, organizationId], (err2, detailResults) => {
      if (err2) {
        return res.status(500).json({
          success: false,
          message: err2.message,
        });
      }

      const summary = summaryResults[0] || {};

      const fullyPaid = detailResults.filter(
        (item) => Number(item.paid_amount) >= Number(item.monthly_due || 0)
      ).length;

      const partiallyPaid = detailResults.filter(
        (item) =>
          Number(item.paid_amount) > 0 &&
          Number(item.paid_amount) < Number(item.monthly_due || 0)
      ).length;

      const unpaid = detailResults.filter(
        (item) => Number(item.paid_amount) === 0
      ).length;

      res.json({
        success: true,
        summary: {
          total_members: Number(summary.total_members || 0),
          total_expected: Number(summary.total_expected || 0),
          total_collected: Number(summary.total_collected || 0),
          total_balance:
            Number(summary.total_expected || 0) -
            Number(summary.total_collected || 0),
          fully_paid: fullyPaid,
          partially_paid: partiallyPaid,
          unpaid: unpaid,
        },
        details: detailResults,
      });
    });
  });
});

/*
  Year status report
  Example:
  /reports/year-status?organization_id=1&year=2026
*/
router.get('/year-status', (req, res) => {
  const organizationId = req.query.organization_id;
  const year = parseInt(req.query.year);

  if (!organizationId || !year) {
    return res.status(400).json({
      success: false,
      message: 'organization_id and year are required',
    });
  }

  const membersSql = `
  SELECT
    id,
    organization_id,
    full_name,
    house_name,
    phone,
    monthly_due,
    member_status,
    profile_image
  FROM members
  WHERE organization_id = ?
    AND member_status = 'active'
  ORDER BY full_name ASC
`;

  const paymentsSql = `
    SELECT
      member_id,
      payment_month,
      IFNULL(SUM(amount_paid), 0) AS total_paid
    FROM payments
    WHERE organization_id = ?
      AND payment_year = ?
    GROUP BY member_id, payment_month
    ORDER BY member_id ASC, payment_month ASC
  `;

  db.query(membersSql, [organizationId], (err, memberResults) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    db.query(paymentsSql, [organizationId, year], (err2, paymentResults) => {
      if (err2) {
        return res.status(500).json({
          success: false,
          message: err2.message,
        });
      }

      const paymentMap = {};

      paymentResults.forEach((row) => {
        const memberId = Number(row.member_id);
        const month = Number(row.payment_month);
        const totalPaid = Number(row.total_paid || 0);

        if (!paymentMap[memberId]) {
          paymentMap[memberId] = {};
        }

        paymentMap[memberId][month] = totalPaid;
      });

      const members = memberResults.map((member) => {
        const due = Number(member.monthly_due || 0);
        const memberId = Number(member.id);
        const months = [];

        for (let month = 1; month <= 12; month++) {
          const paid = Number(paymentMap[memberId]?.[month] || 0);

          let status = 'unpaid';
          if (paid >= due && due > 0) {
            status = 'paid';
          } else if (paid > 0) {
            status = 'partial';
          }

          months.push({
            month,
            paid_amount: paid,
            monthly_due: due,
            balance: Math.max(due - paid, 0),
            status,
          });
        }

        return {
          id: memberId,
          organization_id: Number(member.organization_id),
          full_name: member.full_name,
          house_name: member.house_name,
          phone: member.phone,
          monthly_due: due,
          profile_image: member.profile_image || null,
          months,
        };
      });

      res.json({
        success: true,
        year,
        total_members: members.length,
        data: members,
      });
    });
  });
});

module.exports = router;
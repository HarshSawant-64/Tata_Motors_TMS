// Weekly / Monthly / 6-Month PDF report downloads.
//
// Each endpoint pulls real, current data straight from the database via
// reportBuilder.collectReportData and streams a generated PDF back to the
// client — nothing here is pre-rendered or hard-coded. Available to any
// authenticated user (Admin or HR), matching the rest of the API.

const express = require('express');
const PDFDocument = require('pdfkit');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');
const { collectReportData, drawReport, PERIOD_LABELS } = require('../utils/reportBuilder');

const router = express.Router();

async function sendReport(req, res, period) {
  try {
    const data = await collectReportData(period, req.user);

    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const filename = `TMTP-${period}-report-${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);
    drawReport(doc, data);
    doc.end();

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'DOWNLOAD_REPORT',
        details: `${req.user.username} downloaded the ${PERIOD_LABELS[period]}.`,
      },
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate report.' });
    }
  }
}

router.get('/weekly', requireAuth, (req, res) => sendReport(req, res, 'weekly'));
router.get('/monthly', requireAuth, (req, res) => sendReport(req, res, 'monthly'));
router.get('/six-month', requireAuth, (req, res) => sendReport(req, res, 'sixmonth'));

module.exports = router;

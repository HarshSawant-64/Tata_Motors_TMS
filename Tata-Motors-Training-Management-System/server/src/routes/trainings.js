// Manually-added trainings for the Scheduling calendar "Create Program"
// flow. The built-in training catalog per main program (SHE / Induction /
// F&T / C&B) lives in the client (constants.ts). This route lets a user add
// a training that isn't in that catalog yet — it's stored here so it
// persists across refreshes and becomes available for all future
// scheduling, without touching the built-in list.

const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// List custom trainings, optionally filtered to a single main program.
router.get('/', requireAuth, async (req, res) => {
  const { mainProgram } = req.query;
  const where = mainProgram ? { mainProgram: String(mainProgram) } : {};
  const trainings = await prisma.training.findMany({ where, orderBy: { name: 'asc' } });
  res.json(trainings);
});

router.post('/', requireAuth, async (req, res) => {
  const { mainProgram, name } = req.body || {};
  if (!mainProgram || !String(mainProgram).trim()) {
    return res.status(400).json({ error: 'mainProgram is required.' });
  }
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'A training name is required.' });
  }

  try {
    const training = await prisma.training.upsert({
      where: { mainProgram_name: { mainProgram: String(mainProgram).trim(), name: String(name).trim() } },
      update: {},
      create: { mainProgram: String(mainProgram).trim(), name: String(name).trim() },
    });
    res.status(201).json(training);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save the new training.' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await prisma.training.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Training not found.' });
    res.status(500).json({ error: 'Failed to delete training.' });
  }
});

module.exports = router;

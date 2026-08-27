// Manually-added main programs for the Scheduling calendar "Create Program"
// flow. The four built-in main programs (SHE / Induction / F&T / C&B) live
// in the client (constants.ts) and server (routes/programs.js). This route
// lets a user add a main program that isn't in that built-in set — it's
// stored here so it persists across refreshes and becomes available
// immediately (and for all future scheduling) without touching the
// built-in list. Mirrors routes/trainings.js.

const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Kept in sync with CALENDAR_MAIN_PROGRAMS in routes/programs.js / the
// client's constants.ts. Used only to stop a manually-added main program
// from shadowing one of the built-in four.
const BUILT_IN_MAIN_PROGRAMS = ['SHE', 'Induction', 'F&T', 'C&B'];

// List all manually-added main programs.
router.get('/', requireAuth, async (req, res) => {
  const mainPrograms = await prisma.mainProgram.findMany({ orderBy: { label: 'asc' } });
  res.json(mainPrograms);
});

router.post('/', requireAuth, async (req, res) => {
  const { label } = req.body || {};
  const trimmed = label ? String(label).trim() : '';
  if (!trimmed) {
    return res.status(400).json({ error: 'A main program name is required.' });
  }
  if (BUILT_IN_MAIN_PROGRAMS.some((b) => b.toLowerCase() === trimmed.toLowerCase())) {
    return res.status(409).json({ error: 'This is already one of the built-in main programs.' });
  }

  try {
    const mainProgram = await prisma.mainProgram.upsert({
      where: { value: trimmed },
      update: {},
      create: { value: trimmed, label: trimmed },
    });
    res.status(201).json(mainProgram);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save the new main program.' });
  }
});

// Deleting a manually-created main program also removes the manually-added
// trainings scoped to it (see routes/trainings.js) so no orphaned custom
// training entries are left pointing at a main program that no longer
// exists. This does not touch any Program/Session records that may already
// reference this category — existing scheduling data is left intact.
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const mainProgram = await prisma.mainProgram.findUnique({ where: { id: Number(req.params.id) } });
    if (!mainProgram) return res.status(404).json({ error: 'Main program not found.' });

    await prisma.$transaction([
      prisma.training.deleteMany({ where: { mainProgram: mainProgram.value } }),
      prisma.mainProgram.delete({ where: { id: mainProgram.id } }),
    ]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Main program not found.' });
    res.status(500).json({ error: 'Failed to delete main program.' });
  }
});

module.exports = router;

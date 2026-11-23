import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthedRequest, requireAdmin, requireAuth } from '../lib/auth';
import { getDaysUntilDate, todayStart } from '../lib/dates';

const router = Router();
router.use(requireAuth);

const createEventSchema = z.object({
  title: z.string().min(2, 'El título del evento es requerido'),
  description: z.string().optional().default(''),
  type: z
    .enum(['BIRTHDAY_GROUP', 'SECRET_SANTA', 'GIFT_EXCHANGE', 'ANNIVERSARY', 'CELEBRATION'])
    .optional()
    .default('CELEBRATION'),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha YYYY-MM-DD'),
  eventTime: z.string().optional().default('16:00'),
  location: z.string().optional().default(''),
  selectedTheme: z.string().optional().default(''),
  quotaAmount: z.number().min(0).optional().default(0),
  budgetNote: z.string().optional().default(''),
  initialThemes: z
    .array(
      z.object({
        title: z.string().min(2),
        description: z.string().optional().default(''),
        emoji: z.string().optional().default('🎈'),
      })
    )
    .optional()
    .default([]),
});

async function serializeEvent(eventId: string, currentMemberId: string, spaceId: string) {
  const [event, spaceMembers] = await Promise.all([
    prisma.event.findFirst({
      where: { id: eventId, spaceId },
      include: {
        createdBy: { select: { id: true, name: true, avatarEmoji: true } },
        themeOptions: {
          orderBy: { createdAt: 'asc' },
          include: {
            proposedBy: { select: { id: true, name: true } },
            votes: { select: { memberId: true } },
          },
        },
        checklistItems: {
          orderBy: [{ completed: 'asc' }, { createdAt: 'asc' }],
          include: {
            assignedTo: { select: { id: true, name: true, avatarEmoji: true, avatarColor: true } },
          },
        },
        contributions: {
          include: {
            member: { select: { id: true, name: true, avatarEmoji: true, avatarColor: true } },
          },
        },
        santaAssignments: {
          include: {
            receiver: {
              select: {
                id: true,
                name: true,
                avatarEmoji: true,
                avatarColor: true,
                jobTitle: true,
                allergies: true,
                favoriteTreats: true,
              },
            },
          },
        },
      },
    }),
    prisma.member.findMany({
      where: { spaceId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, avatarEmoji: true, avatarColor: true },
    }),
  ]);

  if (!event) return null;

  const totalVotes = event.themeOptions.reduce((sum, opt) => sum + opt.votes.length, 0);
  const themeOptions = event.themeOptions.map((opt) => ({
    id: opt.id,
    title: opt.title,
    description: opt.description,
    emoji: opt.emoji,
    proposedByName: opt.proposedBy.name,
    proposedById: opt.proposedById,
    voteCount: opt.votes.length,
    percentage: totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0,
    votedByMe: opt.votes.some((v) => v.memberId === currentMemberId),
  }));

  // Build full contribution list covering every space member
  const contribMap = new Map(event.contributions.map((c) => [c.memberId, c]));
  const contributions = spaceMembers.map((m) => {
    const existing = contribMap.get(m.id);
    return {
      memberId: m.id,
      memberName: m.name,
      avatarEmoji: m.avatarEmoji,
      avatarColor: m.avatarColor,
      amount: existing ? existing.amount : event.quotaAmount,
      paid: existing ? existing.paid : false,
      paidAt: existing?.paidAt ?? null,
      note: existing?.note ?? '',
    };
  });

  const paidCount = contributions.filter((c) => c.paid).length;
  const collectedTotal = contributions.filter((c) => c.paid).reduce((sum, c) => sum + c.amount, 0);
  const expectedTotal = contributions.reduce((sum, c) => sum + c.amount, 0);

  // Secret Santa: ONLY return the requesting user's own receiver!
  const mySanta = event.santaAssignments.find((a) => a.giverId === currentMemberId);

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    type: event.type,
    eventDate: event.eventDate,
    eventTime: event.eventTime,
    daysUntil: getDaysUntilDate(event.eventDate, todayStart()),
    location: event.location,
    selectedTheme: event.selectedTheme,
    votingClosed: event.votingClosed,
    quotaAmount: event.quotaAmount,
    budgetNote: event.budgetNote,
    createdBy: event.createdBy,
    totalVotes,
    themeOptions,
    checklistItems: event.checklistItems,
    checklistDoneCount: event.checklistItems.filter((i) => i.completed).length,
    checklistTotalCount: event.checklistItems.length,
    contributions,
    paidCount,
    totalMembers: spaceMembers.length,
    collectedTotal,
    expectedTotal,
    secretSantaDrawn: event.santaAssignments.length > 0,
    mySecretSantaReceiver: mySanta?.receiver ?? null,
  };
}

// List all events in space
router.get('/', async (req: AuthedRequest, res) => {
  const events = await prisma.event.findMany({
    where: { spaceId: req.user!.spaceId },
    orderBy: { eventDate: 'asc' },
    select: { id: true },
  });

  const serialized = await Promise.all(
    events.map((e) => serializeEvent(e.id, req.user!.memberId, req.user!.spaceId))
  );

  res.json({ events: serialized.filter(Boolean) });
});

// Get single event detail
router.get('/:eventId', async (req: AuthedRequest, res) => {
  const event = await serializeEvent(req.params.eventId, req.user!.memberId, req.user!.spaceId);
  if (!event) {
    res.status(404).json({ error: 'Evento no encontrado.' });
    return;
  }
  res.json({ event });
});

// Create general event (Admin)
router.post('/', requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    return;
  }

  const { initialThemes, ...eventData } = parsed.data;
  const created = await prisma.event.create({
    data: {
      ...eventData,
      spaceId: req.user!.spaceId,
      createdById: req.user!.memberId,
      themeOptions: {
        create: initialThemes.map((t) => ({
          title: t.title,
          description: t.description,
          emoji: t.emoji,
          proposedById: req.user!.memberId,
        })),
      },
    },
  });

  const event = await serializeEvent(created.id, req.user!.memberId, req.user!.spaceId);
  res.status(201).json({ event });
});

// Update event (Admin)
router.patch('/:eventId', requireAdmin, async (req: AuthedRequest, res) => {
  const existing = await prisma.event.findFirst({
    where: { id: req.params.eventId, spaceId: req.user!.spaceId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Evento no encontrado.' });
    return;
  }

  const schema = z.object({
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    eventTime: z.string().optional(),
    location: z.string().optional(),
    selectedTheme: z.string().optional(),
    votingClosed: z.boolean().optional(),
    quotaAmount: z.number().min(0).optional(),
    budgetNote: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    return;
  }

  await prisma.event.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  const event = await serializeEvent(existing.id, req.user!.memberId, req.user!.spaceId);
  res.json({ event });
});

// Delete event (Admin)
router.delete('/:eventId', requireAdmin, async (req: AuthedRequest, res) => {
  const existing = await prisma.event.findFirst({
    where: { id: req.params.eventId, spaceId: req.user!.spaceId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Evento no encontrado.' });
    return;
  }

  await prisma.event.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

// ================= THEME OPTIONS & VOTING =================
router.post('/:eventId/themes', async (req: AuthedRequest, res) => {
  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, spaceId: req.user!.spaceId },
  });
  if (!event) {
    res.status(404).json({ error: 'Evento no encontrado.' });
    return;
  }
  if (event.votingClosed && req.user!.role !== 'ADMIN') {
    res.status(403).json({ error: 'La votación de temáticas ya está cerrada.' });
    return;
  }

  const schema = z.object({
    title: z.string().min(2, 'Escribe el nombre de la temática'),
    description: z.string().optional().default(''),
    emoji: z.string().optional().default('🎈'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    return;
  }

  await prisma.themeOption.create({
    data: {
      eventId: event.id,
      proposedById: req.user!.memberId,
      title: parsed.data.title.trim(),
      description: parsed.data.description.trim(),
      emoji: parsed.data.emoji || '🎈',
    },
  });

  const updated = await serializeEvent(event.id, req.user!.memberId, req.user!.spaceId);
  res.status(201).json({ event: updated });
});

router.post('/:eventId/themes/:optionId/vote', async (req: AuthedRequest, res) => {
  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, spaceId: req.user!.spaceId },
    include: { themeOptions: { select: { id: true } } },
  });
  if (!event) {
    res.status(404).json({ error: 'Evento no encontrado.' });
    return;
  }
  if (event.votingClosed) {
    res.status(403).json({ error: 'La votación ya fue cerrada por el administrador.' });
    return;
  }

  const optionIds = event.themeOptions.map((o) => o.id);
  if (!optionIds.includes(req.params.optionId)) {
    res.status(404).json({ error: 'Temática no encontrada.' });
    return;
  }

  const existingVote = await prisma.themeVote.findUnique({
    where: {
      themeOptionId_memberId: {
        themeOptionId: req.params.optionId,
        memberId: req.user!.memberId,
      },
    },
  });

  // Single-choice per event: clear previous votes on this event, then toggle chosen option
  await prisma.themeVote.deleteMany({
    where: {
      memberId: req.user!.memberId,
      themeOptionId: { in: optionIds },
    },
  });

  if (!existingVote) {
    await prisma.themeVote.create({
      data: {
        themeOptionId: req.params.optionId,
        memberId: req.user!.memberId,
      },
    });
  }

  const updated = await serializeEvent(event.id, req.user!.memberId, req.user!.spaceId);
  res.json({ event: updated });
});

router.post('/:eventId/themes/:optionId/select', requireAdmin, async (req: AuthedRequest, res) => {
  const option = await prisma.themeOption.findFirst({
    where: {
      id: req.params.optionId,
      eventId: req.params.eventId,
      event: { spaceId: req.user!.spaceId },
    },
  });
  if (!option) {
    res.status(404).json({ error: 'Temática no encontrada.' });
    return;
  }

  await prisma.event.update({
    where: { id: option.eventId },
    data: {
      selectedTheme: `${option.emoji} ${option.title}`,
      votingClosed: true,
    },
  });

  const updated = await serializeEvent(option.eventId, req.user!.memberId, req.user!.spaceId);
  res.json({ event: updated });
});

router.delete('/:eventId/themes/:optionId', async (req: AuthedRequest, res) => {
  const option = await prisma.themeOption.findFirst({
    where: {
      id: req.params.optionId,
      eventId: req.params.eventId,
      event: { spaceId: req.user!.spaceId },
    },
  });
  if (!option) {
    res.status(404).json({ error: 'Temática no encontrada.' });
    return;
  }
  if (req.user!.role !== 'ADMIN' && option.proposedById !== req.user!.memberId) {
    res.status(403).json({ error: 'Solo el administrador o quien propuso la temática puede eliminarla.' });
    return;
  }

  await prisma.themeOption.delete({ where: { id: option.id } });
  const updated = await serializeEvent(option.eventId, req.user!.memberId, req.user!.spaceId);
  res.json({ event: updated });
});

// ================= COLLABORATIVE CHECKLIST =================
router.post('/:eventId/checklist', async (req: AuthedRequest, res) => {
  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, spaceId: req.user!.spaceId },
  });
  if (!event) {
    res.status(404).json({ error: 'Evento no encontrado.' });
    return;
  }

  const schema = z.object({
    title: z.string().min(2, 'Describe qué hay que llevar'),
    category: z.string().optional().default('Comida'),
    estimatedCost: z.number().min(0).optional().default(0),
    claimByMe: z.boolean().optional().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    return;
  }

  await prisma.checklistItem.create({
    data: {
      eventId: event.id,
      title: parsed.data.title.trim(),
      category: parsed.data.category,
      estimatedCost: parsed.data.estimatedCost,
      assignedToId: parsed.data.claimByMe ? req.user!.memberId : null,
    },
  });

  const updated = await serializeEvent(event.id, req.user!.memberId, req.user!.spaceId);
  res.status(201).json({ event: updated });
});

router.patch('/:eventId/checklist/:itemId', async (req: AuthedRequest, res) => {
  const item = await prisma.checklistItem.findFirst({
    where: {
      id: req.params.itemId,
      eventId: req.params.eventId,
      event: { spaceId: req.user!.spaceId },
    },
  });
  if (!item) {
    res.status(404).json({ error: 'Ítem del checklist no encontrado.' });
    return;
  }

  const { toggleClaim, toggleComplete, assignedToId, completed } = req.body as {
    toggleClaim?: boolean;
    toggleComplete?: boolean;
    assignedToId?: string | null;
    completed?: boolean;
  };

  const data: { assignedToId?: string | null; completed?: boolean } = {};
  if (toggleClaim) {
    data.assignedToId = item.assignedToId === req.user!.memberId ? null : req.user!.memberId;
  } else if (assignedToId !== undefined) {
    data.assignedToId = assignedToId;
  }

  if (toggleComplete) {
    data.completed = !item.completed;
  } else if (completed !== undefined) {
    data.completed = completed;
  }

  await prisma.checklistItem.update({
    where: { id: item.id },
    data,
  });

  const updated = await serializeEvent(item.eventId, req.user!.memberId, req.user!.spaceId);
  res.json({ event: updated });
});

router.delete('/:eventId/checklist/:itemId', async (req: AuthedRequest, res) => {
  const item = await prisma.checklistItem.findFirst({
    where: {
      id: req.params.itemId,
      eventId: req.params.eventId,
      event: { spaceId: req.user!.spaceId },
    },
  });
  if (!item) {
    res.status(404).json({ error: 'Ítem no encontrado.' });
    return;
  }

  await prisma.checklistItem.delete({ where: { id: item.id } });
  const updated = await serializeEvent(item.eventId, req.user!.memberId, req.user!.spaceId);
  res.json({ event: updated });
});

// ================= QUOTA CONTRIBUTIONS =================
router.post('/:eventId/contributions/:memberId/toggle', async (req: AuthedRequest, res) => {
  const targetMemberId = req.params.memberId;
  if (req.user!.role !== 'ADMIN' && targetMemberId !== req.user!.memberId) {
    res.status(403).json({ error: 'Solo puedes actualizar tu propia cuota o ser Admin.' });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, spaceId: req.user!.spaceId },
  });
  if (!event) {
    res.status(404).json({ error: 'Evento no encontrado.' });
    return;
  }

  const existing = await prisma.eventContribution.findUnique({
    where: { eventId_memberId: { eventId: event.id, memberId: targetMemberId } },
  });

  if (existing) {
    const nextPaid = !existing.paid;
    await prisma.eventContribution.update({
      where: { id: existing.id },
      data: {
        paid: nextPaid,
        paidAt: nextPaid ? new Date() : null,
        amount: typeof req.body?.amount === 'number' ? req.body.amount : existing.amount,
      },
    });
  } else {
    await prisma.eventContribution.create({
      data: {
        eventId: event.id,
        memberId: targetMemberId,
        amount: typeof req.body?.amount === 'number' ? req.body.amount : event.quotaAmount,
        paid: true,
        paidAt: new Date(),
      },
    });
  }

  const updated = await serializeEvent(event.id, req.user!.memberId, req.user!.spaceId);
  res.json({ event: updated });
});

// ================= SECRET SANTA DRAW (ADMIN) =================
router.post('/:eventId/secret-santa/draw', requireAdmin, async (req: AuthedRequest, res) => {
  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, spaceId: req.user!.spaceId },
  });
  if (!event) {
    res.status(404).json({ error: 'Evento no encontrado.' });
    return;
  }

  const members = await prisma.member.findMany({
    where: { spaceId: req.user!.spaceId },
    select: { id: true },
  });

  if (members.length < 2) {
    res.status(400).json({ error: 'Se necesitan al menos 2 miembros para sortear Amigo Secreto.' });
    return;
  }

  // Generate a random circular derangement (guaranteed nobody gets themselves!)
  const shuffled = [...members].sort(() => Math.random() - 0.5);
  const pairs = shuffled.map((giver, idx) => ({
    eventId: event.id,
    giverId: giver.id,
    receiverId: shuffled[(idx + 1) % shuffled.length].id,
  }));

  await prisma.$transaction([
    prisma.secretSantaAssignment.deleteMany({ where: { eventId: event.id } }),
    prisma.secretSantaAssignment.createMany({ data: pairs }),
  ]);

  const updated = await serializeEvent(event.id, req.user!.memberId, req.user!.spaceId);
  res.json({ event: updated });
});

export default router;

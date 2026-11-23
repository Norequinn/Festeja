import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthedRequest, requireAdmin, requireAuth } from '../lib/auth';
import { getDaysUntilDate, todayStart } from '../lib/dates';

const router = Router();
router.use(requireAuth);

const paymentScheduleSchema = z.object({
  title: z.string().min(2, 'El título del pago es requerido'),
  description: z.string().optional().default(''),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha YYYY-MM-DD'),
  amountPerPerson: z.number().min(0, 'El monto debe ser mayor o igual a 0'),
  currency: z.string().min(1).max(10).optional(),
  targetMemberId: z.string().nullable().optional(),
  excludeTargetMember: z.boolean().optional().default(false),
  wishlistItemId: z.string().nullable().optional(),
  buyerMemberId: z.string().nullable().optional(),
  buyerName: z.string().min(2, 'Indica quién realizará la compra'),
  paymentMethod: z.string().min(2, 'Indica el método de pago').default('Transferencia'),
  bankName: z.string().optional().default(''),
  accountOrPhone: z.string().optional().default(''),
  documentId: z.string().optional().default(''),
  paymentNotes: z.string().optional().default(''),
});

const updateScheduleSchema = paymentScheduleSchema.partial().extend({
  status: z.enum(['OPEN', 'CLOSED']).optional(),
});

async function serializeSchedule(scheduleId: string, currentMemberId: string, spaceId: string) {
  const [schedule, spaceMembers] = await Promise.all([
    prisma.paymentSchedule.findFirst({
      where: { id: scheduleId, spaceId },
      include: {
        createdBy: { select: { id: true, name: true, avatarEmoji: true } },
        buyerMember: { select: { id: true, name: true, avatarEmoji: true, avatarColor: true, avatarImageUrl: true, jobTitle: true } },
        targetMember: { select: { id: true, name: true, avatarEmoji: true, avatarColor: true, avatarImageUrl: true, birthDate: true } },
        wishlistItem: {
          select: {
            id: true,
            ownerId: true,
            title: true,
            estimatedPrice: true,
            url: true,
            imageUrl: true,
            description: true,
          },
        },
        records: {
          include: {
            member: { select: { id: true, name: true, avatarEmoji: true, avatarColor: true, avatarImageUrl: true } },
          },
        },
      },
    }),
    prisma.member.findMany({
      where: { spaceId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, avatarEmoji: true, avatarColor: true, avatarImageUrl: true },
    }),
  ]);

  if (!schedule) return null;

  const eligibleMembers =
    schedule.excludeTargetMember && schedule.targetMemberId
      ? spaceMembers.filter((m) => m.id !== schedule.targetMemberId)
      : spaceMembers;

  const recordMap = new Map(schedule.records.map((r) => [r.memberId, r]));

  const records = eligibleMembers.map((m) => {
    const existing = recordMap.get(m.id);
    return {
      memberId: m.id,
      memberName: m.name,
      avatarEmoji: m.avatarEmoji,
      avatarColor: m.avatarColor,
      avatarImageUrl: m.avatarImageUrl,
      amount: existing ? existing.amount : schedule.amountPerPerson,
      status: (existing?.status || 'PENDING') as 'PENDING' | 'REPORTED' | 'CONFIRMED',
      reference: existing?.reference || '',
      receiptImageUrl: existing?.receiptImageUrl || '',
      note: existing?.note || '',
      paidAt: existing?.paidAt ?? null,
    };
  });

  const confirmedCount = records.filter((r) => r.status === 'CONFIRMED').length;
  const reportedCount = records.filter((r) => r.status === 'REPORTED').length;
  const pendingCount = records.filter((r) => r.status === 'PENDING').length;
  const collectedTotal = records
    .filter((r) => r.status === 'CONFIRMED')
    .reduce((sum, r) => sum + r.amount, 0);
  const expectedTotal = records.reduce((sum, r) => sum + r.amount, 0);
  const myRecord = records.find((r) => r.memberId === currentMemberId) || null;

  // PRIVACY: Never reveal the selected group gift from the wishlist to the gift owner!
  const hideGiftFromOwner =
    schedule.wishlistItem && schedule.wishlistItem.ownerId === currentMemberId;
  const visibleGroupGift = hideGiftFromOwner ? null : schedule.wishlistItem;

  const paymentSummaryText = [
    `💵 *${schedule.title}*`,
    `📅 Fecha de pago: ${schedule.dueDate}`,
    `💰 Monto por persona: ${schedule.currency} ${schedule.amountPerPerson}`,
    visibleGroupGift
      ? `🎁 Regalo grupal: ${visibleGroupGift.title}${visibleGroupGift.estimatedPrice ? ` (${visibleGroupGift.estimatedPrice})` : ''}`
      : '',
    `🛍️ Responsable de la compra: ${schedule.buyerName}`,
    `💳 Método: ${schedule.paymentMethod}${schedule.bankName ? ` (${schedule.bankName})` : ''}`,
    schedule.accountOrPhone ? `📱 Cuenta / Teléfono: ${schedule.accountOrPhone}` : '',
    schedule.documentId ? `🪪 Documento / Cédula: ${schedule.documentId}` : '',
    schedule.paymentNotes ? `📝 Nota: ${schedule.paymentNotes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    id: schedule.id,
    title: schedule.title,
    description: schedule.description,
    dueDate: schedule.dueDate,
    daysUntil: getDaysUntilDate(schedule.dueDate, todayStart()),
    amountPerPerson: schedule.amountPerPerson,
    currency: schedule.currency,
    status: schedule.status as 'OPEN' | 'CLOSED',
    targetMemberId: schedule.targetMemberId,
    targetMember: schedule.targetMember,
    excludeTargetMember: schedule.excludeTargetMember,
    wishlistItemId: hideGiftFromOwner ? null : schedule.wishlistItemId,
    groupGift: visibleGroupGift,
    buyerMemberId: schedule.buyerMemberId,
    buyerMember: schedule.buyerMember,
    buyerName: schedule.buyerName,
    paymentMethod: schedule.paymentMethod,
    bankName: schedule.bankName,
    accountOrPhone: schedule.accountOrPhone,
    documentId: schedule.documentId,
    paymentNotes: schedule.paymentNotes,
    createdBy: schedule.createdBy,
    records,
    myRecord,
    confirmedCount,
    reportedCount,
    pendingCount,
    totalParticipants: records.length,
    collectedTotal,
    expectedTotal,
    paymentSummaryText,
  };
}

// List all payment schedules in space
router.get('/', async (req: AuthedRequest, res) => {
  const schedules = await prisma.paymentSchedule.findMany({
    where: { spaceId: req.user!.spaceId },
    orderBy: [{ status: 'desc' }, { dueDate: 'asc' }],
    select: { id: true },
  });

  const serialized = await Promise.all(
    schedules.map((s) => serializeSchedule(s.id, req.user!.memberId, req.user!.spaceId))
  );

  res.json({ schedules: serialized.filter(Boolean) });
});

// Get single payment schedule detail
router.get('/:scheduleId', async (req: AuthedRequest, res) => {
  const schedule = await serializeSchedule(
    req.params.scheduleId,
    req.user!.memberId,
    req.user!.spaceId
  );
  if (!schedule) {
    res.status(404).json({ error: 'Fecha de pago no encontrada.' });
    return;
  }
  res.json({ schedule });
});

// Admin: Create payment schedule
router.post('/', requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = paymentScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    return;
  }

  const space = await prisma.space.findUnique({ where: { id: req.user!.spaceId } });
  const data = parsed.data;

  const created = await prisma.paymentSchedule.create({
    data: {
      spaceId: req.user!.spaceId,
      createdById: req.user!.memberId,
      title: data.title.trim(),
      description: data.description.trim(),
      dueDate: data.dueDate,
      amountPerPerson: data.amountPerPerson,
      currency: data.currency || space?.currency || 'USD',
      targetMemberId: data.targetMemberId || null,
      excludeTargetMember: data.excludeTargetMember,
      wishlistItemId: data.wishlistItemId || null,
      buyerMemberId: data.buyerMemberId || null,
      buyerName: data.buyerName.trim(),
      paymentMethod: data.paymentMethod.trim(),
      bankName: data.bankName.trim(),
      accountOrPhone: data.accountOrPhone.trim(),
      documentId: data.documentId.trim(),
      paymentNotes: data.paymentNotes.trim(),
    },
  });

  // If a wishlist item was chosen as the group gift for this payment, mark it as group gift too
  if (data.wishlistItemId) {
    const gift = await prisma.wishlistItem.findUnique({ where: { id: data.wishlistItemId } });
    if (gift && gift.ownerId !== req.user!.memberId) {
      await prisma.wishlistItem.updateMany({
        where: { ownerId: gift.ownerId, isGroupGift: true, id: { not: gift.id } },
        data: { isGroupGift: false, groupGiftSelectedById: null },
      });
      await prisma.wishlistItem.update({
        where: { id: gift.id },
        data: {
          isGroupGift: true,
          groupGiftSelectedById: req.user!.memberId,
          reservedById: null,
          reservedAt: null,
        },
      });
    }
  }

  const schedule = await serializeSchedule(created.id, req.user!.memberId, req.user!.spaceId);
  res.status(201).json({ schedule });
});

// Admin: Update payment schedule (date, amount, buyer details, status)
router.patch('/:scheduleId', requireAdmin, async (req: AuthedRequest, res) => {
  const existing = await prisma.paymentSchedule.findFirst({
    where: { id: req.params.scheduleId, spaceId: req.user!.spaceId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Fecha de pago no encontrada.' });
    return;
  }

  const parsed = updateScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    return;
  }

  await prisma.paymentSchedule.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  if (parsed.data.wishlistItemId) {
    const gift = await prisma.wishlistItem.findUnique({
      where: { id: parsed.data.wishlistItemId },
    });
    if (gift && gift.ownerId !== req.user!.memberId) {
      await prisma.wishlistItem.updateMany({
        where: { ownerId: gift.ownerId, isGroupGift: true, id: { not: gift.id } },
        data: { isGroupGift: false, groupGiftSelectedById: null },
      });
      await prisma.wishlistItem.update({
        where: { id: gift.id },
        data: {
          isGroupGift: true,
          groupGiftSelectedById: req.user!.memberId,
          reservedById: null,
          reservedAt: null,
        },
      });
    }
  }

  const schedule = await serializeSchedule(existing.id, req.user!.memberId, req.user!.spaceId);
  res.json({ schedule });
});

// Admin: Delete payment schedule
router.delete('/:scheduleId', requireAdmin, async (req: AuthedRequest, res) => {
  const existing = await prisma.paymentSchedule.findFirst({
    where: { id: req.params.scheduleId, spaceId: req.user!.spaceId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Fecha de pago no encontrada.' });
    return;
  }

  await prisma.paymentSchedule.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

// Member: Report own payment (with reference/note)
router.post('/:scheduleId/report', async (req: AuthedRequest, res) => {
  const schedule = await prisma.paymentSchedule.findFirst({
    where: { id: req.params.scheduleId, spaceId: req.user!.spaceId },
  });
  if (!schedule) {
    res.status(404).json({ error: 'Fecha de pago no encontrada.' });
    return;
  }

  const schema = z.object({
    reference: z.string().optional().default(''),
    receiptImageUrl: z.string().optional().default(''),
    note: z.string().optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos de comprobante inválidos.' });
    return;
  }

  // If Admin reports their own payment, confirm immediately; otherwise mark REPORTED
  const nextStatus = req.user!.role === 'ADMIN' ? 'CONFIRMED' : 'REPORTED';

  await prisma.paymentRecord.upsert({
    where: {
      scheduleId_memberId: {
        scheduleId: schedule.id,
        memberId: req.user!.memberId,
      },
    },
    update: {
      amount: schedule.amountPerPerson,
      status: nextStatus,
      reference: parsed.data.reference.trim(),
      receiptImageUrl: parsed.data.receiptImageUrl.trim(),
      note: parsed.data.note.trim(),
      paidAt: new Date(),
    },
    create: {
      scheduleId: schedule.id,
      memberId: req.user!.memberId,
      amount: schedule.amountPerPerson,
      status: nextStatus,
      reference: parsed.data.reference.trim(),
      receiptImageUrl: parsed.data.receiptImageUrl.trim(),
      note: parsed.data.note.trim(),
      paidAt: new Date(),
    },
  });

  const updated = await serializeSchedule(schedule.id, req.user!.memberId, req.user!.spaceId);
  res.json({ schedule: updated });
});

// Admin: Confirm / set status for any member's payment
router.patch('/:scheduleId/records/:memberId', requireAdmin, async (req: AuthedRequest, res) => {
  const schedule = await prisma.paymentSchedule.findFirst({
    where: { id: req.params.scheduleId, spaceId: req.user!.spaceId },
  });
  if (!schedule) {
    res.status(404).json({ error: 'Fecha de pago no encontrada.' });
    return;
  }

  const schema = z.object({
    status: z.enum(['PENDING', 'REPORTED', 'CONFIRMED']),
    reference: z.string().optional(),
    note: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Estado de pago inválido.' });
    return;
  }

  const existing = await prisma.paymentRecord.findUnique({
    where: {
      scheduleId_memberId: {
        scheduleId: schedule.id,
        memberId: req.params.memberId,
      },
    },
  });

  await prisma.paymentRecord.upsert({
    where: {
      scheduleId_memberId: {
        scheduleId: schedule.id,
        memberId: req.params.memberId,
      },
    },
    update: {
      status: parsed.data.status,
      reference: parsed.data.reference !== undefined ? parsed.data.reference : existing?.reference || '',
      note: parsed.data.note !== undefined ? parsed.data.note : existing?.note || '',
      paidAt: parsed.data.status === 'PENDING' ? null : existing?.paidAt || new Date(),
    },
    create: {
      scheduleId: schedule.id,
      memberId: req.params.memberId,
      amount: schedule.amountPerPerson,
      status: parsed.data.status,
      reference: parsed.data.reference || '',
      note: parsed.data.note || '',
      paidAt: parsed.data.status === 'PENDING' ? null : new Date(),
    },
  });

  const updated = await serializeSchedule(schedule.id, req.user!.memberId, req.user!.spaceId);
  res.json({ schedule: updated });
});

export default router;

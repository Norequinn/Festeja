import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  AuthedRequest,
  buildMagicLinks,
  generateInviteCode,
  requireAdmin,
  requireAuth,
} from '../lib/auth';
import { getDaysUntilDate, getNextAnnualOccurrence, todayStart } from '../lib/dates';

const router = Router();
router.use(requireAuth);

const updateSpaceSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  reminderDaysBefore: z.number().int().min(1).max(30).optional(),
  currency: z.string().min(1).max(8).optional(),
  accentColor: z.string().optional(),
});

router.get('/current', async (req: AuthedRequest, res) => {
  const space = await prisma.space.findUnique({
    where: { id: req.user!.spaceId },
    include: { _count: { select: { members: true, events: true } } },
  });

  if (!space) {
    res.status(404).json({ error: 'Espacio no encontrado.' });
    return;
  }

  res.json({
    ...space,
    memberCount: space._count.members,
    eventCount: space._count.events,
    magicLinks: buildMagicLinks(space.inviteCode),
  });
});

router.patch('/current', requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = updateSpaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    return;
  }

  const updated = await prisma.space.update({
    where: { id: req.user!.spaceId },
    data: parsed.data,
  });

  res.json({
    ...updated,
    magicLinks: buildMagicLinks(updated.inviteCode),
  });
});

router.post('/current/regenerate-code', requireAdmin, async (req: AuthedRequest, res) => {
  const { customCode } = req.body as { customCode?: string };
  const space = await prisma.space.findUnique({ where: { id: req.user!.spaceId } });
  if (!space) {
    res.status(404).json({ error: 'Espacio no encontrado.' });
    return;
  }

  let nextCode = customCode
    ? customCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
    : generateInviteCode(space.name);

  if (nextCode.length < 4) {
    res.status(400).json({ error: 'El código debe tener al menos 4 caracteres.' });
    return;
  }

  const conflict = await prisma.space.findUnique({ where: { inviteCode: nextCode } });
  if (conflict && conflict.id !== space.id) {
    if (customCode) {
      res.status(409).json({ error: `El código ${nextCode} ya está en uso.` });
      return;
    }
    while (await prisma.space.findUnique({ where: { inviteCode: nextCode } })) {
      nextCode = generateInviteCode(space.name);
    }
  }

  const updated = await prisma.space.update({
    where: { id: space.id },
    data: { inviteCode: nextCode },
  });

  res.json({
    inviteCode: updated.inviteCode,
    magicLinks: buildMagicLinks(updated.inviteCode),
  });
});

/**
 * Unified calendar and upcoming celebrations endpoint.
 * Query params: ?year=2026&month=11 (1-based month)
 */
router.get('/calendar', async (req: AuthedRequest, res) => {
  const ref = todayStart();
  const year = Number(req.query.year) || ref.getFullYear();
  const month = Number(req.query.month) || ref.getMonth() + 1;

  const [space, members, events, paymentSchedules] = await Promise.all([
    prisma.space.findUnique({ where: { id: req.user!.spaceId } }),
    prisma.member.findMany({
      where: { spaceId: req.user!.spaceId },
      orderBy: { name: 'asc' },
    }),
    prisma.event.findMany({
      where: { spaceId: req.user!.spaceId },
      orderBy: { eventDate: 'asc' },
      include: {
        _count: { select: { themeOptions: true, checklistItems: true } },
      },
    }),
    prisma.paymentSchedule.findMany({
      where: { spaceId: req.user!.spaceId, status: 'OPEN' },
      orderBy: { dueDate: 'asc' },
    }),
  ]);

  const reminderWindow = space?.reminderDaysBefore ?? 7;

  interface CalendarEntry {
    id: string;
    kind: 'BIRTHDAY' | 'ANNIVERSARY' | 'EVENT' | 'PAYMENT';
    eventType?: string;
    title: string;
    subtitle: string;
    date: string; // YYYY-MM-DD (next occurrence or event date)
    dayOfMonth: number;
    month: number;
    daysUntil: number;
    isAlert: boolean;
    emoji: string;
    color: string;
    memberId?: string;
    eventId?: string;
    paymentScheduleId?: string;
    selectedTheme?: string;
  }

  const upcoming: CalendarEntry[] = [];
  const monthEntries: CalendarEntry[] = [];

  for (const m of members) {
    // Birthday
    const nextBday = getNextAnnualOccurrence(m.birthDate, ref);
    if (nextBday) {
      const entry: CalendarEntry = {
        id: `bday-${m.id}`,
        kind: 'BIRTHDAY',
        title: `Cumpleaños de ${m.name}`,
        subtitle: m.jobTitle ? `${m.jobTitle}` : '¡Día especial!',
        date: nextBday.nextDate,
        dayOfMonth: nextBday.day,
        month: nextBday.month,
        daysUntil: nextBday.daysUntil,
        isAlert: nextBday.daysUntil >= 0 && nextBday.daysUntil <= reminderWindow,
        emoji: '🎂',
        color: '#FF5A5F',
        memberId: m.id,
      };
      upcoming.push(entry);

      if (nextBday.month === month) {
        const ymd = `${year}-${String(month).padStart(2, '0')}-${String(nextBday.day).padStart(2, '0')}`;
        monthEntries.push({ ...entry, date: ymd });
      }
    }

    // Work anniversary
    if (m.workAnniversary) {
      const nextAnniv = getNextAnnualOccurrence(m.workAnniversary, ref);
      if (nextAnniv && nextAnniv.yearsCount > 0) {
        const entry: CalendarEntry = {
          id: `anniv-${m.id}`,
          kind: 'ANNIVERSARY',
          title: `Aniversario laboral: ${m.name}`,
          subtitle: `Cumple ${nextAnniv.yearsCount} ${nextAnniv.yearsCount === 1 ? 'año' : 'años'} en el equipo`,
          date: nextAnniv.nextDate,
          dayOfMonth: nextAnniv.day,
          month: nextAnniv.month,
          daysUntil: nextAnniv.daysUntil,
          isAlert: nextAnniv.daysUntil >= 0 && nextAnniv.daysUntil <= reminderWindow,
          emoji: '🏆',
          color: '#F59E0B',
          memberId: m.id,
        };
        upcoming.push(entry);

        if (nextAnniv.month === month) {
          const ymd = `${year}-${String(month).padStart(2, '0')}-${String(nextAnniv.day).padStart(2, '0')}`;
          monthEntries.push({ ...entry, date: ymd });
        }
      }
    }
  }

  for (const ev of events) {
    const daysUntil = getDaysUntilDate(ev.eventDate, ref);
    const [evY, evM, evD] = ev.eventDate.split('-').map(Number);
    const emojiMap: Record<string, string> = {
      BIRTHDAY_GROUP: '🥳',
      SECRET_SANTA: '🎅',
      GIFT_EXCHANGE: '🎁',
      ANNIVERSARY: '🥂',
      CELEBRATION: '🎉',
    };

    const entry: CalendarEntry = {
      id: `event-${ev.id}`,
      kind: 'EVENT',
      eventType: ev.type,
      title: ev.title,
      subtitle: ev.selectedTheme
        ? `Temática: ${ev.selectedTheme}`
        : ev.location || `${ev._count.themeOptions} temáticas en votación`,
      date: ev.eventDate,
      dayOfMonth: evD || 1,
      month: evM || month,
      daysUntil,
      isAlert: daysUntil >= 0 && daysUntil <= reminderWindow,
      emoji: emojiMap[ev.type] || '🎉',
      color: ev.type === 'SECRET_SANTA' ? '#10B981' : '#6366F1',
      eventId: ev.id,
      selectedTheme: ev.selectedTheme,
    };

    if (daysUntil >= -1) {
      upcoming.push(entry);
    }
    if (evY === year && evM === month) {
      monthEntries.push(entry);
    }
  }

  for (const pay of paymentSchedules) {
    const daysUntil = getDaysUntilDate(pay.dueDate, ref);
    const [pY, pM, pD] = pay.dueDate.split('-').map(Number);

    const entry: CalendarEntry = {
      id: `payment-${pay.id}`,
      kind: 'PAYMENT',
      title: `Pago: ${pay.title}`,
      subtitle: `${pay.currency} ${pay.amountPerPerson} · Compra: ${pay.buyerName} (${pay.paymentMethod})`,
      date: pay.dueDate,
      dayOfMonth: pD || 1,
      month: pM || month,
      daysUntil,
      isAlert: daysUntil >= 0 && daysUntil <= reminderWindow,
      emoji: '💵',
      color: '#059669',
      paymentScheduleId: pay.id,
    };

    if (daysUntil >= -1) {
      upcoming.push(entry);
    }
    if (pY === year && pM === month) {
      monthEntries.push(entry);
    }
  }

  upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  monthEntries.sort((a, b) => a.dayOfMonth - b.dayOfMonth);

  const alerts = upcoming.filter((u) => u.isAlert);

  res.json({
    year,
    month,
    reminderDaysBefore: reminderWindow,
    alerts,
    upcoming: upcoming.slice(0, 15),
    monthEntries,
  });
});

// Muro de Celebraciones (con encuestas y reacciones por emoji)
async function serializeWallPost(postId: string, currentMemberId: string) {
  const post = await prisma.celebrationPost.findUnique({
    where: { id: postId },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          avatarEmoji: true,
          avatarColor: true,
          avatarImageUrl: true,
          jobTitle: true,
        },
      },
      targetMember: { select: { id: true, name: true, avatarEmoji: true } },
      reactions: { select: { emoji: true, memberId: true } },
      pollOptions: {
        orderBy: { order: 'asc' },
        include: {
          votes: { select: { memberId: true } },
        },
      },
    },
  });
  if (!post) return null;

  // Group reactions by emoji
  const reactionMap = new Map<string, { emoji: string; count: number; reactedByMe: boolean }>();
  for (const r of post.reactions) {
    const entry = reactionMap.get(r.emoji) || { emoji: r.emoji, count: 0, reactedByMe: false };
    entry.count += 1;
    if (r.memberId === currentMemberId) entry.reactedByMe = true;
    reactionMap.set(r.emoji, entry);
  }

  const totalPollVotes = post.pollOptions.reduce((sum, o) => sum + o.votes.length, 0);
  const pollOptions = post.pollOptions.map((o) => ({
    id: o.id,
    label: o.label,
    voteCount: o.votes.length,
    percentage: totalPollVotes > 0 ? Math.round((o.votes.length / totalPollVotes) * 100) : 0,
    votedByMe: o.votes.some((v) => v.memberId === currentMemberId),
  }));

  return {
    id: post.id,
    message: post.message,
    emoji: post.emoji,
    imageUrl: post.imageUrl,
    likesCount: post.likesCount,
    createdAt: post.createdAt,
    author: post.author,
    targetMember: post.targetMember,
    reactions: Array.from(reactionMap.values()),
    totalPollVotes,
    pollOptions,
  };
}

router.get('/wall', async (req: AuthedRequest, res) => {
  const posts = await prisma.celebrationPost.findMany({
    where: { spaceId: req.user!.spaceId },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { id: true },
  });

  const serialized = await Promise.all(
    posts.map((p) => serializeWallPost(p.id, req.user!.memberId))
  );
  res.json({ posts: serialized.filter(Boolean) });
});

router.post('/wall', async (req: AuthedRequest, res) => {
  const schema = z.object({
    message: z.string().min(2, 'Escribe un mensaje para el muro'),
    emoji: z.string().optional().default('🥳'),
    imageUrl: z.string().optional().default(''),
    targetMemberId: z.string().optional().nullable(),
    pollOptions: z.array(z.string().min(1)).max(6).optional().default([]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Mensaje inválido' });
    return;
  }

  const cleanOptions = parsed.data.pollOptions.map((o) => o.trim()).filter(Boolean);

  const created = await prisma.celebrationPost.create({
    data: {
      spaceId: req.user!.spaceId,
      authorId: req.user!.memberId,
      targetMemberId: parsed.data.targetMemberId || null,
      message: parsed.data.message.trim(),
      emoji: parsed.data.emoji || '🥳',
      imageUrl: parsed.data.imageUrl.trim(),
      pollOptions:
        cleanOptions.length >= 2
          ? {
              create: cleanOptions.map((label, idx) => ({ label, order: idx })),
            }
          : undefined,
    },
  });

  const post = await serializeWallPost(created.id, req.user!.memberId);
  res.status(201).json({ post });
});

router.post('/wall/:postId/react', async (req: AuthedRequest, res) => {
  const emoji = typeof req.body?.emoji === 'string' ? req.body.emoji.trim() : '';
  if (!emoji) {
    res.status(400).json({ error: 'Emoji requerido.' });
    return;
  }

  const existingPost = await prisma.celebrationPost.findFirst({
    where: { id: req.params.postId, spaceId: req.user!.spaceId },
  });
  if (!existingPost) {
    res.status(404).json({ error: 'Publicación no encontrada.' });
    return;
  }

  const existingReaction = await prisma.postReaction.findUnique({
    where: {
      postId_memberId_emoji: {
        postId: existingPost.id,
        memberId: req.user!.memberId,
        emoji,
      },
    },
  });

  if (existingReaction) {
    await prisma.postReaction.delete({ where: { id: existingReaction.id } });
  } else {
    await prisma.postReaction.create({
      data: {
        postId: existingPost.id,
        memberId: req.user!.memberId,
        emoji,
      },
    });
  }

  const post = await serializeWallPost(existingPost.id, req.user!.memberId);
  res.json({ post });
});

router.post('/wall/:postId/poll/:optionId/vote', async (req: AuthedRequest, res) => {
  const existingPost = await prisma.celebrationPost.findFirst({
    where: { id: req.params.postId, spaceId: req.user!.spaceId },
    include: { pollOptions: { select: { id: true } } },
  });
  if (!existingPost) {
    res.status(404).json({ error: 'Publicación no encontrada.' });
    return;
  }

  const optionIds = existingPost.pollOptions.map((o) => o.id);
  if (!optionIds.includes(req.params.optionId)) {
    res.status(404).json({ error: 'Opción de encuesta no encontrada.' });
    return;
  }

  const existingVote = await prisma.pollVote.findUnique({
    where: {
      optionId_memberId: {
        optionId: req.params.optionId,
        memberId: req.user!.memberId,
      },
    },
  });

  // Single-choice poll vote per post
  await prisma.pollVote.deleteMany({
    where: {
      memberId: req.user!.memberId,
      optionId: { in: optionIds },
    },
  });

  if (!existingVote) {
    await prisma.pollVote.create({
      data: {
        optionId: req.params.optionId,
        memberId: req.user!.memberId,
      },
    });
  }

  const post = await serializeWallPost(existingPost.id, req.user!.memberId);
  res.json({ post });
});

router.post('/wall/:postId/like', async (req: AuthedRequest, res) => {
  const existing = await prisma.celebrationPost.findFirst({
    where: { id: req.params.postId, spaceId: req.user!.spaceId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Publicación no encontrada.' });
    return;
  }

  await prisma.celebrationPost.update({
    where: { id: existing.id },
    data: { likesCount: { increment: 1 } },
  });

  const post = await serializeWallPost(existing.id, req.user!.memberId);
  res.json({ post });
});

export default router;

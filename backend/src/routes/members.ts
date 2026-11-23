import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthedRequest, requireAdmin, requireAuth } from '../lib/auth';
import { getNextAnnualOccurrence, todayStart } from '../lib/dates';

const router = Router();
router.use(requireAuth);

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  avatarEmoji: z.string().optional(),
  avatarColor: z.string().optional(),
  avatarImageUrl: z.string().optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  workAnniversary: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  shirtSize: z.string().optional(),
  shoeSize: z.string().optional(),
  favoriteColors: z.string().optional(),
  allergies: z.string().optional(),
  favoriteTreats: z.string().optional(),
  hobbiesNotes: z.string().optional(),
});

const wishlistItemSchema = z.object({
  title: z.string().min(2, 'Escribe el nombre del regalo'),
  description: z.string().optional().default(''),
  url: z.string().optional().default(''),
  imageUrl: z.string().optional().default(''),
  estimatedPrice: z.string().optional().default(''),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional().default('MEDIUM'),
});

// List all members in the space
router.get('/', async (req: AuthedRequest, res) => {
  const ref = todayStart();
  const members = await prisma.member.findMany({
    where: { spaceId: req.user!.spaceId },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          wishlistItems: true,
          surpriseReceived: true,
        },
      },
    },
  });

  const mapped = members.map((m) => {
    const isSelf = m.id === req.user!.memberId;
    const nextBday = getNextAnnualOccurrence(m.birthDate, ref);
    const nextAnniv = m.workAnniversary ? getNextAnnualOccurrence(m.workAnniversary, ref) : null;

    return {
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      jobTitle: m.jobTitle,
      department: m.department,
      avatarEmoji: m.avatarEmoji,
      avatarColor: m.avatarColor,
      avatarImageUrl: m.avatarImageUrl,
      birthDate: m.birthDate,
      workAnniversary: m.workAnniversary,
      shirtSize: m.shirtSize,
      shoeSize: m.shoeSize,
      favoriteColors: m.favoriteColors,
      allergies: m.allergies,
      favoriteTreats: m.favoriteTreats,
      hobbiesNotes: m.hobbiesNotes,
      isSelf,
      daysUntilBirthday: nextBday?.daysUntil ?? null,
      nextBirthdayDate: nextBday?.nextDate ?? null,
      daysUntilAnniversary: nextAnniv?.daysUntil ?? null,
      wishlistCount: m._count.wishlistItems,
      // Never expose surprise count to the birthday person
      surpriseMessagesCount: isSelf ? 0 : m._count.surpriseReceived,
    };
  });

  res.json({ members: mapped });
});

// Update my own profile
router.patch('/me', async (req: AuthedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    return;
  }

  const updated = await prisma.member.update({
    where: { id: req.user!.memberId },
    data: parsed.data,
  });

  const { pinHash: _ignored, ...safeMember } = updated;
  res.json({ member: safeMember });
});

// Member detail + Wishlist (strict secret reservation & group gift privacy!)
router.get('/:memberId', async (req: AuthedRequest, res) => {
  const member = await prisma.member.findFirst({
    where: { id: req.params.memberId, spaceId: req.user!.spaceId },
    include: {
      wishlistItems: {
        orderBy: [{ isGroupGift: 'desc' }, { priority: 'asc' }, { createdAt: 'desc' }],
        include: {
          reservedBy: { select: { id: true, name: true, avatarEmoji: true } },
          groupGiftSelectedBy: { select: { id: true, name: true } },
          groupGiftParticipants: {
            orderBy: { createdAt: 'asc' },
            include: {
              member: { select: { id: true, name: true, avatarEmoji: true, avatarColor: true } },
            },
          },
        },
      },
      _count: {
        select: { surpriseReceived: true },
      },
    },
  });

  if (!member) {
    res.status(404).json({ error: 'Compañero no encontrado.' });
    return;
  }

  const isSelf = member.id === req.user!.memberId;
  const ref = todayStart();
  const nextBday = getNextAnnualOccurrence(member.birthDate, ref);
  const nextAnniv = member.workAnniversary
    ? getNextAnnualOccurrence(member.workAnniversary, ref)
    : null;

  const { pinHash: _ignored, wishlistItems, _count, ...safeMember } = member;

  // CRITICAL PRIVACY RULE:
  // If viewing OWN wishlist, strip all reservation & group gift info so the birthday person never knows!
  const sanitizedWishlist = wishlistItems.map((item) => {
    if (isSelf) {
      return {
        id: item.id,
        ownerId: item.ownerId,
        title: item.title,
        description: item.description,
        url: item.url,
        imageUrl: item.imageUrl,
        estimatedPrice: item.estimatedPrice,
        priority: item.priority,
        createdAt: item.createdAt,
        isReserved: false,
        reservedByMe: false,
        reservedByName: null,
        reservedNote: '',
        isGroupGift: false,
        groupGiftNote: '',
        groupGiftSelectedByName: null,
        groupGiftParticipants: [],
        joinedGroupGift: false,
      };
    }

    const participants = item.groupGiftParticipants.map((p) => p.member);
    return {
      id: item.id,
      ownerId: item.ownerId,
      title: item.title,
      description: item.description,
      url: item.url,
      imageUrl: item.imageUrl,
      estimatedPrice: item.estimatedPrice,
      priority: item.priority,
      createdAt: item.createdAt,
      isReserved: Boolean(item.reservedById),
      reservedByMe: item.reservedById === req.user!.memberId,
      reservedByName: item.reservedBy?.name ?? null,
      reservedNote: item.reservedNote,
      isGroupGift: item.isGroupGift,
      groupGiftNote: item.groupGiftNote,
      groupGiftSelectedByName: item.groupGiftSelectedBy?.name ?? null,
      groupGiftParticipants: participants,
      joinedGroupGift: participants.some((p) => p.id === req.user!.memberId),
    };
  });

  res.json({
    member: {
      ...safeMember,
      isSelf,
      daysUntilBirthday: nextBday?.daysUntil ?? null,
      nextBirthdayDate: nextBday?.nextDate ?? null,
      daysUntilAnniversary: nextAnniv?.daysUntil ?? null,
      canAccessSurpriseMode: !isSelf,
      surpriseMessagesCount: isSelf ? 0 : _count.surpriseReceived,
    },
    wishlist: sanitizedWishlist,
  });
});

// Admin: Change a member's role
router.patch('/:memberId/role', requireAdmin, async (req: AuthedRequest, res) => {
  const schema = z.object({ role: z.enum(['ADMIN', 'MEMBER']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Rol inválido (ADMIN o MEMBER).' });
    return;
  }

  const target = await prisma.member.findFirst({
    where: { id: req.params.memberId, spaceId: req.user!.spaceId },
  });
  if (!target) {
    res.status(404).json({ error: 'Miembro no encontrado.' });
    return;
  }

  const updated = await prisma.member.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
    select: { id: true, name: true, role: true },
  });

  res.json({ member: updated });
});

// Add item to own wishlist
router.post('/me/wishlist', async (req: AuthedRequest, res) => {
  const parsed = wishlistItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    return;
  }

  const item = await prisma.wishlistItem.create({
    data: {
      ownerId: req.user!.memberId,
      ...parsed.data,
    },
  });

  res.status(201).json({
    item: {
      id: item.id,
      ownerId: item.ownerId,
      title: item.title,
      description: item.description,
      url: item.url,
      imageUrl: item.imageUrl,
      estimatedPrice: item.estimatedPrice,
      priority: item.priority,
      createdAt: item.createdAt,
      isReserved: false,
      reservedByMe: false,
      reservedByName: null,
      reservedNote: '',
      isGroupGift: false,
      groupGiftNote: '',
      groupGiftSelectedByName: null,
      groupGiftParticipants: [],
      joinedGroupGift: false,
    },
  });
});

// Delete own wishlist item
router.delete('/me/wishlist/:itemId', async (req: AuthedRequest, res) => {
  const item = await prisma.wishlistItem.findFirst({
    where: { id: req.params.itemId, ownerId: req.user!.memberId },
  });
  if (!item) {
    res.status(404).json({ error: 'Regalo no encontrado en tu lista.' });
    return;
  }

  await prisma.wishlistItem.delete({ where: { id: item.id } });
  res.json({ ok: true });
});

// Secretly reserve / unreserve a colleague's wishlist item
router.post('/:memberId/wishlist/:itemId/reserve', async (req: AuthedRequest, res) => {
  if (req.params.memberId === req.user!.memberId) {
    res.status(403).json({
      error: 'No puedes reservar regalos en tu propia lista. ¡Deja que te sorprendan!',
    });
    return;
  }

  const item = await prisma.wishlistItem.findFirst({
    where: {
      id: req.params.itemId,
      ownerId: req.params.memberId,
      owner: { spaceId: req.user!.spaceId },
    },
    include: { reservedBy: { select: { id: true, name: true } } },
  });

  if (!item) {
    res.status(404).json({ error: 'Regalo no encontrado.' });
    return;
  }

  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

  // Toggle off if already reserved by current user
  if (item.reservedById === req.user!.memberId) {
    const updated = await prisma.wishlistItem.update({
      where: { id: item.id },
      data: { reservedById: null, reservedAt: null, reservedNote: '' },
    });
    res.json({
      item: {
        ...updated,
        isReserved: false,
        reservedByMe: false,
        reservedByName: null,
      },
    });
    return;
  }

  // Already reserved by someone else
  if (item.reservedById && item.reservedById !== req.user!.memberId) {
    res.status(409).json({
      error: `Este regalo ya fue reservado por ${item.reservedBy?.name || 'otro compañero'}.`,
    });
    return;
  }

  const updated = await prisma.wishlistItem.update({
    where: { id: item.id },
    data: {
      reservedById: req.user!.memberId,
      reservedAt: new Date(),
      reservedNote: note,
    },
    include: { reservedBy: { select: { id: true, name: true } } },
  });

  res.json({
    item: {
      id: updated.id,
      ownerId: updated.ownerId,
      title: updated.title,
      description: updated.description,
      url: updated.url,
      imageUrl: updated.imageUrl,
      estimatedPrice: updated.estimatedPrice,
      priority: updated.priority,
      isReserved: true,
      reservedByMe: true,
      reservedByName: updated.reservedBy?.name ?? null,
      reservedNote: updated.reservedNote,
      isGroupGift: updated.isGroupGift,
      groupGiftNote: updated.groupGiftNote,
      groupGiftSelectedByName: null,
      groupGiftParticipants: [],
      joinedGroupGift: false,
    },
  });
});

// Select or unselect a colleague's wishlist item as the official GROUP GIFT (secret from owner!)
router.post('/:memberId/wishlist/:itemId/group-gift', async (req: AuthedRequest, res) => {
  if (req.params.memberId === req.user!.memberId) {
    res.status(403).json({
      error: '¡Shh! No puedes elegir el regalo grupal en tu propia lista.',
    });
    return;
  }

  const item = await prisma.wishlistItem.findFirst({
    where: {
      id: req.params.itemId,
      ownerId: req.params.memberId,
      owner: { spaceId: req.user!.spaceId },
    },
  });

  if (!item) {
    res.status(404).json({ error: 'Regalo no encontrado.' });
    return;
  }

  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  const shouldSet =
    typeof req.body?.enabled === 'boolean' ? req.body.enabled : !item.isGroupGift;

  if (!shouldSet) {
    await prisma.wishlistItem.update({
      where: { id: item.id },
      data: {
        isGroupGift: false,
        groupGiftNote: '',
        groupGiftSelectedById: null,
      },
    });
    await prisma.groupGiftParticipant.deleteMany({ where: { wishlistItemId: item.id } });
  } else {
    // Only one official group gift per colleague's wishlist at a time
    await prisma.wishlistItem.updateMany({
      where: { ownerId: req.params.memberId, isGroupGift: true, id: { not: item.id } },
      data: { isGroupGift: false, groupGiftSelectedById: null },
    });

    await prisma.wishlistItem.update({
      where: { id: item.id },
      data: {
        isGroupGift: true,
        groupGiftNote: note || item.groupGiftNote,
        groupGiftSelectedById: req.user!.memberId,
        // Clear individual reservation so it belongs to the whole group
        reservedById: null,
        reservedAt: null,
        reservedNote: '',
      },
    });

    // Automatically add selector as first participant
    await prisma.groupGiftParticipant.upsert({
      where: {
        wishlistItemId_memberId: {
          wishlistItemId: item.id,
          memberId: req.user!.memberId,
        },
      },
      update: {},
      create: {
        wishlistItemId: item.id,
        memberId: req.user!.memberId,
      },
    });
  }

  // Return refreshed sanitized item
  const updated = await prisma.wishlistItem.findUnique({
    where: { id: item.id },
    include: {
      reservedBy: { select: { id: true, name: true } },
      groupGiftSelectedBy: { select: { id: true, name: true } },
      groupGiftParticipants: {
        orderBy: { createdAt: 'asc' },
        include: {
          member: { select: { id: true, name: true, avatarEmoji: true, avatarColor: true } },
        },
      },
    },
  });

  const participants = updated!.groupGiftParticipants.map((p) => p.member);
  res.json({
    item: {
      id: updated!.id,
      ownerId: updated!.ownerId,
      title: updated!.title,
      description: updated!.description,
      url: updated!.url,
      imageUrl: updated!.imageUrl,
      estimatedPrice: updated!.estimatedPrice,
      priority: updated!.priority,
      isReserved: Boolean(updated!.reservedById),
      reservedByMe: updated!.reservedById === req.user!.memberId,
      reservedByName: updated!.reservedBy?.name ?? null,
      reservedNote: updated!.reservedNote,
      isGroupGift: updated!.isGroupGift,
      groupGiftNote: updated!.groupGiftNote,
      groupGiftSelectedByName: updated!.groupGiftSelectedBy?.name ?? null,
      groupGiftParticipants: participants,
      joinedGroupGift: participants.some((p) => p.id === req.user!.memberId),
    },
  });
});

// Join or leave an active group gift (secret from owner!)
router.post('/:memberId/wishlist/:itemId/group-gift/join', async (req: AuthedRequest, res) => {
  if (req.params.memberId === req.user!.memberId) {
    res.status(403).json({ error: '¡Shh! No puedes sumarte a tu propio regalo sorpresa.' });
    return;
  }

  const item = await prisma.wishlistItem.findFirst({
    where: {
      id: req.params.itemId,
      ownerId: req.params.memberId,
      owner: { spaceId: req.user!.spaceId },
    },
  });

  if (!item || !item.isGroupGift) {
    res.status(404).json({ error: 'Este regalo no está activo como regalo grupal.' });
    return;
  }

  const existing = await prisma.groupGiftParticipant.findUnique({
    where: {
      wishlistItemId_memberId: {
        wishlistItemId: item.id,
        memberId: req.user!.memberId,
      },
    },
  });

  if (existing) {
    await prisma.groupGiftParticipant.delete({ where: { id: existing.id } });
  } else {
    await prisma.groupGiftParticipant.create({
      data: {
        wishlistItemId: item.id,
        memberId: req.user!.memberId,
      },
    });
  }

  const updated = await prisma.wishlistItem.findUnique({
    where: { id: item.id },
    include: {
      groupGiftSelectedBy: { select: { id: true, name: true } },
      groupGiftParticipants: {
        orderBy: { createdAt: 'asc' },
        include: {
          member: { select: { id: true, name: true, avatarEmoji: true, avatarColor: true } },
        },
      },
    },
  });

  const participants = updated!.groupGiftParticipants.map((p) => p.member);
  res.json({
    item: {
      id: updated!.id,
      ownerId: updated!.ownerId,
      title: updated!.title,
      description: updated!.description,
      url: updated!.url,
      imageUrl: updated!.imageUrl,
      estimatedPrice: updated!.estimatedPrice,
      priority: updated!.priority,
      isReserved: false,
      reservedByMe: false,
      reservedByName: null,
      reservedNote: '',
      isGroupGift: updated!.isGroupGift,
      groupGiftNote: updated!.groupGiftNote,
      groupGiftSelectedByName: updated!.groupGiftSelectedBy?.name ?? null,
      groupGiftParticipants: participants,
      joinedGroupGift: participants.some((p) => p.id === req.user!.memberId),
    },
  });
});

// ================= MODO SORPRESA (Muro Oculto) =================
router.get('/:memberId/surprise', async (req: AuthedRequest, res) => {
  if (req.params.memberId === req.user!.memberId) {
    res.status(403).json({
      error: '¡Shh! El Modo Sorpresa es secreto y no está disponible en tu propio perfil.',
    });
    return;
  }

  const target = await prisma.member.findFirst({
    where: { id: req.params.memberId, spaceId: req.user!.spaceId },
    select: { id: true, name: true, avatarEmoji: true, birthDate: true },
  });

  if (!target) {
    res.status(404).json({ error: 'Compañero no encontrado.' });
    return;
  }

  const messages = await prisma.surpriseMessage.findMany({
    where: { targetMemberId: target.id },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, name: true, avatarEmoji: true, avatarColor: true, avatarImageUrl: true } },
    },
  });

  res.json({ target, messages });
});

router.post('/:memberId/surprise', async (req: AuthedRequest, res) => {
  if (req.params.memberId === req.user!.memberId) {
    res.status(403).json({
      error: '¡Shh! No puedes escribir en tu propio muro sorpresa.',
    });
    return;
  }

  const schema = z.object({
    message: z.string().min(1, 'Escribe un mensaje o idea'),
    isIdea: z.boolean().optional().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Mensaje inválido' });
    return;
  }

  const target = await prisma.member.findFirst({
    where: { id: req.params.memberId, spaceId: req.user!.spaceId },
    select: { id: true },
  });
  if (!target) {
    res.status(404).json({ error: 'Compañero no encontrado.' });
    return;
  }

  const created = await prisma.surpriseMessage.create({
    data: {
      targetMemberId: target.id,
      authorId: req.user!.memberId,
      message: parsed.data.message.trim(),
      isIdea: parsed.data.isIdea,
    },
    include: {
      author: { select: { id: true, name: true, avatarEmoji: true, avatarColor: true, avatarImageUrl: true } },
    },
  });

  res.status(201).json({ message: created });
});

export default router;

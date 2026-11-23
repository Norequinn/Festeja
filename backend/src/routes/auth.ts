import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  AuthedRequest,
  buildMagicLinks,
  generateInviteCode,
  requireAuth,
  signToken,
} from '../lib/auth';

const router = Router();

function isDemoModeEnabled(): boolean {
  return process.env.ENABLE_DEMO_MODE === 'true';
}

router.get('/config', (_req, res) => {
  res.json({ demoMode: isDemoModeEnabled() });
});

const AVATAR_COLORS = ['#FF5A5F', '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#0EA5E9', '#8B5CF6'];

function pickColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const createSpaceSchema = z.object({
  spaceName: z.string().min(2, 'El nombre de la empresa o equipo es requerido'),
  description: z.string().optional().default(''),
  customInviteCode: z.string().optional(),
  reminderDaysBefore: z.number().int().min(1).max(30).optional().default(7),
  currency: z.string().min(1).max(8).optional().default('USD'),
  adminName: z.string().min(2, 'Tu nombre es requerido'),
  adminEmail: z.string().email('Correo electrónico inválido'),
  pin: z.string().min(4, 'El PIN debe tener al menos 4 caracteres'),
  jobTitle: z.string().optional().default('Administrador'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha YYYY-MM-DD'),
  avatarEmoji: z.string().optional().default('👑'),
});

const joinSpaceSchema = z.object({
  inviteCode: z.string().min(3, 'Código de invitación requerido'),
  name: z.string().min(2, 'Tu nombre es requerido'),
  email: z.string().email('Correo electrónico inválido'),
  pin: z.string().min(4, 'El PIN debe tener al menos 4 caracteres'),
  jobTitle: z.string().optional().default(''),
  department: z.string().optional().default(''),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha YYYY-MM-DD'),
  workAnniversary: z.string().optional().nullable(),
  shirtSize: z.string().optional().default(''),
  favoriteColors: z.string().optional().default(''),
  allergies: z.string().optional().default(''),
  favoriteTreats: z.string().optional().default(''),
  avatarEmoji: z.string().optional().default('🎉'),
});

const loginSchema = z.object({
  inviteCode: z.string().min(3),
  email: z.string().email(),
  pin: z.string().min(1),
});

router.post('/create-space', async (req, res) => {
  const parsed = createSpaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    return;
  }

  const data = parsed.data;
  const normalizedEmail = data.adminEmail.trim().toLowerCase();

  let inviteCode = data.customInviteCode
    ? data.customInviteCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
    : generateInviteCode(data.spaceName);

  // Ensure uniqueness
  let attempts = 0;
  while (await prisma.space.findUnique({ where: { inviteCode } })) {
    if (data.customInviteCode && attempts === 0) {
      res.status(409).json({ error: `El código ${inviteCode} ya está en uso. Prueba con otro.` });
      return;
    }
    inviteCode = generateInviteCode(data.spaceName);
    attempts++;
  }

  const pinHash = await bcrypt.hash(data.pin, 8);

  const space = await prisma.space.create({
    data: {
      name: data.spaceName.trim(),
      description: data.description.trim(),
      inviteCode,
      reminderDaysBefore: data.reminderDaysBefore,
      currency: data.currency,
      members: {
        create: {
          name: data.adminName.trim(),
          email: normalizedEmail,
          pinHash,
          role: 'ADMIN',
          jobTitle: data.jobTitle.trim(),
          birthDate: data.birthDate,
          avatarEmoji: data.avatarEmoji || '👑',
          avatarColor: pickColor(data.adminName),
        },
      },
    },
    include: { members: true },
  });

  const admin = space.members[0];
  const token = signToken({ memberId: admin.id, spaceId: space.id, role: admin.role });

  res.status(201).json({
    token,
    space: {
      id: space.id,
      name: space.name,
      description: space.description,
      inviteCode: space.inviteCode,
      reminderDaysBefore: space.reminderDaysBefore,
      currency: space.currency,
      accentColor: space.accentColor,
      magicLinks: buildMagicLinks(space.inviteCode),
    },
    member: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      jobTitle: admin.jobTitle,
      birthDate: admin.birthDate,
      avatarEmoji: admin.avatarEmoji,
      avatarColor: admin.avatarColor,
    },
  });
});

router.get('/space-preview/:code', async (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const space = await prisma.space.findUnique({
    where: { inviteCode: code },
    include: { _count: { select: { members: true, events: true } } },
  });

  if (!space) {
    res.status(404).json({ error: 'No encontramos un espacio con ese código de invitación.' });
    return;
  }

  res.json({
    id: space.id,
    name: space.name,
    description: space.description,
    inviteCode: space.inviteCode,
    memberCount: space._count.members,
    eventCount: space._count.events,
  });
});

router.post('/join', async (req, res) => {
  const parsed = joinSpaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    return;
  }

  const data = parsed.data;
  const code = data.inviteCode.trim().toUpperCase();
  const normalizedEmail = data.email.trim().toLowerCase();

  const space = await prisma.space.findUnique({ where: { inviteCode: code } });
  if (!space) {
    res.status(404).json({ error: 'Código de invitación inválido. Verifica con tu administrador.' });
    return;
  }

  const existing = await prisma.member.findUnique({
    where: { spaceId_email: { spaceId: space.id, email: normalizedEmail } },
  });
  if (existing) {
    res.status(409).json({
      error: 'Ya existe un perfil con ese correo en este espacio. Usa "Iniciar sesión".',
    });
    return;
  }

  const pinHash = await bcrypt.hash(data.pin, 8);
  const member = await prisma.member.create({
    data: {
      spaceId: space.id,
      name: data.name.trim(),
      email: normalizedEmail,
      pinHash,
      role: 'MEMBER',
      jobTitle: data.jobTitle.trim(),
      department: data.department.trim(),
      birthDate: data.birthDate,
      workAnniversary: data.workAnniversary || null,
      shirtSize: data.shirtSize.trim(),
      favoriteColors: data.favoriteColors.trim(),
      allergies: data.allergies.trim(),
      favoriteTreats: data.favoriteTreats.trim(),
      avatarEmoji: data.avatarEmoji || '🎉',
      avatarColor: pickColor(data.name),
    },
  });

  const token = signToken({ memberId: member.id, spaceId: space.id, role: member.role });
  res.status(201).json({
    token,
    space: {
      id: space.id,
      name: space.name,
      description: space.description,
      inviteCode: space.inviteCode,
      reminderDaysBefore: space.reminderDaysBefore,
      currency: space.currency,
      accentColor: space.accentColor,
      magicLinks: buildMagicLinks(space.inviteCode),
    },
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      jobTitle: member.jobTitle,
      birthDate: member.birthDate,
      avatarEmoji: member.avatarEmoji,
      avatarColor: member.avatarColor,
      avatarImageUrl: member.avatarImageUrl,
    },
  });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Completa el código de espacio, correo y PIN.' });
    return;
  }

  const code = parsed.data.inviteCode.trim().toUpperCase();
  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  const space = await prisma.space.findUnique({ where: { inviteCode: code } });
  if (!space) {
    res.status(404).json({ error: 'Espacio no encontrado con ese código.' });
    return;
  }

  const member = await prisma.member.findUnique({
    where: { spaceId_email: { spaceId: space.id, email: normalizedEmail } },
  });
  if (!member) {
    res.status(401).json({ error: 'Correo o PIN incorrectos.' });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.pin, member.pinHash);
  if (!valid) {
    res.status(401).json({ error: 'Correo o PIN incorrectos.' });
    return;
  }

  const token = signToken({ memberId: member.id, spaceId: space.id, role: member.role });
  res.json({
    token,
    space: {
      id: space.id,
      name: space.name,
      description: space.description,
      inviteCode: space.inviteCode,
      reminderDaysBefore: space.reminderDaysBefore,
      currency: space.currency,
      accentColor: space.accentColor,
      magicLinks: buildMagicLinks(space.inviteCode),
    },
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      jobTitle: member.jobTitle,
      birthDate: member.birthDate,
      avatarEmoji: member.avatarEmoji,
      avatarColor: member.avatarColor,
      avatarImageUrl: member.avatarImageUrl,
    },
  });
});

/**
 * Demo login / quick persona switcher for the seeded "Vepagos" space
 * Makes it effortless to experience Admin vs Member vs Birthday Person privacy!
 */
router.post('/demo', async (req, res) => {
  if (!isDemoModeEnabled()) {
    res.status(403).json({ error: 'El modo demo está desactivado en producción.' });
    return;
  }
  const { email } = req.body as { email?: string };
  const space = await prisma.space.findUnique({
    where: { inviteCode: 'VEP-2026' },
    include: { members: { orderBy: { createdAt: 'asc' } } },
  });

  if (!space || space.members.length === 0) {
    res.status(404).json({ error: 'Espacio demo no encontrado. Ejecuta npm run db:seed.' });
    return;
  }

  const member =
    (email
      ? space.members.find((m) => m.email.toLowerCase() === email.toLowerCase())
      : space.members.find((m) => m.role === 'ADMIN')) || space.members[0];

  const token = signToken({ memberId: member.id, spaceId: space.id, role: member.role });
  res.json({
    token,
    space: {
      id: space.id,
      name: space.name,
      description: space.description,
      inviteCode: space.inviteCode,
      reminderDaysBefore: space.reminderDaysBefore,
      currency: space.currency,
      accentColor: space.accentColor,
      magicLinks: buildMagicLinks(space.inviteCode),
    },
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      jobTitle: member.jobTitle,
      birthDate: member.birthDate,
      avatarEmoji: member.avatarEmoji,
      avatarColor: member.avatarColor,
      avatarImageUrl: member.avatarImageUrl,
    },
  });
});

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const member = await prisma.member.findUnique({
    where: { id: req.user!.memberId },
    include: { space: true },
  });

  if (!member) {
    res.status(404).json({ error: 'Perfil no encontrado' });
    return;
  }

  const { pinHash: _ignored, space, ...safeMember } = member;
  res.json({
    member: safeMember,
    space: {
      ...space,
      magicLinks: buildMagicLinks(space.inviteCode),
    },
  });
});

export default router;

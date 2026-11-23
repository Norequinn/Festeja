import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthedRequest, requireAuth } from '../lib/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthedRequest, res) => {
  const messages = await prisma.chatMessage.findMany({
    where: { spaceId: req.user!.spaceId },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: {
      author: {
        select: {
          id: true,
          name: true,
          role: true,
          avatarEmoji: true,
          avatarColor: true,
          avatarImageUrl: true,
        },
      },
    },
  });

  res.json({ messages });
});

router.post('/', async (req: AuthedRequest, res) => {
  const schema = z.object({
    text: z.string().optional().default(''),
    imageUrl: z.string().optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Mensaje inválido.' });
    return;
  }

  const text = parsed.data.text.trim();
  const imageUrl = parsed.data.imageUrl.trim();
  if (!text && !imageUrl) {
    res.status(400).json({ error: 'Escribe un mensaje o adjunta una imagen.' });
    return;
  }

  const message = await prisma.chatMessage.create({
    data: {
      spaceId: req.user!.spaceId,
      authorId: req.user!.memberId,
      text,
      imageUrl,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          role: true,
          avatarEmoji: true,
          avatarColor: true,
          avatarImageUrl: true,
        },
      },
    },
  });

  res.status(201).json({ message });
});

router.delete('/:messageId', async (req: AuthedRequest, res) => {
  const existing = await prisma.chatMessage.findFirst({
    where: { id: req.params.messageId, spaceId: req.user!.spaceId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Mensaje no encontrado.' });
    return;
  }
  if (existing.authorId !== req.user!.memberId && req.user!.role !== 'ADMIN') {
    res.status(403).json({ error: 'No puedes eliminar este mensaje.' });
    return;
  }

  await prisma.chatMessage.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

export default router;

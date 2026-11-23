import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'festeja-local-dev-secret-2026';

export interface AuthPayload {
  memberId: string;
  spaceId: string;
  role: string;
}

export interface AuthedRequest extends Request<Record<string, string>> {
  user?: AuthPayload;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sesión no iniciada. Falta token de acceso.' });
    return;
  }

  try {
    const token = header.slice('Bearer '.length).trim();
    const payload = verifyToken(token);
    // Verify member still exists and get latest role
    const member = await prisma.member.findUnique({
      where: { id: payload.memberId },
      select: { id: true, spaceId: true, role: true },
    });

    if (!member) {
      res.status(401).json({ error: 'Tu sesión expiró o el perfil ya no existe.' });
      return;
    }

    req.user = {
      memberId: member.id,
      spaceId: member.spaceId,
      role: member.role,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Solo los administradores del espacio pueden realizar esta acción.' });
    return;
  }
  next();
}

export function generateInviteCode(spaceName: string): string {
  const cleaned = spaceName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  const prefix = (cleaned.slice(0, 3) || 'OFI').padEnd(3, 'X');
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${suffix}`;
}

export function buildMagicLinks(inviteCode: string) {
  return {
    inviteCode,
    appLink: `festeja://join/${inviteCode}`,
    webLink: `http://localhost:8081/?join=${inviteCode}`,
    whatsappText: `🎉 ¡Únete a nuestro espacio de celebraciones en Festeja!\n\nCódigo de acceso: ${inviteCode}\nEnlace rápido: http://localhost:8081/?join=${inviteCode}\n\nCrea tu perfil, agrega tu wishlist y celebremos juntos 🎂🎁`,
  };
}

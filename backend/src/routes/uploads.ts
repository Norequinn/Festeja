import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AuthedRequest, requireAuth } from '../lib/auth';

const router = Router();
router.use(requireAuth);

export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

async function uploadToSupabaseStorage(
  filename: string,
  buffer: Buffer,
  mime: string
): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'festeja-uploads';

  if (!supabaseUrl || !serviceKey) return null;

  const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${filename}`;
  const response = await fetch(uploadEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': mime,
      'x-upsert': 'true',
    },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Error subiendo imagen a Supabase Storage (${response.status}): ${errText}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${filename}`;
}

router.post('/', async (req: AuthedRequest, res) => {
  const { dataUrl } = req.body as { dataUrl?: string };
  if (!dataUrl || typeof dataUrl !== 'string') {
    res.status(400).json({ error: 'Imagen requerida.' });
    return;
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: 'Formato de imagen inválido.' });
    return;
  }

  const mime = match[1].toLowerCase();
  const ext = MIME_TO_EXT[mime] || 'jpg';
  const buffer = Buffer.from(match[2], 'base64');

  if (buffer.length > 6 * 1024 * 1024) {
    res.status(413).json({ error: 'La imagen es demasiado grande (máximo 6MB).' });
    return;
  }

  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;

  try {
    // Production: upload to Supabase Storage if configured
    const publicUrl = await uploadToSupabaseStorage(filename, buffer, mime);
    if (publicUrl) {
      res.status(201).json({ url: publicUrl });
      return;
    }

    // Local development fallback: save to backend/uploads/
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    const fullPath = path.join(UPLOADS_DIR, filename);
    await fs.writeFile(fullPath, buffer);
    res.status(201).json({ url: `/uploads/${filename}` });
  } catch (err: any) {
    console.error('[Upload Error]', err);
    res.status(500).json({ error: err.message || 'No se pudo guardar la imagen.' });
  }
});

export default router;

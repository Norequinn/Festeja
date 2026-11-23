# 🚀 Guía de Despliegue a Producción — Festeja (Supabase + Render)

Tu proyecto de **Supabase (`Festeja`)** ya está **creado y configurado** (18 tablas en PostgreSQL con RLS activo, índices de rendimiento y bucket público `festeja-uploads` para imágenes).

- **Proyecto Supabase:** `Festeja` (`grkmilhqaptsqrcahgap`, región `us-east-1`)
- **URL de Supabase (ya configurada en `render.yaml`):** `https://grkmilhqaptsqrcahgap.supabase.co`

---

## Paso 1: Copiar tus 2 credenciales secretas de Supabase (1 minuto)

1. **`DATABASE_URL` (PostgreSQL Session Pooler):**
   - Entra a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard/project/grkmilhqaptsqrcahgap) → botón **Connect** (arriba) → pestaña **Connection String** → elige **Session pooler** (puerto `5432`).
   - Copia la URL y reemplaza `[YOUR-PASSWORD]` por la contraseña de base de datos de tu proyecto (si no la recuerdas, puedes definir una en [Database Settings](https://supabase.com/dashboard/project/grkmilhqaptsqrcahgap/settings/database)).
2. **`SUPABASE_SERVICE_ROLE_KEY` (para subir imágenes a Storage):**
   - Entra a [API Keys en tu proyecto](https://supabase.com/dashboard/project/grkmilhqaptsqrcahgap/settings/api-keys) y copia la clave `service_role` (o `Secret key`).

---

## Paso 2: Subir el proyecto a GitHub (2 minutos)

Desde tu terminal en `/Users/nicklaus/.gemini/antigravity/scratch/Festeja`:

```bash
git init
git add .
git commit -m "feat: Festeja produccion (PWA + Supabase PostgreSQL + Storage)"
```

Crea un repositorio nuevo en GitHub (puede ser **privado**) y súbelo:
```bash
git branch -M main
git remote add origin https://github.com/TU_USUARIO/festeja.git
git push -u origin main
```

---

## Paso 3: Desplegar en Render — Plan Gratuito (5 minutos)

1. Entra a [https://render.com](https://render.com) e inicia sesión con GitHub.
2. Haz clic en **New + → Blueprint** y selecciona tu repositorio `festeja` (Render leerá automáticamente `render.yaml` y `Dockerfile`).
3. Render solo te pedirá pegar las **2 variables secretas** del Paso 1:
   - `DATABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   *(Todo lo demás — `SUPABASE_URL`, `SUPABASE_STORAGE_BUCKET=festeja-uploads`, `ENABLE_DEMO_MODE=false`, `JWT_SECRET` — ya viene preconfigurado en `render.yaml`.)*
4. Haz clic en **Apply** y espera ~3–5 minutos a que construya y arranque.

---

## Paso 4: ¡A celebrar con tu equipo!

1. Abre tu URL permanente HTTPS de Render (ej. `https://festeja.onrender.com`, o conéctale tu dominio en **Settings → Custom Domains**).
2. Toca **Crear Espacio** para registrar el espacio real de tu empresa con tu perfil de **Administrador**.
3. Comparte el enlace mágico en el WhatsApp de la oficina para que cada compañero cree su perfil e instale **Festeja** en su teléfono.

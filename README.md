# 🎉 Festeja — Celebraciones de Equipo (App Móvil + API Local)

Aplicación multiplataforma (**React Native + Expo** para iOS, Android y Web) con backend local en **Node.js + Express + Prisma + SQLite** diseñada para gestionar cumpleaños, aniversarios laborales, wishlists con reserva secreta, votaciones de temáticas, checklists colaborativos, cuotas, Amigo Secreto y **Modo Sorpresa**.

## Arquitectura del Proyecto

```text
Festeja/
├── backend/                # API REST + Prisma ORM + SQLite (puerto 4000)
│   ├── prisma/
│   │   ├── schema.prisma   # Modelos: Space, Member, WishlistItem, Event, ThemeOption, ThemeVote, ChecklistItem, EventContribution, SecretSantaAssignment, SurpriseMessage, CelebrationPost
│   │   └── seed.ts         # Espacio demo "Vepagos" (código VEP-2026)
│   └── src/
│       ├── routes/         # auth, spaces, members, events
│       ├── lib/            # prisma, jwt auth, date calculations
│       └── tests/          # Tests de integración end-to-end
└── mobile/                 # App móvil React Native / Expo (iOS, Android y Web)
    ├── App.tsx             # Navegación, sesión persistente y deep links (?join=CODE / festeja://join/CODE)
    └── src/
        ├── api.ts          # Cliente HTTP tipado
        ├── theme.ts        # Paleta festiva y formateadores de fechas
        ├── components/     # Componentes UI reutilizables
        └── screens/        # Onboarding, Inicio/Muro, Calendario, Eventos, Equipo, Perfil/Wishlist/Modo Sorpresa
```

## Cómo ejecutarlo localmente

### 1. Iniciar el Backend (SQLite + Prisma)
```bash
cd backend
npm run dev
```
El servidor quedará escuchando en `http://localhost:4000`.
> La base de datos local `backend/prisma/dev.db` ya está inicializada y precargada con el espacio demo **Vepagos** (`VEP-2026`). Si deseas reiniciarla en cualquier momento: `npm --prefix backend run db:reset`.

### 2. Iniciar la App Móvil (Expo)
En otra terminal:
```bash
cd mobile
# Abrir en navegador (preview instantáneo)
npm run web

# O abrir Expo Go / Emulador Android / Simulador iOS
npm run start
```
> Si pruebas desde un teléfono físico con Expo Go en la misma red Wi-Fi, define tu IP local antes de iniciar Expo:
> `EXPO_PUBLIC_API_URL=http://<TU_IP_LOCAL>:4000/api npm run start`

## Datos Demo Precargados (`VEP-2026`)
- **Espacio**: Vepagos · Código: `VEP-2026` · PIN universal demo: `1234`
- **Camila Rojas** (`camila@vepagos.com`) — **Admin**
- **Mateo Silva** (`mateo@vepagos.com`) — **Miembro** (¡cumple en 3 días! Tiene regalos reservados en secreto y un chat activo en **Modo Sorpresa** que desaparece automáticamente al entrar con su perfil)
- **Sofía Mendoza** (`sofia@vepagos.com`) — **Miembro** (cumple en 6 días)
- **Diego Herrera** (`diego@vepagos.com`) — **Miembro** (aniversario laboral en 2 días)
- **Valeria Cruz** (`valeria@vepagos.com`) — **Miembro**

## Tests automatizados del Backend
```bash
npm run test:backend
```
Valida la creación de espacios, invitaciones por código, **privacidad de reserva secreta en Wishlist**, bloqueo `403` del **Modo Sorpresa** para el cumpleañero, votación de temáticas, checklist, cuotas y sorteo de Amigo Secreto.

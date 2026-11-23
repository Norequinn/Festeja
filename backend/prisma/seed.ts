import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { addDaysYMD, todayStart } from '../src/lib/dates';

const prisma = new PrismaClient();

function birthDateInDays(daysFromToday: number, birthYear: number): string {
  const target = addDaysYMD(daysFromToday, todayStart());
  const [, m, d] = target.split('-');
  return `${birthYear}-${m}-${d}`;
}

async function seed() {
  console.log('🌱 Cargando datos demo de "Vepagos" (VEP-2026)...');

  // Clear existing demo space if re-running seed
  await prisma.space.deleteMany({ where: { inviteCode: 'VEP-2026' } });

  const pinHash = await bcrypt.hash('1234', 8);

  const space = await prisma.space.create({
    data: {
      name: 'Vepagos',
      description: 'Oficina principal · Celebraciones, cumpleaños, intercambios y momentos en equipo 🎉',
      inviteCode: 'VEP-2026',
      reminderDaysBefore: 7,
      currency: 'USD',
      accentColor: '#FF5A5F',
    },
  });

  // Create 5 realistic team members with upcoming birthdays relative to today
  const [camila, mateo, sofia, diego, valeria] = await Promise.all([
    prisma.member.create({
      data: {
        spaceId: space.id,
        name: 'Camila Rojas',
        email: 'camila@vepagos.com',
        pinHash,
        role: 'ADMIN',
        jobTitle: 'People & Culture Lead',
        department: 'Talento Humano',
        avatarEmoji: '👑',
        avatarColor: '#FF5A5F',
        birthDate: birthDateInDays(24, 1994),
        workAnniversary: birthDateInDays(5, 2022),
        shirtSize: 'S',
        shoeSize: '37',
        favoriteColors: 'Terracota, Beige, Verde oliva',
        allergies: 'Ninguna',
        favoriteTreats: 'Tiramisú, café frío, chocolates oscuros',
        hobbiesNotes: 'Amante del café de especialidad, cerámica y playlists indie.',
      },
    }),
    prisma.member.create({
      data: {
        spaceId: space.id,
        name: 'Mateo Silva',
        email: 'mateo@vepagos.com',
        pinHash,
        role: 'MEMBER',
        jobTitle: 'Senior Backend Dev',
        department: 'Ingeniería',
        avatarEmoji: '🚀',
        avatarColor: '#6366F1',
        birthDate: birthDateInDays(3, 1995), // ¡En 3 días! Dispara alerta inmediata
        workAnniversary: birthDateInDays(42, 2023),
        shirtSize: 'L',
        shoeSize: '42',
        favoriteColors: 'Azul marino, Negro, Verde bosque',
        allergies: 'Maní y nueces (¡cuidado con las tortas!)',
        favoriteTreats: 'Tres leches, gomitas ácidas, matcha',
        hobbiesNotes: 'Teclados mecánicos, videojuegos retro y correr los domingos.',
      },
    }),
    prisma.member.create({
      data: {
        spaceId: space.id,
        name: 'Sofía Mendoza',
        email: 'sofia@vepagos.com',
        pinHash,
        role: 'MEMBER',
        jobTitle: 'Product Designer',
        department: 'Diseño',
        avatarEmoji: '🎨',
        avatarColor: '#EC4899',
        birthDate: birthDateInDays(6, 1996), // En 6 días! También en alerta
        workAnniversary: birthDateInDays(18, 2024),
        shirtSize: 'M',
        shoeSize: '38',
        favoriteColors: 'Lavanda, Coral, Amarillo pastel',
        allergies: 'Intolerante a la lactosa',
        favoriteTreats: 'Macarons, brownie vegano, té chai',
        hobbiesNotes: 'Fotografía analógica, plantas de interior y papelería bonita.',
      },
    }),
    prisma.member.create({
      data: {
        spaceId: space.id,
        name: 'Diego Herrera',
        email: 'diego@vepagos.com',
        pinHash,
        role: 'MEMBER',
        jobTitle: 'Growth & Operaciones',
        department: 'Operaciones',
        avatarEmoji: '⚡',
        avatarColor: '#10B981',
        birthDate: birthDateInDays(15, 1992),
        workAnniversary: birthDateInDays(2, 2021), // Aniversario en 2 días
        shirtSize: 'M',
        shoeSize: '41',
        favoriteColors: 'Gris grafito, Blanco, Naranja',
        allergies: 'Mariscos',
        favoriteTreats: 'Pie de limón, alfajores, cold brew',
        hobbiesNotes: 'Pádel, asados de fin de semana y podcasts de negocios.',
      },
    }),
    prisma.member.create({
      data: {
        spaceId: space.id,
        name: 'Valeria Cruz',
        email: 'valeria@vepagos.com',
        pinHash,
        role: 'MEMBER',
        jobTitle: 'Mobile Engineer',
        department: 'Ingeniería',
        avatarEmoji: '🌟',
        avatarColor: '#F59E0B',
        birthDate: birthDateInDays(34, 1997),
        workAnniversary: birthDateInDays(75, 2024),
        shirtSize: 'S',
        shoeSize: '36',
        favoriteColors: 'Celeste, Lila, Blanco',
        allergies: 'Ninguna',
        favoriteTreats: 'Cheesecake de frutos rojos, galletas con chispas',
        hobbiesNotes: 'Senderismo, lectura de ciencia ficción y termos bonitos.',
      },
    }),
  ]);

  // Wishlists (including a secret GROUP GIFT on Mateo's list & secret reservation on Sofia's list!)
  const mateoGroupGift = await prisma.wishlistItem.create({
    data: {
      ownerId: mateo.id,
      title: 'Termo Stanley Quencher 40oz Azul',
      description: 'Color azul marino o negro para llevar al escritorio.',
      url: 'https://www.stanley1913.com',
      estimatedPrice: '$45',
      priority: 'HIGH',
      isGroupGift: true,
      groupGiftNote: 'Regalo grupal de la oficina · ¡Súmate!',
      groupGiftSelectedById: camila.id,
      groupGiftParticipants: {
        create: [{ memberId: camila.id }, { memberId: diego.id }, { memberId: valeria.id }],
      },
    },
  });

  await prisma.wishlistItem.createMany({
    data: [
      {
        ownerId: mateo.id,
        title: 'Keycaps PBT Retro Nintendo',
        description: 'Set de teclas perfil Cherry para teclado mecánico 75%.',
        url: 'https://www.amazon.com/s?k=retro+pbt+keycaps',
        estimatedPrice: '$35',
        priority: 'HIGH',
        reservedById: camila.id,
        reservedAt: new Date(),
        reservedNote: 'Regalo personal aparte',
      },
      {
        ownerId: mateo.id,
        title: 'Libro: Designing Data-Intensive Applications',
        description: 'Edición física tapa blanda.',
        estimatedPrice: '$40',
        priority: 'LOW',
      },
      {
        ownerId: sofia.id,
        title: 'Rollo fotográfico Kodak Gold 200 (Pack x3)',
        description: '35mm para mi cámara analógica.',
        estimatedPrice: '$28',
        priority: 'HIGH',
        reservedById: valeria.id,
        reservedAt: new Date(),
        reservedNote: 'Ya lo pedí online',
      },
      {
        ownerId: sofia.id,
        title: 'Maceta cerámica minimalista color lavanda',
        description: 'Mediana con platito para suculentas.',
        estimatedPrice: '$22',
        priority: 'MEDIUM',
      },
      {
        ownerId: camila.id,
        title: 'Prensa francesa de vidrio borosilicato',
        description: 'Capacidad 600ml, ideal para café de la mañana.',
        estimatedPrice: '$30',
        priority: 'HIGH',
      },
      {
        ownerId: diego.id,
        title: 'Tubo de pelotas de pádel Head Pro S',
        description: 'Siempre hacen falta para el partido del jueves.',
        estimatedPrice: '$18',
        priority: 'MEDIUM',
      },
      {
        ownerId: valeria.id,
        title: 'Lámpara LED cálida para monitor',
        description: 'Lightbar con regulador de brillo para programar de noche.',
        estimatedPrice: '$38',
        priority: 'HIGH',
      },
    ],
  });

  // Event 1: Cumpleaños del Mes (with theme voting, checklist, quotas)
  const bdayEvent = await prisma.event.create({
    data: {
      spaceId: space.id,
      createdById: camila.id,
      title: 'Cumpleaños de Noviembre (Mateo & Sofía)',
      description: '¡Celebramos juntos a Mateo y Sofía! Recuerden: torta SIN maní y opción sin lactosa.',
      type: 'BIRTHDAY_GROUP',
      eventDate: addDaysYMD(4, todayStart()),
      eventTime: '16:30',
      location: 'Terraza Oficina Vepagos',
      quotaAmount: 10,
      budgetNote: 'Cuota de $10 por persona para tortas, snacks y bebidas',
    },
  });

  const [opt1, opt2, opt3] = await Promise.all([
    prisma.themeOption.create({
      data: {
        eventId: bdayEvent.id,
        proposedById: camila.id,
        title: 'Noche de Cine & Cotufas',
        description: 'Proyector en la terraza, crispetas, perros calientes y clásicos retro.',
        emoji: '🎬',
      },
    }),
    prisma.themeOption.create({
      data: {
        eventId: bdayEvent.id,
        proposedById: diego.id,
        title: 'Fiesta Retro 90s',
        description: 'Playlist noventera, snacks clásicos y dress code casual colorido.',
        emoji: '🕹️',
      },
    }),
    prisma.themeOption.create({
      data: {
        eventId: bdayEvent.id,
        proposedById: valeria.id,
        title: 'Desayuno Sorpresa Brunch',
        description: 'Waffles, café de especialidad, fruta fresca y mimosas sin alcohol.',
        emoji: '🥐',
      },
    }),
  ]);

  await prisma.themeVote.createMany({
    data: [
      { themeOptionId: opt1.id, memberId: camila.id },
      { themeOptionId: opt1.id, memberId: sofia.id },
      { themeOptionId: opt2.id, memberId: mateo.id },
      { themeOptionId: opt2.id, memberId: diego.id },
      { themeOptionId: opt3.id, memberId: valeria.id },
    ],
  });

  await prisma.checklistItem.createMany({
    data: [
      {
        eventId: bdayEvent.id,
        title: 'Torta Tres Leches (SIN maní/nueces)',
        category: 'Comida',
        assignedToId: camila.id,
        estimatedCost: 28,
        completed: true,
      },
      {
        eventId: bdayEvent.id,
        title: 'Postre sin lactosa para Sofía (brownie vegano)',
        category: 'Comida',
        assignedToId: valeria.id,
        estimatedCost: 14,
        completed: false,
      },
      {
        eventId: bdayEvent.id,
        title: 'Refrescos, agua con gas y hielo',
        category: 'Bebidas',
        assignedToId: diego.id,
        estimatedCost: 12,
        completed: false,
      },
      {
        eventId: bdayEvent.id,
        title: 'Globos, guirnalda y velitas mágicas',
        category: 'Decoración',
        assignedToId: null,
        estimatedCost: 10,
        completed: false,
      },
      {
        eventId: bdayEvent.id,
        title: 'Playlist colaborativa y parlante Bluetooth',
        category: 'Logística',
        assignedToId: mateo.id,
        estimatedCost: 0,
        completed: true,
      },
    ],
  });

  await prisma.eventContribution.createMany({
    data: [
      { eventId: bdayEvent.id, memberId: camila.id, amount: 10, paid: true, paidAt: new Date() },
      { eventId: bdayEvent.id, memberId: diego.id, amount: 10, paid: true, paidAt: new Date() },
      { eventId: bdayEvent.id, memberId: valeria.id, amount: 10, paid: false },
    ],
  });

  // Event 2: Amigo Secreto Navidad
  const santaEvent = await prisma.event.create({
    data: {
      spaceId: space.id,
      createdById: camila.id,
      title: 'Amigo Secreto Vepagos 2026',
      description: 'Intercambio navideño de oficina. ¡Revisa la wishlist de tu amigo secreto!',
      type: 'SECRET_SANTA',
      eventDate: addDaysYMD(25, todayStart()),
      eventTime: '18:00',
      location: 'Salón Principal + Brindis',
      selectedTheme: '🎄 Navidad Cozy & Sweaters',
      votingClosed: true,
      quotaAmount: 25,
      budgetNote: 'Tope sugerido del regalo: $25 - $35',
    },
  });

  await prisma.checklistItem.createMany({
    data: [
      {
        eventId: santaEvent.id,
        title: 'Tarjetas con pistas divertidas del Amigo Secreto',
        category: 'Decoración',
        assignedToId: sofia.id,
        estimatedCost: 5,
        completed: false,
      },
      {
        eventId: santaEvent.id,
        title: 'Ponche navideño y galletas de jengibre',
        category: 'Bebidas',
        assignedToId: null,
        estimatedCost: 20,
        completed: false,
      },
    ],
  });

  // Surprise Mode messages on Mateo's profile (hidden from Mateo!)
  await prisma.surpriseMessage.createMany({
    data: [
      {
        targetMemberId: mateo.id,
        authorId: camila.id,
        message: '¡Equipo! En 3 días cumple Mateo 🎂 Ya reservé las keycaps retro de su wishlist. ¿Quién se suma con una tarjeta firmada?',
        isIdea: true,
      },
      {
        targetMemberId: mateo.id,
        authorId: diego.id,
        message: 'Yo me apunto con la mitad de las keycaps y llevo los globos a las 4pm cuando esté en daily.',
        isIdea: false,
      },
      {
        targetMemberId: mateo.id,
        authorId: sofia.id,
        message: '¡Importante recordar que es alérgico al maní! Ya le avisé a la pastelería para que el Tres Leches sea 100% seguro.',
        isIdea: true,
      },
    ],
  });

  // Celebration Wall posts (including an interactive poll & emoji reactions!)
  const wallPost1 = await prisma.celebrationPost.create({
    data: {
      spaceId: space.id,
      authorId: camila.id,
      targetMemberId: diego.id,
      message:
        '¡En 2 días Diego cumple 5 años en Vepagos! Gracias por toda la buena energía en el equipo 🏆⚡',
      emoji: '🏆',
      likesCount: 4,
      reactions: {
        create: [
          { memberId: camila.id, emoji: '🎉' },
          { memberId: valeria.id, emoji: '🎉' },
          { memberId: sofia.id, emoji: '❤️' },
          { memberId: mateo.id, emoji: '👏' },
        ],
      },
    },
  });

  const pollPost = await prisma.celebrationPost.create({
    data: {
      spaceId: space.id,
      authorId: valeria.id,
      message: '📊 Encuesta rápida para el compartir de este viernes: ¿qué bebida prefieren?',
      emoji: '📊',
      pollOptions: {
        create: [
          { label: '☕ Café frío & té chai', order: 0 },
          { label: '🥤 Refrescos variados', order: 1 },
          { label: '🍹 Jugos naturales', order: 2 },
        ],
      },
      reactions: {
        create: [
          { memberId: diego.id, emoji: '🔥' },
          { memberId: camila.id, emoji: '❤️' },
        ],
      },
    },
    include: { pollOptions: true },
  });

  await prisma.pollVote.createMany({
    data: [
      { optionId: pollPost.pollOptions[0].id, memberId: camila.id },
      { optionId: pollPost.pollOptions[0].id, memberId: sofia.id },
      { optionId: pollPost.pollOptions[1].id, memberId: diego.id },
    ],
  });

  // Group Chat starter messages
  await prisma.chatMessage.createMany({
    data: [
      {
        spaceId: space.id,
        authorId: camila.id,
        text: '¡Hola equipo! Bienvenidos al chat grupal de Vepagos 🎉 Por aquí coordinamos todo lo de los cumples y salidas.',
      },
      {
        spaceId: space.id,
        authorId: diego.id,
        text: '¡Buenísimo! Ya subí mi pago de la colecta de noviembre en la pestaña de Pagos 💵',
      },
      {
        spaceId: space.id,
        authorId: valeria.id,
        text: 'Acabo de publicar una encuesta en el Muro para decidir las bebidas del viernes, ¡pasen a votar! 🗳️',
      },
    ],
  });
  void wallPost1;

  // Payment Schedules (Calendario de Pagos para Cumpleaños)
  const novPay = await prisma.paymentSchedule.create({
    data: {
      spaceId: space.id,
      createdById: camila.id,
      title: 'Colecta Cumpleaños de Mateo y Sofía',
      description: 'Para torta Tres Leches sin maní, brownie sin lactosa, decoración y bebidas.',
      dueDate: addDaysYMD(2, todayStart()),
      amountPerPerson: 12,
      currency: 'USD',
      status: 'OPEN',
      targetMemberId: mateo.id,
      excludeTargetMember: true,
      wishlistItemId: mateoGroupGift.id,
      buyerMemberId: camila.id,
      buyerName: 'Camila Rojas',
      paymentMethod: 'Pago Móvil',
      bankName: 'Banesco (0134)',
      accountOrPhone: '0414-555-8290',
      documentId: 'V-24.819.302',
      paymentNotes: 'Colocar "Cumple Nov" en concepto y reportar referencia aquí.',
    },
  });

  await prisma.paymentRecord.createMany({
    data: [
      {
        scheduleId: novPay.id,
        memberId: camila.id,
        amount: 12,
        status: 'CONFIRMED',
        reference: 'AUTO-ORG',
        note: 'Encargada de la compra',
        paidAt: new Date(),
      },
      {
        scheduleId: novPay.id,
        memberId: diego.id,
        amount: 12,
        status: 'CONFIRMED',
        reference: '#491820',
        note: 'Listo por Pago Móvil',
        paidAt: new Date(),
      },
      {
        scheduleId: novPay.id,
        memberId: valeria.id,
        amount: 12,
        status: 'REPORTED',
        reference: '#774120',
        note: 'Transferido esta mañana',
        paidAt: new Date(),
      },
    ],
  });

  await prisma.paymentSchedule.create({
    data: {
      spaceId: space.id,
      createdById: camila.id,
      title: 'Cuota Cumpleaños de Diego (Diciembre)',
      description: 'Reserva anticipada para asado / compartir y regalo grupal de pádel.',
      dueDate: addDaysYMD(13, todayStart()),
      amountPerPerson: 15,
      currency: 'USD',
      status: 'OPEN',
      targetMemberId: diego.id,
      excludeTargetMember: true,
      buyerMemberId: valeria.id,
      buyerName: 'Valeria Cruz',
      paymentMethod: 'Zelle',
      bankName: 'Chase Bank',
      accountOrPhone: 'valeria.pagos@vepagos.com',
      documentId: 'Titular: Valeria Cruz',
      paymentNotes: 'Enviar captura o últimos 6 dígitos de confirmación.',
    },
  });

  console.log('✅ Espacio demo "Vepagos" creado con código VEP-2026 (PIN de prueba: 1234)');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

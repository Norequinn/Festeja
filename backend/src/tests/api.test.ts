import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';

async function request(baseUrl: string, path: string, options: RequestInit = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function runTests() {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert(addr && typeof addr !== 'string');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const testCode = `TST-${Math.floor(1000 + Math.random() * 9000)}`;
  let createdSpaceId = '';

  try {
    // 1. Health check
    const health = await request(baseUrl, '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);

    // 2. Create Space (Admin)
    const createRes = await request(baseUrl, '/api/auth/create-space', {
      method: 'POST',
      body: JSON.stringify({
        spaceName: 'Oficina Test',
        customInviteCode: testCode,
        reminderDaysBefore: 5,
        adminName: 'Ana Admin',
        adminEmail: 'ana@test.com',
        pin: '1234',
        birthDate: '1993-05-15',
      }),
    });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.space.inviteCode, testCode);
    assert.equal(createRes.body.member.role, 'ADMIN');
    createdSpaceId = createRes.body.space.id;
    const adminToken = createRes.body.token;
    const adminId = createRes.body.member.id;

    // 3. Join Space with Invite Code (Member = Birthday Person)
    const joinRes = await request(baseUrl, '/api/auth/join', {
      method: 'POST',
      body: JSON.stringify({
        inviteCode: testCode,
        name: 'Luis Cumpleañero',
        email: 'luis@test.com',
        pin: '1234',
        birthDate: '1995-11-23',
        shirtSize: 'M',
        allergies: 'Nueces',
      }),
    });
    assert.equal(joinRes.status, 201);
    assert.equal(joinRes.body.member.role, 'MEMBER');
    const luisToken = joinRes.body.token;
    const luisId = joinRes.body.member.id;

    // 4. Luis adds a wishlist item
    const addWish = await request(baseUrl, '/api/members/me/wishlist', {
      method: 'POST',
      headers: { Authorization: `Bearer ${luisToken}` },
      body: JSON.stringify({
        title: 'Audífonos Bluetooth',
        estimatedPrice: '$50',
        priority: 'HIGH',
      }),
    });
    assert.equal(addWish.status, 201);
    const wishItemId = addWish.body.item.id;

    // 5. Ana (colleague) secretly reserves Luis's gift
    const reserveRes = await request(
      baseUrl,
      `/api/members/${luisId}/wishlist/${wishItemId}/reserve`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ note: 'Lo compro mañana' }),
      }
    );
    assert.equal(reserveRes.status, 200);
    assert.equal(reserveRes.body.item.isReserved, true);
    assert.equal(reserveRes.body.item.reservedByMe, true);

    // 6. CRITICAL PRIVACY CHECK: Luis views his OWN wishlist -> must NOT see reservation!
    const luisOwnProfile = await request(baseUrl, `/api/members/${luisId}`, {
      headers: { Authorization: `Bearer ${luisToken}` },
    });
    assert.equal(luisOwnProfile.status, 200);
    assert.equal(luisOwnProfile.body.member.canAccessSurpriseMode, false);
    assert.equal(luisOwnProfile.body.wishlist[0].isReserved, false);
    assert.equal(luisOwnProfile.body.wishlist[0].reservedByName, null);

    // 7. CRITICAL PRIVACY CHECK: Ana writes in Luis's Surprise Mode, Luis gets 403!
    const surprisePost = await request(baseUrl, `/api/members/${luisId}/surprise`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ message: '¡Hagamos colecta para la torta!', isIdea: true }),
    });
    assert.equal(surprisePost.status, 201);

    const luisTriesSurprise = await request(baseUrl, `/api/members/${luisId}/surprise`, {
      headers: { Authorization: `Bearer ${luisToken}` },
    });
    assert.equal(luisTriesSurprise.status, 403);

    // 8. Admin creates Event + Theme voting + Checklist + Quotas + Secret Santa
    const eventRes = await request(baseUrl, '/api/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Fiesta de Noviembre',
        type: 'SECRET_SANTA',
        eventDate: '2026-11-28',
        quotaAmount: 15,
        initialThemes: [
          { title: 'Noche de Cine', emoji: '🎬' },
          { title: 'Fiesta Retro', emoji: '🕹️' },
        ],
      }),
    });
    assert.equal(eventRes.status, 201);
    const eventId = eventRes.body.event.id;
    const themeOptId = eventRes.body.event.themeOptions[0].id;

    // Luis votes for theme
    const voteRes = await request(baseUrl, `/api/events/${eventId}/themes/${themeOptId}/vote`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${luisToken}` },
    });
    assert.equal(voteRes.status, 200);
    assert.equal(voteRes.body.event.themeOptions[0].voteCount, 1);

    // Checklist item + claim
    const checkRes = await request(baseUrl, `/api/events/${eventId}/checklist`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${luisToken}` },
      body: JSON.stringify({ title: 'Torta de chocolate', category: 'Comida', claimByMe: true }),
    });
    assert.equal(checkRes.status, 201);
    assert.equal(checkRes.body.event.checklistItems[0].assignedTo.id, luisId);

    // Quota toggle
    const contribRes = await request(
      baseUrl,
      `/api/events/${eventId}/contributions/${luisId}/toggle`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${luisToken}` },
      }
    );
    assert.equal(contribRes.status, 200);
    assert.equal(contribRes.body.event.paidCount, 1);
    assert.equal(contribRes.body.event.collectedTotal, 15);

    // Secret Santa draw -> Admin gets Luis, Luis gets Admin (never themselves!)
    const drawRes = await request(baseUrl, `/api/events/${eventId}/secret-santa/draw`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(drawRes.status, 200);
    assert.equal(drawRes.body.event.secretSantaDrawn, true);
    assert.equal(drawRes.body.event.mySecretSantaReceiver.id, luisId);
    assert.notEqual(drawRes.body.event.mySecretSantaReceiver.id, adminId);

    // 9. Payment Calendar (Admin-only creation, Member report, Admin confirmation, Calendar entry)
    const memberTriesCreatePay = await request(baseUrl, '/api/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${luisToken}` },
      body: JSON.stringify({
        title: 'No autorizado',
        dueDate: '2026-11-25',
        amountPerPerson: 10,
        buyerName: 'Luis',
      }),
    });
    assert.equal(memberTriesCreatePay.status, 403);

    const createPayRes = await request(baseUrl, '/api/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Colecta Cumpleaños Noviembre',
        dueDate: '2026-11-25',
        amountPerPerson: 12,
        buyerName: 'Ana Admin',
        paymentMethod: 'Pago Móvil',
        bankName: 'Banesco',
        accountOrPhone: '0414-000-1122',
        documentId: 'V-20.000.000',
      }),
    });
    assert.equal(createPayRes.status, 201);
    const scheduleId = createPayRes.body.schedule.id;
    assert.equal(createPayRes.body.schedule.buyerName, 'Ana Admin');

    // Member reports payment
    const reportPay = await request(baseUrl, `/api/payments/${scheduleId}/report`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${luisToken}` },
      body: JSON.stringify({ reference: 'REF-9988', note: 'Listo!' }),
    });
    assert.equal(reportPay.status, 200);
    assert.equal(reportPay.body.schedule.reportedCount, 1);

    // Admin confirms Luis's payment
    const confirmPay = await request(baseUrl, `/api/payments/${scheduleId}/records/${luisId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'CONFIRMED' }),
    });
    assert.equal(confirmPay.status, 200);
    assert.equal(confirmPay.body.schedule.confirmedCount, 1);
    assert.equal(confirmPay.body.schedule.collectedTotal, 12);

    // Appears in unified Calendar endpoint
    const calRes = await request(baseUrl, '/api/spaces/calendar?year=2026&month=11', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(calRes.status, 200);
    assert(
      calRes.body.monthEntries.some(
        (e: { kind: string; paymentScheduleId?: string }) =>
          e.kind === 'PAYMENT' && e.paymentScheduleId === scheduleId
      )
    );

    // 10. Group Gift selection from Wishlist (secret from owner!) + linked to Payment Schedule
    const groupGiftRes = await request(
      baseUrl,
      `/api/members/${luisId}/wishlist/${wishItemId}/group-gift`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ enabled: true, note: 'Entre todos para Luis!' }),
      }
    );
    assert.equal(groupGiftRes.status, 200);
    assert.equal(groupGiftRes.body.item.isGroupGift, true);
    assert.equal(groupGiftRes.body.item.groupGiftParticipants.length, 1);

    // Owner must NEVER see that their item was picked as Group Gift!
    const luisChecksOwnGift = await request(baseUrl, `/api/members/${luisId}`, {
      headers: { Authorization: `Bearer ${luisToken}` },
    });
    assert.equal(luisChecksOwnGift.body.wishlist[0].isGroupGift, false);
    assert.equal(luisChecksOwnGift.body.wishlist[0].groupGiftParticipants.length, 0);

    // Owner cannot toggle group gift on their own list
    const luisTriesGroupGift = await request(
      baseUrl,
      `/api/members/${luisId}/wishlist/${wishItemId}/group-gift`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${luisToken}` },
        body: JSON.stringify({ enabled: true }),
      }
    );
    assert.equal(luisTriesGroupGift.status, 403);

    // Link group gift to payment schedule -> hidden from Luis, visible to Ana!
    const linkPayRes = await request(baseUrl, `/api/payments/${scheduleId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ wishlistItemId: wishItemId }),
    });
    assert.equal(linkPayRes.status, 200);
    assert.equal(linkPayRes.body.schedule.groupGift.id, wishItemId);

    const luisViewsPay = await request(baseUrl, `/api/payments/${scheduleId}`, {
      headers: { Authorization: `Bearer ${luisToken}` },
    });
    assert.equal(luisViewsPay.status, 200);
    assert.equal(luisViewsPay.body.schedule.groupGift, null);

    // 11. Image upload, Wall Poll + Reactions, and Group Chat
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
    const uploadRes = await request(baseUrl, '/api/uploads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ dataUrl: tinyPng }),
    });
    assert.equal(uploadRes.status, 201);
    assert(uploadRes.body.url.startsWith('/uploads/'));

    // Wall post with poll + reaction
    const pollPostRes = await request(baseUrl, '/api/spaces/wall', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        message: '¿Qué torta quieren?',
        emoji: '🎂',
        pollOptions: ['Tres Leches', 'Chocolate'],
      }),
    });
    assert.equal(pollPostRes.status, 201);
    assert.equal(pollPostRes.body.post.pollOptions.length, 2);
    const wallPostId = pollPostRes.body.post.id;
    const optId = pollPostRes.body.post.pollOptions[0].id;

    const votePollRes = await request(
      baseUrl,
      `/api/spaces/wall/${wallPostId}/poll/${optId}/vote`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${luisToken}` },
      }
    );
    assert.equal(votePollRes.status, 200);
    assert.equal(votePollRes.body.post.totalPollVotes, 1);

    const reactRes = await request(baseUrl, `/api/spaces/wall/${wallPostId}/react`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${luisToken}` },
      body: JSON.stringify({ emoji: '🔥' }),
    });
    assert.equal(reactRes.status, 200);
    assert.equal(reactRes.body.post.reactions[0].emoji, '🔥');

    // Group Chat message
    const chatRes = await request(baseUrl, '/api/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${luisToken}` },
      body: JSON.stringify({ text: '¡Hola equipo!', imageUrl: uploadRes.body.url }),
    });
    assert.equal(chatRes.status, 201);
    assert.equal(chatRes.body.message.text, '¡Hola equipo!');

    console.log('✅ Todos los tests de integración del backend pasaron (11/11)!');
  } finally {
    if (createdSpaceId) {
      await prisma.space.delete({ where: { id: createdSpaceId } }).catch(() => {});
    }
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('❌ Test falló:', err);
  process.exit(1);
});

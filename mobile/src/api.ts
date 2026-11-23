import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import type {
  CalendarResponse,
  CelebrationPost,
  ChatMessage,
  EventDetail,
  MemberSummary,
  PaymentSchedule,
  Space,
  SurpriseMessage,
  WishlistItem,
} from './types';

function resolveBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');

  // On web:
  // - If running on Expo dev port (8081), talk to backend on port 4000 of the same host.
  // - If served directly by the backend (port 4000) or via an HTTPS tunnel (trycloudflare, etc.),
  //   use same-origin `${window.location.origin}/api` so HTTPS and uploads work seamlessly!
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    if (window.location.port === '8081') {
      return `http://${window.location.hostname}:4000/api`;
    }
    return `${window.location.origin}/api`;
  }

  // In Expo Go on a physical phone, Linking.createURL('/') gives exp://<MAC_IP>:8081/...
  try {
    const devUrl = Linking.createURL('/');
    const match = devUrl.match(/^[a-zA-Z+.-]+:\/\/([^/:]+)/);
    const host = match?.[1];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:4000/api`;
    }
  } catch {
    // fallback below
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000/api';
  }
  return 'http://localhost:4000/api';
}

export const API_BASE_URL = resolveBaseUrl();
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '');

export function resolveMediaUrl(url?: string | null): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `${API_ORIGIN}${trimmed}`;
  }
  return trimmed;
}

export function getPublicInviteUrl(inviteCode: string, fallbackUrl: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/?join=${inviteCode}`;
  }
  return fallbackUrl;
}

export function getPublicWhatsappText(spaceName: string, inviteCode: string, fallbackUrl: string): string {
  const link = getPublicInviteUrl(inviteCode, fallbackUrl);
  return `🎉 ¡Únete a "${spaceName}" en Festeja!\n\nCódigo de acceso: ${inviteCode}\nEnlace directo: ${link}\n\nCrea tu perfil, agrega tu wishlist y celebremos juntos 🎂🎁`;
}

let authToken: string | null = null;

export function setApiToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data as T;
}

export const api = {
  // Auth & Onboarding
  getAuthConfig() {
    return request<{ demoMode: boolean }>('/auth/config');
  },

  createSpace(payload: {
    spaceName: string;
    description?: string;
    customInviteCode?: string;
    reminderDaysBefore?: number;
    currency?: string;
    adminName: string;
    adminEmail: string;
    pin: string;
    jobTitle?: string;
    birthDate: string;
    avatarEmoji?: string;
  }) {
    return request<{ token: string; space: Space; member: MemberSummary }>('/auth/create-space', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  previewSpace(code: string) {
    return request<{
      id: string;
      name: string;
      description: string;
      inviteCode: string;
      memberCount: number;
      eventCount: number;
    }>(`/auth/space-preview/${encodeURIComponent(code.trim().toUpperCase())}`);
  },

  joinSpace(payload: {
    inviteCode: string;
    name: string;
    email: string;
    pin: string;
    jobTitle?: string;
    department?: string;
    birthDate: string;
    shirtSize?: string;
    favoriteColors?: string;
    allergies?: string;
    favoriteTreats?: string;
    avatarEmoji?: string;
  }) {
    return request<{ token: string; space: Space; member: MemberSummary }>('/auth/join', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload: { inviteCode: string; email: string; pin: string }) {
    return request<{ token: string; space: Space; member: MemberSummary }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  loginDemo(email?: string) {
    return request<{ token: string; space: Space; member: MemberSummary }>('/auth/demo', {
      method: 'POST',
      body: JSON.stringify(email ? { email } : {}),
    });
  },

  getMe() {
    return request<{ member: MemberSummary; space: Space }>('/auth/me');
  },

  // Space, Calendar & Wall
  updateSpace(payload: {
    name?: string;
    description?: string;
    reminderDaysBefore?: number;
    currency?: string;
  }) {
    return request<Space>('/spaces/current', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  regenerateInviteCode(customCode?: string) {
    return request<{ inviteCode: string; magicLinks: Space['magicLinks'] }>(
      '/spaces/current/regenerate-code',
      {
        method: 'POST',
        body: JSON.stringify(customCode ? { customCode } : {}),
      }
    );
  },

  getCalendar(year?: number, month?: number) {
    const qs = year && month ? `?year=${year}&month=${month}` : '';
    return request<CalendarResponse>(`/spaces/calendar${qs}`);
  },

  getWall() {
    return request<{ posts: CelebrationPost[] }>('/spaces/wall');
  },

  createWallPost(payload: {
    message: string;
    emoji?: string;
    imageUrl?: string;
    targetMemberId?: string | null;
    pollOptions?: string[];
  }) {
    return request<{ post: CelebrationPost }>('/spaces/wall', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  reactWallPost(postId: string, emoji: string) {
    return request<{ post: CelebrationPost }>(`/spaces/wall/${postId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  },

  voteWallPoll(postId: string, optionId: string) {
    return request<{ post: CelebrationPost }>(`/spaces/wall/${postId}/poll/${optionId}/vote`, {
      method: 'POST',
    });
  },

  likeWallPost(postId: string) {
    return request<{ post: CelebrationPost }>(`/spaces/wall/${postId}/like`, {
      method: 'POST',
    });
  },

  // Members, Wishlist & Surprise Mode
  getMembers() {
    return request<{ members: MemberSummary[] }>('/members');
  },

  getMemberDetail(memberId: string) {
    return request<{ member: MemberSummary; wishlist: WishlistItem[] }>(`/members/${memberId}`);
  },

  updateMyProfile(payload: Partial<MemberSummary>) {
    return request<{ member: MemberSummary }>('/members/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  updateMemberRole(memberId: string, role: 'ADMIN' | 'MEMBER') {
    return request<{ member: { id: string; name: string; role: string } }>(
      `/members/${memberId}/role`,
      {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }
    );
  },

  addWishlistItem(payload: {
    title: string;
    description?: string;
    url?: string;
    imageUrl?: string;
    estimatedPrice?: string;
    priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  }) {
    return request<{ item: WishlistItem }>('/members/me/wishlist', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteWishlistItem(itemId: string) {
    return request<{ ok: boolean }>(`/members/me/wishlist/${itemId}`, {
      method: 'DELETE',
    });
  },

  toggleReserveWishlistItem(memberId: string, itemId: string, note?: string) {
    return request<{ item: WishlistItem }>(`/members/${memberId}/wishlist/${itemId}/reserve`, {
      method: 'POST',
      body: JSON.stringify({ note: note || '' }),
    });
  },

  toggleGroupGift(
    memberId: string,
    itemId: string,
    payload: { enabled?: boolean; note?: string } = {}
  ) {
    return request<{ item: WishlistItem }>(`/members/${memberId}/wishlist/${itemId}/group-gift`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  toggleJoinGroupGift(memberId: string, itemId: string) {
    return request<{ item: WishlistItem }>(
      `/members/${memberId}/wishlist/${itemId}/group-gift/join`,
      {
        method: 'POST',
      }
    );
  },

  getSurpriseMessages(memberId: string) {
    return request<{
      target: { id: string; name: string; avatarEmoji: string; birthDate: string };
      messages: SurpriseMessage[];
    }>(`/members/${memberId}/surprise`);
  },

  postSurpriseMessage(memberId: string, payload: { message: string; isIdea?: boolean }) {
    return request<{ message: SurpriseMessage }>(`/members/${memberId}/surprise`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Events, Themes, Checklist, Quotas & Secret Santa
  getEvents() {
    return request<{ events: EventDetail[] }>('/events');
  },

  getEvent(eventId: string) {
    return request<{ event: EventDetail }>(`/events/${eventId}`);
  },

  createEvent(payload: {
    title: string;
    description?: string;
    type: EventDetail['type'];
    eventDate: string;
    eventTime?: string;
    location?: string;
    quotaAmount?: number;
    budgetNote?: string;
    initialThemes?: Array<{ title: string; description?: string; emoji?: string }>;
  }) {
    return request<{ event: EventDetail }>('/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  proposeTheme(eventId: string, payload: { title: string; description?: string; emoji?: string }) {
    return request<{ event: EventDetail }>(`/events/${eventId}/themes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  voteTheme(eventId: string, optionId: string) {
    return request<{ event: EventDetail }>(`/events/${eventId}/themes/${optionId}/vote`, {
      method: 'POST',
    });
  },

  selectWinningTheme(eventId: string, optionId: string) {
    return request<{ event: EventDetail }>(`/events/${eventId}/themes/${optionId}/select`, {
      method: 'POST',
    });
  },

  deleteThemeOption(eventId: string, optionId: string) {
    return request<{ event: EventDetail }>(`/events/${eventId}/themes/${optionId}`, {
      method: 'DELETE',
    });
  },

  addChecklistItem(
    eventId: string,
    payload: { title: string; category?: string; estimatedCost?: number; claimByMe?: boolean }
  ) {
    return request<{ event: EventDetail }>(`/events/${eventId}/checklist`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateChecklistItem(
    eventId: string,
    itemId: string,
    payload: { toggleClaim?: boolean; toggleComplete?: boolean }
  ) {
    return request<{ event: EventDetail }>(`/events/${eventId}/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteChecklistItem(eventId: string, itemId: string) {
    return request<{ event: EventDetail }>(`/events/${eventId}/checklist/${itemId}`, {
      method: 'DELETE',
    });
  },

  toggleContribution(eventId: string, memberId: string) {
    return request<{ event: EventDetail }>(
      `/events/${eventId}/contributions/${memberId}/toggle`,
      {
        method: 'POST',
      }
    );
  },

  drawSecretSanta(eventId: string) {
    return request<{ event: EventDetail }>(`/events/${eventId}/secret-santa/draw`, {
      method: 'POST',
    });
  },

  // Calendario de Pagos (Colectas para cumpleaños)
  getPayments() {
    return request<{ schedules: PaymentSchedule[] }>('/payments');
  },

  createPayment(payload: {
    title: string;
    description?: string;
    dueDate: string;
    amountPerPerson: number;
    currency?: string;
    targetMemberId?: string | null;
    excludeTargetMember?: boolean;
    wishlistItemId?: string | null;
    buyerMemberId?: string | null;
    buyerName: string;
    paymentMethod: string;
    bankName?: string;
    accountOrPhone?: string;
    documentId?: string;
    paymentNotes?: string;
  }) {
    return request<{ schedule: PaymentSchedule }>('/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updatePayment(
    scheduleId: string,
    payload: Partial<{
      title: string;
      description: string;
      dueDate: string;
      amountPerPerson: number;
      currency: string;
      status: 'OPEN' | 'CLOSED';
      targetMemberId: string | null;
      excludeTargetMember: boolean;
      wishlistItemId: string | null;
      buyerMemberId: string | null;
      buyerName: string;
      paymentMethod: string;
      bankName: string;
      accountOrPhone: string;
      documentId: string;
      paymentNotes: string;
    }>
  ) {
    return request<{ schedule: PaymentSchedule }>(`/payments/${scheduleId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deletePayment(scheduleId: string) {
    return request<{ ok: boolean }>(`/payments/${scheduleId}`, {
      method: 'DELETE',
    });
  },

  reportMyPayment(
    scheduleId: string,
    payload: { reference?: string; receiptImageUrl?: string; note?: string }
  ) {
    return request<{ schedule: PaymentSchedule }>(`/payments/${scheduleId}/report`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updatePaymentRecord(
    scheduleId: string,
    memberId: string,
    payload: { status: 'PENDING' | 'REPORTED' | 'CONFIRMED' }
  ) {
    return request<{ schedule: PaymentSchedule }>(
      `/payments/${scheduleId}/records/${memberId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
  },

  // Subida de imágenes
  uploadImage(dataUrl: string) {
    return request<{ url: string }>('/uploads', {
      method: 'POST',
      body: JSON.stringify({ dataUrl }),
    });
  },

  // Chat grupal
  getChatMessages() {
    return request<{ messages: ChatMessage[] }>('/chat');
  },

  sendChatMessage(payload: { text?: string; imageUrl?: string }) {
    return request<{ message: ChatMessage }>('/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteChatMessage(messageId: string) {
    return request<{ ok: boolean }>(`/chat/${messageId}`, {
      method: 'DELETE',
    });
  },
};

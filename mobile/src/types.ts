export interface MagicLinks {
  inviteCode: string;
  appLink: string;
  webLink: string;
  whatsappText: string;
}

export interface Space {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  reminderDaysBefore: number;
  currency: string;
  accentColor: string;
  memberCount?: number;
  eventCount?: number;
  magicLinks: MagicLinks;
}

export interface MemberSummary {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER' | string;
  jobTitle: string;
  department?: string;
  avatarEmoji: string;
  avatarColor: string;
  avatarImageUrl?: string;
  birthDate: string;
  workAnniversary?: string | null;
  shirtSize?: string;
  shoeSize?: string;
  favoriteColors?: string;
  allergies?: string;
  favoriteTreats?: string;
  hobbiesNotes?: string;
  isSelf?: boolean;
  daysUntilBirthday?: number | null;
  nextBirthdayDate?: string | null;
  daysUntilAnniversary?: number | null;
  wishlistCount?: number;
  surpriseMessagesCount?: number;
  canAccessSurpriseMode?: boolean;
}

export interface WishlistItem {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  estimatedPrice: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  isReserved: boolean;
  reservedByMe: boolean;
  reservedByName: string | null;
  reservedNote: string;
  isGroupGift: boolean;
  groupGiftNote: string;
  groupGiftSelectedByName: string | null;
  groupGiftParticipants: Array<{
    id: string;
    name: string;
    avatarEmoji: string;
    avatarColor: string;
  }>;
  joinedGroupGift: boolean;
}

export interface CalendarEntry {
  id: string;
  kind: 'BIRTHDAY' | 'ANNIVERSARY' | 'EVENT' | 'PAYMENT';
  eventType?: string;
  title: string;
  subtitle: string;
  date: string;
  dayOfMonth: number;
  month: number;
  daysUntil: number;
  isAlert: boolean;
  emoji: string;
  color: string;
  memberId?: string;
  eventId?: string;
  paymentScheduleId?: string;
  selectedTheme?: string;
}

export interface CalendarResponse {
  year: number;
  month: number;
  reminderDaysBefore: number;
  alerts: CalendarEntry[];
  upcoming: CalendarEntry[];
  monthEntries: CalendarEntry[];
}

export interface PostReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface PollOptionSummary {
  id: string;
  label: string;
  voteCount: number;
  percentage: number;
  votedByMe: boolean;
}

export interface CelebrationPost {
  id: string;
  message: string;
  emoji: string;
  imageUrl?: string;
  likesCount: number;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatarEmoji: string;
    avatarColor: string;
    avatarImageUrl?: string;
    jobTitle: string;
  };
  targetMember?: {
    id: string;
    name: string;
    avatarEmoji: string;
  } | null;
  reactions: PostReactionSummary[];
  totalPollVotes: number;
  pollOptions: PollOptionSummary[];
}

export interface ChatMessage {
  id: string;
  text: string;
  imageUrl: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    role: string;
    avatarEmoji: string;
    avatarColor: string;
    avatarImageUrl?: string;
  };
}

export interface ThemeOption {
  id: string;
  title: string;
  description: string;
  emoji: string;
  proposedByName: string;
  proposedById: string;
  voteCount: number;
  percentage: number;
  votedByMe: boolean;
}

export interface ChecklistItem {
  id: string;
  title: string;
  category: string;
  estimatedCost: number;
  completed: boolean;
  assignedTo?: {
    id: string;
    name: string;
    avatarEmoji: string;
    avatarColor: string;
  } | null;
}

export interface EventContribution {
  memberId: string;
  memberName: string;
  avatarEmoji: string;
  avatarColor: string;
  amount: number;
  paid: boolean;
  paidAt: string | null;
  note: string;
}

export interface EventDetail {
  id: string;
  title: string;
  description: string;
  type: 'BIRTHDAY_GROUP' | 'SECRET_SANTA' | 'GIFT_EXCHANGE' | 'ANNIVERSARY' | 'CELEBRATION';
  eventDate: string;
  eventTime: string;
  daysUntil: number;
  location: string;
  selectedTheme: string;
  votingClosed: boolean;
  quotaAmount: number;
  budgetNote: string;
  createdBy: { id: string; name: string; avatarEmoji: string };
  totalVotes: number;
  themeOptions: ThemeOption[];
  checklistItems: ChecklistItem[];
  checklistDoneCount: number;
  checklistTotalCount: number;
  contributions: EventContribution[];
  paidCount: number;
  totalMembers: number;
  collectedTotal: number;
  expectedTotal: number;
  secretSantaDrawn: boolean;
  mySecretSantaReceiver: {
    id: string;
    name: string;
    avatarEmoji: string;
    avatarColor: string;
    jobTitle: string;
    allergies: string;
    favoriteTreats: string;
  } | null;
}

export interface SurpriseMessage {
  id: string;
  message: string;
  isIdea: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatarEmoji: string;
    avatarColor: string;
  };
}

export interface PaymentRecord {
  memberId: string;
  memberName: string;
  avatarEmoji: string;
  avatarColor: string;
  avatarImageUrl?: string;
  amount: number;
  status: 'PENDING' | 'REPORTED' | 'CONFIRMED';
  reference: string;
  receiptImageUrl?: string;
  note: string;
  paidAt: string | null;
}

export interface PaymentSchedule {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  daysUntil: number;
  amountPerPerson: number;
  currency: string;
  status: 'OPEN' | 'CLOSED';
  targetMemberId: string | null;
  targetMember?: {
    id: string;
    name: string;
    avatarEmoji: string;
    avatarColor: string;
    birthDate: string;
  } | null;
  excludeTargetMember: boolean;
  wishlistItemId?: string | null;
  groupGift?: {
    id: string;
    ownerId: string;
    title: string;
    estimatedPrice: string;
    url: string;
    imageUrl?: string;
    description: string;
  } | null;
  buyerMemberId: string | null;
  buyerMember?: {
    id: string;
    name: string;
    avatarEmoji: string;
    avatarColor: string;
    jobTitle: string;
  } | null;
  buyerName: string;
  paymentMethod: string;
  bankName: string;
  accountOrPhone: string;
  documentId: string;
  paymentNotes: string;
  createdBy: { id: string; name: string; avatarEmoji: string };
  records: PaymentRecord[];
  myRecord: PaymentRecord | null;
  confirmedCount: number;
  reportedCount: number;
  pendingCount: number;
  totalParticipants: number;
  collectedTotal: number;
  expectedTotal: number;
  paymentSummaryText: string;
}

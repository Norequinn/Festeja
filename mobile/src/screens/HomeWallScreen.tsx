import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { api, resolveMediaUrl } from '../api';
import { ImageLightboxModal, ImagePickerField } from '../components/Pickers';
import { Avatar, Badge, Button, Card, EmptyState, Input, ModalSheet, SectionHeader } from '../components/UI';
import { FONTS, ThemeColors, useTheme, formatCountdown, formatFriendlyDate } from '../theme';
import type { CalendarEntry, CelebrationPost, MemberSummary, Space } from '../types';

interface Props {
  space: Space;
  me: MemberSummary;
  onOpenMember: (memberId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onOpenPayment: (scheduleId: string) => void;
  onOpenInviteModal: () => void;
}

const POST_EMOJIS = ['🥳', '🎂', '🏆', '🎁', '📊', '🥂', '🎉'];
const REACTION_EMOJIS = ['❤️', '🎉', '👏', '😂', '🔥'];

export function HomeWallScreen({
  space,
  me,
  onOpenMember,
  onOpenEvent,
  onOpenPayment,
  onOpenInviteModal,
}: Props) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { width } = useWindowDimensions();
  const upcomingCardWidth = Math.max(210, Math.min(250, Math.round(width * 0.72)));

  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<CalendarEntry[]>([]);
  const [upcoming, setUpcoming] = useState<CalendarEntry[]>([]);
  const [posts, setPosts] = useState<CelebrationPost[]>([]);
  const [members, setMembers] = useState<MemberSummary[]>([]);

  // Composer modal (with optional photo & poll!)
  const [composerOpen, setComposerOpen] = useState(false);
  const [postMsg, setPostMsg] = useState('');
  const [postEmoji, setPostEmoji] = useState('🥳');
  const [postImageUrl, setPostImageUrl] = useState('');
  const [postTargetId, setPostTargetId] = useState<string | null>(null);
  const [includePoll, setIncludePoll] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [posting, setPosting] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [cal, wall, team] = await Promise.all([
        api.getCalendar(),
        api.getWall(),
        api.getMembers(),
      ]);
      setAlerts(cal.alerts);
      setUpcoming(cal.upcoming);
      setPosts(wall.posts);
      setMembers(team.members);
    } catch (e) {
      console.warn('Error cargando inicio:', e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePublish() {
    if (!postMsg.trim()) return;
    setPosting(true);
    try {
      const validPoll = includePoll
        ? pollOptions.map((o) => o.trim()).filter(Boolean)
        : [];
      const { post } = await api.createWallPost({
        message: postMsg.trim(),
        emoji: includePoll && postEmoji === '🥳' ? '📊' : postEmoji,
        imageUrl: postImageUrl.trim(),
        targetMemberId: postTargetId,
        pollOptions: validPoll.length >= 2 ? validPoll : [],
      });
      setPosts((prev) => [post, ...prev]);
      setPostMsg('');
      setPostImageUrl('');
      setPostTargetId(null);
      setIncludePoll(false);
      setPollOptions(['', '']);
      setComposerOpen(false);
    } finally {
      setPosting(false);
    }
  }

  async function handleReact(postId: string, emoji: string) {
    try {
      const { post } = await api.reactWallPost(postId, emoji);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
    } catch {
      // ignore
    }
  }

  async function handleVotePoll(postId: string, optionId: string) {
    try {
      const { post } = await api.voteWallPoll(postId, optionId);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
    } catch {
      // ignore
    }
  }

  function handleEntryPress(entry: CalendarEntry) {
    if (entry.paymentScheduleId) onOpenPayment(entry.paymentScheduleId);
    else if (entry.eventId) onOpenEvent(entry.eventId);
    else if (entry.memberId) onOpenMember(entry.memberId);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Space Banner */}
      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View style={styles.heroLogoWrap}>
              <Image
                source={require('../../assets/festeja-logo.png')}
                style={styles.heroLogoImg}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroSpaceLabel}>ESPACIO DE EQUIPO</Text>
              <Text style={styles.heroSpaceName} numberOfLines={1}>
                {space.name}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onOpenInviteModal} style={styles.invitePill}>
            <Text style={styles.invitePillText}>🔗 {space.inviteCode}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroFooter}>
          <TouchableOpacity
            onPress={() => onOpenMember(me.id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
          >
            <Avatar
              emoji={me.avatarEmoji}
              color={me.avatarColor}
              imageUrl={me.avatarImageUrl}
              size={38}
            />
            <View>
              <Text style={styles.heroUserName}>Hola, {me.name.split(' ')[0]} 👋</Text>
              <Text style={styles.heroUserSub}>
                {me.role === 'ADMIN' ? '👑 Administrador' : '✨ Miembro'} · Ver mi Wishlist
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Alertas visuales próximos días */}
      {alerts.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <View style={styles.alertHeader}>
            <Text style={styles.alertHeaderText}>
              🔔 Alertas activas (próximos {space.reminderDaysBefore} días)
            </Text>
          </View>
          {alerts.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.85}
              onPress={() => handleEntryPress(item)}
              style={styles.alertCard}
            >
              <Text style={{ fontSize: 28, marginRight: 12 }}>{item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>{item.title}</Text>
                <Text style={styles.alertSub}>
                  {formatFriendlyDate(item.date)} · {item.subtitle}
                </Text>
              </View>
              <Badge
                label={formatCountdown(item.daysUntil)}
                color="#B45309"
                bg="#FEF3C7"
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Próximos eventos */}
      <SectionHeader
        title="Próximos eventos"
        subtitle="Cumpleaños, aniversarios e intercambios"
      />

      {upcoming.length === 0 ? (
        <EmptyState
          emoji="📅"
          title="Sin celebraciones próximas"
          description="Invita a tu equipo o crea el primer evento del mes."
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingRight: 8 }}
        >
          {upcoming.slice(0, 8).map((entry) => (
            <TouchableOpacity
              key={entry.id}
              activeOpacity={0.85}
              onPress={() => handleEntryPress(entry)}
              style={[styles.upcomingCard, { width: upcomingCardWidth }]}
            >
              <View style={styles.upcomingTop}>
                <Text style={{ fontSize: 28 }}>{entry.emoji}</Text>
                <Badge
                  label={formatCountdown(entry.daysUntil)}
                  color={entry.color}
                  bg={`${entry.color}1C`}
                />
              </View>
              <Text style={styles.upcomingTitle} numberOfLines={2}>
                {entry.title}
              </Text>
              <Text style={styles.upcomingDate}>{formatFriendlyDate(entry.date)}</Text>
              <Text style={styles.upcomingSub} numberOfLines={1}>
                {entry.subtitle}
              </Text>
              {entry.memberId && entry.memberId !== me.id ? (
                <Text style={styles.upcomingCta}>Ver wishlist y Modo Sorpresa →</Text>
              ) : (
                <Text style={styles.upcomingCta}>Abrir detalle →</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Muro de Celebraciones */}
      <SectionHeader
        title="Muro de Celebraciones"
        subtitle="Felicita al equipo y comparte anuncios"
        right={
          <Button
            title="+ Publicar"
            small
            onPress={() => setComposerOpen(true)}
          />
        }
      />

      {posts.length === 0 ? (
        <EmptyState
          emoji="🎊"
          title="El muro está esperando tu mensaje"
          description="Publica una felicitación o recuerda una votación de temática."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {posts.map((post) => {
            const postImg = resolveMediaUrl(post.imageUrl);
            const reactionMap = new Map(post.reactions.map((r) => [r.emoji, r]));
            return (
              <Card key={post.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <Avatar
                    emoji={post.author.avatarEmoji}
                    color={post.author.avatarColor}
                    imageUrl={post.author.avatarImageUrl}
                    size={40}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.postAuthor}>{post.author.name}</Text>
                    <Text style={styles.postMeta}>
                      {post.author.jobTitle || 'Equipo'}
                      {post.targetMember
                        ? ` · Para ${post.targetMember.avatarEmoji} ${post.targetMember.name}`
                        : ''}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 22 }}>{post.emoji}</Text>
                </View>

                <Text style={styles.postBody}>{post.message}</Text>

                {postImg ? (
                  <TouchableOpacity onPress={() => setLightboxUri(postImg)}>
                    <Image source={{ uri: postImg }} style={styles.postImage} resizeMode="cover" />
                  </TouchableOpacity>
                ) : null}

                {/* Encuesta interactiva dentro del post */}
                {post.pollOptions && post.pollOptions.length > 0 && (
                  <View style={styles.pollBox}>
                    <Text style={styles.pollHeader}>
                      📊 Encuesta · {post.totalPollVotes}{' '}
                      {post.totalPollVotes === 1 ? 'voto' : 'votos'}
                    </Text>
                    {post.pollOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.id}
                        activeOpacity={0.8}
                        onPress={() => handleVotePoll(post.id, opt.id)}
                        style={[styles.pollOption, opt.votedByMe && styles.pollOptionVoted]}
                      >
                        <View
                          style={[
                            styles.pollFill,
                            {
                              width: `${opt.percentage}%`,
                              backgroundColor: opt.votedByMe
                                ? COLORS.pollFillVoted
                                : COLORS.pollFillOther,
                            },
                          ]}
                        />
                        <View style={styles.pollOptionContent}>
                          <Text style={styles.pollOptionLabel}>
                            {opt.votedByMe ? '✓ ' : ''}
                            {opt.label}
                          </Text>
                          <Text style={styles.pollOptionPct}>
                            {opt.percentage}% ({opt.voteCount})
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Reacciones con emojis */}
                <View style={styles.reactionsRow}>
                  {REACTION_EMOJIS.map((em) => {
                    const summary = reactionMap.get(em);
                    const active = Boolean(summary?.reactedByMe);
                    const count = summary?.count || 0;
                    return (
                      <TouchableOpacity
                        key={em}
                        activeOpacity={0.75}
                        onPress={() => handleReact(post.id, em)}
                        style={[styles.reactPill, active && styles.reactPillActive]}
                      >
                        <Text style={{ fontSize: 15 }}>{em}</Text>
                        {count > 0 ? (
                          <Text
                            style={[
                              styles.reactCount,
                              active && { color: COLORS.primaryDark },
                            ]}
                          >
                            {count}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {post.targetMember ? (
                  <View style={styles.postFooter}>
                    <TouchableOpacity onPress={() => onOpenMember(post.targetMember!.id)}>
                      <Text style={styles.linkText}>
                        Ver perfil y Wishlist de {post.targetMember.name.split(' ')[0]} →
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}

      {/* Modal: Nuevo post / encuesta en muro */}
      <ModalSheet
        visible={composerOpen}
        title="Publicar en el Muro"
        onClose={() => setComposerOpen(false)}
      >
        <Text style={styles.label}>Elige un ícono</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {POST_EMOJIS.map((em) => (
            <TouchableOpacity
              key={em}
              onPress={() => setPostEmoji(em)}
              style={[styles.chip, postEmoji === em && styles.chipActive]}
            >
              <Text style={{ fontSize: 20 }}>{em}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>¿Dedicado a algún compañero? (opcional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setPostTargetId(null)}
              style={[styles.personChip, postTargetId === null && styles.personChipActive]}
            >
              <Text style={styles.personChipText}>Todo el equipo</Text>
            </TouchableOpacity>
            {members.map((m) => (
              <TouchableOpacity
                key={m.id}
                onPress={() => setPostTargetId(m.id)}
                style={[styles.personChip, postTargetId === m.id && styles.personChipActive]}
              >
                <Text style={styles.personChipText}>
                  {m.avatarEmoji} {m.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Input
          label={includePoll ? 'Pregunta de la encuesta / mensaje' : 'Mensaje'}
          placeholder={
            includePoll
              ? 'Ej. ¿Qué sabor de torta prefieren este mes?'
              : '¡Feliz cumpleaños! Que sea un día increíble...'
          }
          multiline
          value={postMsg}
          onChangeText={setPostMsg}
        />

        <ImagePickerField
          label="Adjuntar foto (opcional)"
          placeholder="Subir foto al muro"
          value={postImageUrl}
          onChange={setPostImageUrl}
        />

        {/* Toggle Encuesta */}
        <TouchableOpacity
          onPress={() => setIncludePoll(!includePoll)}
          style={[styles.pollToggleBtn, includePoll && styles.pollToggleBtnOn]}
        >
          <Text style={[styles.pollToggleText, includePoll && { color: COLORS.secondary }]}>
            {includePoll ? '✓ Encuesta activada (toca para quitar)' : '📊 + Agregar encuesta a este post'}
          </Text>
        </TouchableOpacity>

        {includePoll && (
          <View style={styles.pollEditor}>
            {pollOptions.map((opt, idx) => (
              <View key={`opt-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    placeholder={`Opción ${idx + 1}`}
                    value={opt}
                    onChangeText={(val) =>
                      setPollOptions((prev) => prev.map((o, i) => (i === idx ? val : o)))
                    }
                  />
                </View>
                {pollOptions.length > 2 && (
                  <TouchableOpacity
                    onPress={() => setPollOptions((prev) => prev.filter((_, i) => i !== idx))}
                    style={{ marginBottom: 12, padding: 6 }}
                  >
                    <Text style={{ color: COLORS.danger, fontWeight: '900' }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {pollOptions.length < 5 && (
              <Button
                title="+ Agregar otra opción"
                variant="outline"
                small
                onPress={() => setPollOptions((prev) => [...prev, ''])}
              />
            )}
          </View>
        )}

        <Button
          title={includePoll ? 'Publicar encuesta 📊' : 'Publicar en el muro 🎊'}
          loading={posting}
          onPress={handlePublish}
          style={{ marginTop: 8 }}
        />
      </ModalSheet>

      <ImageLightboxModal
        uri={lightboxUri}
        title="Foto del Muro"
        onClose={() => setLightboxUri(null)}
      />
    </ScrollView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  heroLogoWrap: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogoImg: {
    width: '100%',
    height: '100%',
  },
  heroSpaceLabel: {
    fontSize: 10.5,
    fontFamily: FONTS.bold,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.1,
  },
  heroSpaceName: {
    fontSize: 24,
    fontFamily: FONTS.title,
    letterSpacing: 1.5,
    color: '#FFFFFF',
    marginTop: 2,
  },
  invitePill: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  invitePillText: {
    color: COLORS.secondary,
    fontSize: 12.5,
    fontFamily: FONTS.bold,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.28)',
  },
  heroUserName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  heroUserSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontFamily: FONTS.medium,
    marginTop: 1,
  },
  alertHeader: {
    marginBottom: 8,
  },
  alertHeaderText: {
    fontSize: 12.5,
    fontFamily: FONTS.bold,
    color: COLORS.secondary,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  alertSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  upcomingCard: {
    width: 220,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  upcomingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  upcomingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.secondary,
    minHeight: 40,
  },
  upcomingDate: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 4,
  },
  upcomingSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  upcomingCta: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
    marginTop: 10,
  },
  postAuthor: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  postMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  postBody: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 21,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  likeBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  likeText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  linkText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  chip: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  personChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  personChipActive: {
    backgroundColor: COLORS.secondaryLight,
    borderColor: COLORS.secondary,
  },
  personChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  postImage: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: COLORS.surfaceMuted,
  },
  pollBox: {
    marginTop: 12,
    gap: 8,
    backgroundColor: COLORS.surfaceMuted,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pollHeader: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  pollOption: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    minHeight: 40,
    justifyContent: 'center',
  },
  pollOptionVoted: {
    borderColor: COLORS.primary,
  },
  pollFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  pollOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  pollOptionLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.secondary,
    flex: 1,
  },
  pollOptionPct: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  reactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reactPillActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  reactCount: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  pollToggleBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    alignItems: 'center',
  },
  pollToggleBtnOn: {
    backgroundColor: COLORS.secondaryLight,
    borderColor: COLORS.secondary,
  },
  pollToggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  pollEditor: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.tealLight,
    borderWidth: 1,
    borderColor: COLORS.teal,
  },
});

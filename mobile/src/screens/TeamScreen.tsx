import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, getPublicInviteUrl, getPublicWhatsappText } from '../api';
import { Avatar, Badge, Button, Card, Input, ModalSheet, SectionHeader } from '../components/UI';
import { FONTS, ThemeColors, useTheme, formatCountdown, formatFriendlyDate } from '../theme';
import type { MemberSummary, Space } from '../types';

interface Props {
  space: Space;
  me: MemberSummary;
  demoMode?: boolean;
  onOpenMember: (memberId: string) => void;
  onSpaceUpdated: (space: Space) => void;
  onSwitchDemoUser: (email: string) => Promise<void>;
  onLogout: () => void;
}

export function TeamScreen({
  space,
  me,
  demoMode = false,
  onOpenMember,
  onSpaceUpdated,
  onSwitchDemoUser,
  onLogout,
}: Props) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Admin settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [spaceName, setSpaceName] = useState(space.name);
  const [reminderDays, setReminderDays] = useState(String(space.reminderDaysBefore));
  const [currency, setCurrency] = useState(space.currency);
  const [customCode, setCustomCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const isAdmin = me.role === 'ADMIN';
  const isDemoSpace = demoMode && space.inviteCode === 'VEP-2026';

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.getMembers();
      setMembers(res.members);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = members.filter((m) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      (m.jobTitle || '').toLowerCase().includes(q) ||
      (m.department || '').toLowerCase().includes(q)
    );
  });

  const liveInviteUrl = getPublicInviteUrl(space.inviteCode, space.magicLinks.webLink);
  const liveWhatsappText = getPublicWhatsappText(
    space.name,
    space.inviteCode,
    space.magicLinks.webLink
  );

  async function shareInvite() {
    try {
      await Share.share({
        message: liveWhatsappText,
        title: `Invitación a ${space.name}`,
      });
    } catch {
      // web fallback
    }
  }

  function openWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(liveWhatsappText)}`;
    Linking.openURL(url).catch(() => {});
  }

  async function saveSpaceSettings() {
    setSaving(true);
    setFeedback('');
    try {
      const updated = await api.updateSpace({
        name: spaceName.trim(),
        reminderDaysBefore: Math.max(1, Number(reminderDays) || 7),
        currency: currency.trim() || 'USD',
      });
      onSpaceUpdated(updated);
      setFeedback('✅ Configuración guardada');
    } catch (e: any) {
      setFeedback(`⚠️ ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function regenerateCode() {
    setSaving(true);
    setFeedback('');
    try {
      const res = await api.regenerateInviteCode(customCode.trim() || undefined);
      onSpaceUpdated({
        ...space,
        inviteCode: res.inviteCode,
        magicLinks: res.magicLinks,
      });
      setCustomCode('');
      setFeedback(`✅ Nuevo código activo: ${res.inviteCode}`);
    } catch (e: any) {
      setFeedback(`⚠️ ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      showsVerticalScrollIndicator={false}
    >
      {/* My Profile Quick Card */}
      <TouchableOpacity activeOpacity={0.85} onPress={() => onOpenMember(me.id)}>
        <Card style={styles.myCard}>
          <Avatar
            emoji={me.avatarEmoji}
            color={me.avatarColor}
            imageUrl={me.avatarImageUrl}
            size={52}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.myName}>{me.name}</Text>
            <Text style={styles.mySub}>
              {me.role === 'ADMIN' ? '👑 Administrador' : '✨ Miembro'} · {me.jobTitle || 'Mi perfil'}
            </Text>
            <Text style={styles.myCta}>Editar tallas, alergias y mi Wishlist →</Text>
          </View>
        </Card>
      </TouchableOpacity>

      {/* Invite & Space Code Card */}
      <Card style={styles.inviteCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.inviteLabel}>CÓDIGO DE INVITACIÓN</Text>
            <Text style={styles.inviteCode}>{space.inviteCode}</Text>
          </View>
          {isAdmin && (
            <Button title="⚙️ Configurar" small variant="outline" onPress={() => setSettingsOpen(true)} />
          )}
        </View>
        <Text style={styles.magicUrl} selectable>
          {liveInviteUrl}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Button
            title="💬 Enviar por WhatsApp"
            variant="success"
            small
            style={{ flex: 1 }}
            onPress={openWhatsApp}
          />
          <Button
            title="📤 Compartir"
            variant="secondary"
            small
            style={{ flex: 1 }}
            onPress={shareInvite}
          />
        </View>
      </Card>

      {/* Demo Persona Switcher to showcase Secret Reservation & Modo Sorpresa! */}
      {isDemoSpace && members.length > 0 && (
        <Card style={styles.demoSwitchCard}>
          <Text style={styles.demoSwitchTitle}>🧪 Cambiar de perfil (Demo Vepagos)</Text>
          <Text style={styles.demoSwitchSub}>
            Prueba entrar como Mateo (cumpleañero) para ver cómo se ocultan las reservas de su
            wishlist y la pestaña Modo Sorpresa.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {members.map((m) => {
                const active = m.id === me.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => !active && onSwitchDemoUser(m.email)}
                    style={[styles.switchChip, active && styles.switchChipActive]}
                  >
                    <Text style={[styles.switchChipText, active && { color: '#FFFFFF' }]}>
                      {m.avatarEmoji} {m.name.split(' ')[0]}
                      {m.role === 'ADMIN' ? ' (Admin)' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </Card>
      )}

      {/* Team Directory */}
      <SectionHeader
        title={`Equipo (${members.length})`}
        subtitle="Toca a un compañero para ver su wishlist y Modo Sorpresa"
      />

      <Input placeholder="🔍 Buscar compañero por nombre o área..." value={query} onChangeText={setQuery} />

      <View style={{ gap: 10 }}>
        {filtered.map((m) => (
          <TouchableOpacity key={m.id} activeOpacity={0.85} onPress={() => onOpenMember(m.id)}>
            <Card style={styles.memberRow}>
              <Avatar
                emoji={m.avatarEmoji}
                color={m.avatarColor}
                imageUrl={m.avatarImageUrl}
                size={46}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.memberName}>
                    {m.name} {m.isSelf ? '(Tú)' : ''}
                  </Text>
                  {m.role === 'ADMIN' && (
                    <Badge label="Admin" color={COLORS.secondary} bg={COLORS.secondaryLight} />
                  )}
                </View>
                <Text style={styles.memberMeta}>
                  🎂 {formatFriendlyDate(m.birthDate)}
                  {m.daysUntilBirthday !== null && m.daysUntilBirthday !== undefined
                    ? ` · ${formatCountdown(m.daysUntilBirthday)}`
                    : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                  <Text style={styles.miniTag}>🎁 {m.wishlistCount || 0} deseos</Text>
                  {!m.isSelf && (m.surpriseMessagesCount || 0) > 0 && (
                    <Text style={[styles.miniTag, { color: COLORS.pink }]}>
                      🤫 {m.surpriseMessagesCount} en Modo Sorpresa
                    </Text>
                  )}
                  {m.allergies && m.allergies.toLowerCase() !== 'ninguna' ? (
                    <Text style={[styles.miniTag, { color: COLORS.danger }]}>⚠️ Alergia</Text>
                  ) : null}
                </View>
              </View>
              <Text style={{ fontSize: 18, color: COLORS.textLight }}>›</Text>
            </Card>
          </TouchableOpacity>
        ))}
      </View>

      <Button
        title="Cerrar sesión / Cambiar de espacio"
        variant="outline"
        onPress={onLogout}
        style={{ marginTop: 24 }}
      />

      {/* Admin Space Settings Modal */}
      <ModalSheet
        visible={settingsOpen}
        title="Configuración del Espacio"
        onClose={() => {
          setSettingsOpen(false);
          setFeedback('');
        }}
      >
        {feedback ? (
          <View style={styles.feedbackBox}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.secondary }}>{feedback}</Text>
          </View>
        ) : null}

        <Input label="Nombre del espacio" value={spaceName} onChangeText={setSpaceName} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Recordar días antes"
              keyboardType="numeric"
              value={reminderDays}
              onChangeText={setReminderDays}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Moneda de cuotas" value={currency} onChangeText={setCurrency} />
          </View>
        </View>
        <Button title="Guardar configuración" loading={saving} onPress={saveSpaceSettings} />

        <View style={styles.divider} />
        <Text style={styles.subTitle}>Cambiar o regenerar código de invitación</Text>
        <Input
          label="Código personalizado (opcional)"
          placeholder="Ej. OFI-2026"
          autoCapitalize="characters"
          value={customCode}
          onChangeText={setCustomCode}
        />
        <Button
          title="Actualizar código de acceso 🔄"
          variant="secondary"
          loading={saving}
          onPress={regenerateCode}
        />
      </ModalSheet>
    </ScrollView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 28 },
  myCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  myName: { fontSize: 17, fontFamily: FONTS.title, letterSpacing: 0.8, color: COLORS.secondary },
  mySub: { fontSize: 12.5, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 2 },
  myCta: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primary, marginTop: 4 },
  inviteCard: { marginBottom: 12 },
  inviteLabel: { fontSize: 10.5, fontFamily: FONTS.bold, color: COLORS.textLight, letterSpacing: 0.9 },
  inviteCode: { fontSize: 24, fontFamily: FONTS.title, color: COLORS.secondary, letterSpacing: 2 },
  magicUrl: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.tealDark,
    backgroundColor: COLORS.surfaceMuted,
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  demoSwitchCard: {
    backgroundColor: COLORS.tealLight,
    borderColor: COLORS.teal,
    marginBottom: 8,
  },
  demoSwitchTitle: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.secondary },
  demoSwitchSub: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textMuted, marginTop: 2, marginBottom: 10 },
  switchChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.teal,
  },
  switchChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  switchChipText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.secondary },
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  memberName: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.secondary },
  memberMeta: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 2 },
  miniTag: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textMuted },
  feedbackBox: {
    backgroundColor: COLORS.tealLight,
    borderWidth: 1,
    borderColor: COLORS.teal,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  subTitle: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.secondary, marginBottom: 10 },
});

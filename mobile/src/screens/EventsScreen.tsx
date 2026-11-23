import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api';
import { DatePickerField } from '../components/Pickers';
import { Avatar, Badge, Button, Card, EmptyState, Input, ModalSheet, SectionHeader } from '../components/UI';
import { EVENT_TYPE_META, FONTS, ThemeColors, useTheme, formatCountdown, formatFriendlyDate } from '../theme';
import type { EventDetail, MemberSummary, Space } from '../types';

interface Props {
  space: Space;
  me: MemberSummary;
  initialEventId?: string | null;
  onClearInitialEvent?: () => void;
  onOpenMember: (memberId: string) => void;
}

const CHECKLIST_CATS = ['Comida', 'Bebidas', 'Decoración', 'Logística', 'Regalo'];
const THEME_EMOJIS = ['🎬', '🕹️', '🥐', '🍕', '🌮', '🎤', '🎄', '🎨', '🏖️'];

export function EventsScreen({
  space,
  me,
  initialEventId,
  onClearInitialEvent,
  onOpenMember,
}: Props) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [events, setEvents] = useState<EventDetail[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventDetail | null>(null);
  const [detailTab, setDetailTab] = useState<'themes' | 'checklist' | 'quotas'>('themes');
  const [refreshing, setRefreshing] = useState(false);

  // Create event modal (Admin)
  const [createOpen, setCreateOpen] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evType, setEvType] = useState<EventDetail['type']>('BIRTHDAY_GROUP');
  const [evDate, setEvDate] = useState('2026-11-30');
  const [evTime, setEvTime] = useState('16:30');
  const [evLocation, setEvLocation] = useState('');
  const [evQuota, setEvQuota] = useState('10');
  const [evThemesRaw, setEvThemesRaw] = useState('Noche de Cine, Fiesta Retro, Desayuno Sorpresa');
  const [saving, setSaving] = useState(false);

  // Propose theme modal
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [themeTitle, setThemeTitle] = useState('');
  const [themeDesc, setThemeDesc] = useState('');
  const [themeEmoji, setThemeEmoji] = useState('🎬');

  // Add checklist item modal
  const [checkModalOpen, setCheckModalOpen] = useState(false);
  const [checkTitle, setCheckTitle] = useState('');
  const [checkCat, setCheckCat] = useState('Comida');
  const [checkCost, setCheckCost] = useState('');
  const [checkClaim, setCheckClaim] = useState(true);

  const isAdmin = me.role === 'ADMIN';

  const loadEvents = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.getEvents();
      setEvents(res.events);
      if (initialEventId) {
        const found = res.events.find((e) => e.id === initialEventId);
        if (found) setSelectedEvent(found);
        onClearInitialEvent?.();
      } else if (selectedEvent) {
        const refreshed = res.events.find((e) => e.id === selectedEvent.id);
        if (refreshed) setSelectedEvent(refreshed);
      }
    } finally {
      setRefreshing(false);
    }
  }, [initialEventId, onClearInitialEvent, selectedEvent?.id]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  function syncUpdatedEvent(updated: EventDetail) {
    setSelectedEvent(updated);
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  async function handleCreateEvent() {
    if (!evTitle.trim()) return;
    setSaving(true);
    try {
      const initialThemes = evThemesRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((title, i) => ({ title, emoji: THEME_EMOJIS[i % THEME_EMOJIS.length] }));

      const { event } = await api.createEvent({
        title: evTitle.trim(),
        description: evDesc.trim(),
        type: evType,
        eventDate: evDate.trim(),
        eventTime: evTime.trim(),
        location: evLocation.trim(),
        quotaAmount: Number(evQuota) || 0,
        initialThemes,
      });
      setEvents((prev) => [event, ...prev]);
      setSelectedEvent(event);
      setCreateOpen(false);
      setEvTitle('');
      setEvDesc('');
    } finally {
      setSaving(false);
    }
  }

  async function handleProposeTheme() {
    if (!selectedEvent || !themeTitle.trim()) return;
    setSaving(true);
    try {
      const { event } = await api.proposeTheme(selectedEvent.id, {
        title: themeTitle.trim(),
        description: themeDesc.trim(),
        emoji: themeEmoji,
      });
      syncUpdatedEvent(event);
      setThemeTitle('');
      setThemeDesc('');
      setThemeModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleVote(optionId: string) {
    if (!selectedEvent) return;
    const { event } = await api.voteTheme(selectedEvent.id, optionId);
    syncUpdatedEvent(event);
  }

  async function handleSelectTheme(optionId: string) {
    if (!selectedEvent) return;
    const { event } = await api.selectWinningTheme(selectedEvent.id, optionId);
    syncUpdatedEvent(event);
  }

  async function handleDeleteTheme(optionId: string) {
    if (!selectedEvent) return;
    const { event } = await api.deleteThemeOption(selectedEvent.id, optionId);
    syncUpdatedEvent(event);
  }

  async function handleAddChecklist() {
    if (!selectedEvent || !checkTitle.trim()) return;
    setSaving(true);
    try {
      const { event } = await api.addChecklistItem(selectedEvent.id, {
        title: checkTitle.trim(),
        category: checkCat,
        estimatedCost: Number(checkCost) || 0,
        claimByMe: checkClaim,
      });
      syncUpdatedEvent(event);
      setCheckTitle('');
      setCheckCost('');
      setCheckModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleCheck(itemId: string, kind: 'claim' | 'complete') {
    if (!selectedEvent) return;
    const { event } = await api.updateChecklistItem(
      selectedEvent.id,
      itemId,
      kind === 'claim' ? { toggleClaim: true } : { toggleComplete: true }
    );
    syncUpdatedEvent(event);
  }

  async function handleToggleContribution(memberId: string) {
    if (!selectedEvent) return;
    const { event } = await api.toggleContribution(selectedEvent.id, memberId);
    syncUpdatedEvent(event);
  }

  async function handleDrawSecretSanta() {
    if (!selectedEvent) return;
    setSaving(true);
    try {
      const { event } = await api.drawSecretSanta(selectedEvent.id);
      syncUpdatedEvent(event);
    } finally {
      setSaving(false);
    }
  }

  // ==================== EVENT DETAIL VIEW ====================
  if (selectedEvent) {
    const meta = EVENT_TYPE_META[selectedEvent.type] || EVENT_TYPE_META.CELEBRATION;
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.bg }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => setSelectedEvent(null)} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Todos los eventos</Text>
        </TouchableOpacity>

        <Card style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge label={`${meta.emoji} ${meta.label}`} color={meta.color} bg={meta.bg} />
            <Badge
              label={formatCountdown(selectedEvent.daysUntil)}
              color={COLORS.secondary}
              bg={COLORS.secondaryLight}
            />
          </View>
          <Text style={styles.detailTitle}>{selectedEvent.title}</Text>
          {selectedEvent.description ? (
            <Text style={styles.detailDesc}>{selectedEvent.description}</Text>
          ) : null}

          <View style={styles.metaGrid}>
            <Text style={styles.metaChip}>📅 {formatFriendlyDate(selectedEvent.eventDate)}</Text>
            <Text style={styles.metaChip}>⏰ {selectedEvent.eventTime}</Text>
            {selectedEvent.location ? (
              <Text style={styles.metaChip}>📍 {selectedEvent.location}</Text>
            ) : null}
            {selectedEvent.quotaAmount > 0 ? (
              <Text style={styles.metaChip}>
                💵 Cuota: {space.currency} {selectedEvent.quotaAmount}
              </Text>
            ) : null}
          </View>

          {selectedEvent.selectedTheme ? (
            <View style={styles.winnerBanner}>
              <Text style={styles.winnerText}>
                🏆 Temática elegida: {selectedEvent.selectedTheme}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Secret Santa Block (when SECRET_SANTA) */}
        {selectedEvent.type === 'SECRET_SANTA' && (
          <Card style={styles.santaCard}>
            <Text style={styles.santaTitle}>🎅 Sorteo de Amigo Secreto</Text>
            {selectedEvent.secretSantaDrawn && selectedEvent.mySecretSantaReceiver ? (
              <View>
                <Text style={styles.santaHint}>Tu amigo secreto asignado es (solo tú lo ves):</Text>
                <TouchableOpacity
                  onPress={() => onOpenMember(selectedEvent.mySecretSantaReceiver!.id)}
                  style={styles.santaPersonBox}
                >
                  <Avatar
                    emoji={selectedEvent.mySecretSantaReceiver.avatarEmoji}
                    color={selectedEvent.mySecretSantaReceiver.avatarColor}
                    size={46}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.santaPersonName}>
                      {selectedEvent.mySecretSantaReceiver.name}
                    </Text>
                    <Text style={styles.santaPersonSub}>
                      {selectedEvent.mySecretSantaReceiver.jobTitle || 'Compañero de equipo'}
                    </Text>
                    {selectedEvent.mySecretSantaReceiver.allergies ? (
                      <Text style={styles.santaAllergy}>
                        ⚠️ Alergias: {selectedEvent.mySecretSantaReceiver.allergies}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ color: COLORS.success, fontWeight: '800', fontSize: 13 }}>
                    Wishlist →
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={styles.santaHint}>
                  El sorteo aún no se ha realizado. Nadie podrá tocarse a sí mismo.
                </Text>
                {isAdmin ? (
                  <Button
                    title="🎲 Realizar sorteo automático ahora"
                    variant="success"
                    loading={saving}
                    onPress={handleDrawSecretSanta}
                  />
                ) : (
                  <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
                    Esperando a que el Administrador inicie el sorteo.
                  </Text>
                )}
              </View>
            )}
          </Card>
        )}

        {/* Sub-tabs */}
        <View style={styles.subTabs}>
          {(
            [
              { key: 'themes', label: `🗳️ Temas (${selectedEvent.themeOptions.length})` },
              {
                key: 'checklist',
                label: `✅ Lista (${selectedEvent.checklistDoneCount}/${selectedEvent.checklistTotalCount})`,
              },
              {
                key: 'quotas',
                label: `💰 Cuotas (${selectedEvent.paidCount}/${selectedEvent.totalMembers})`,
              },
            ] as const
          ).map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setDetailTab(t.key)}
              style={[styles.subTab, detailTab === t.key && styles.subTabActive]}
            >
              <Text
                numberOfLines={1}
                style={[styles.subTabText, detailTab === t.key && styles.subTabTextActive]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* TAB 1: TEMÁTICAS Y VOTACIÓN */}
        {detailTab === 'themes' && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.tabHint}>
                {selectedEvent.votingClosed
                  ? 'Votación cerrada por el administrador.'
                  : `Toca una temática para votar (${selectedEvent.totalVotes} votos)`}
              </Text>
              {(!selectedEvent.votingClosed || isAdmin) && (
                <Button title="+ Proponer" small onPress={() => setThemeModalOpen(true)} />
              )}
            </View>

            {selectedEvent.themeOptions.length === 0 ? (
              <EmptyState
                emoji="🎭"
                title="Aún no hay temáticas propuestas"
                description="Propón ideas como Noche de Cine, Fiesta Retro o Desayuno Sorpresa."
              />
            ) : (
              selectedEvent.themeOptions.map((opt) => (
                <Card key={opt.id} style={opt.votedByMe ? styles.votedCard : undefined}>
                  <TouchableOpacity
                    disabled={selectedEvent.votingClosed}
                    onPress={() => handleVote(opt.id)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 26, marginRight: 10 }}>{opt.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.optTitle}>{opt.title}</Text>
                        {opt.description ? (
                          <Text style={styles.optDesc}>{opt.description}</Text>
                        ) : null}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.optPct}>{opt.percentage}%</Text>
                        <Text style={styles.optVotes}>
                          {opt.voteCount} {opt.voteCount === 1 ? 'voto' : 'votos'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${opt.percentage}%`,
                            backgroundColor: opt.votedByMe ? COLORS.primary : COLORS.accent,
                          },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>

                  <View style={styles.optFooter}>
                    <Text style={styles.optMeta}>
                      Propuesta por {opt.proposedByName} {opt.votedByMe ? '· ✓ Tu voto' : ''}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {isAdmin && (
                        <TouchableOpacity onPress={() => handleSelectTheme(opt.id)}>
                          <Text style={styles.adminAction}>🏆 Fijar ganadora</Text>
                        </TouchableOpacity>
                      )}
                      {(isAdmin || opt.proposedById === me.id) && (
                        <TouchableOpacity onPress={() => handleDeleteTheme(opt.id)}>
                          <Text style={[styles.adminAction, { color: COLORS.danger }]}>Quitar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {/* TAB 2: CHECKLIST COLABORATIVO */}
        {detailTab === 'checklist' && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.tabHint}>Divide quién lleva torta, bebidas o decoración</Text>
              <Button title="+ Agregar ítem" small onPress={() => setCheckModalOpen(true)} />
            </View>

            {selectedEvent.checklistItems.length === 0 ? (
              <EmptyState
                emoji="📝"
                title="Checklist vacío"
                description="Agrega lo que hace falta para que cada persona se apunte."
              />
            ) : (
              selectedEvent.checklistItems.map((item) => {
                const isMine = item.assignedTo?.id === me.id;
                return (
                  <Card key={item.id} style={styles.checkCard}>
                    <TouchableOpacity
                      onPress={() => handleToggleCheck(item.id, 'complete')}
                      style={[styles.checkbox, item.completed && styles.checkboxDone]}
                    >
                      {item.completed ? (
                        <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 13 }}>✓</Text>
                      ) : null}
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.checkTitle,
                          item.completed && { textDecorationLine: 'line-through', color: COLORS.textLight },
                        ]}
                      >
                        {item.title}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <Badge label={item.category} color={COLORS.secondary} bg={COLORS.surfaceMuted} />
                        {item.estimatedCost > 0 && (
                          <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
                            ~{space.currency} {item.estimatedCost}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.assigneeText}>
                        {item.assignedTo
                          ? `Lleva: ${item.assignedTo.avatarEmoji} ${item.assignedTo.name}`
                          : 'Sin asignar todavía'}
                      </Text>
                    </View>

                    <Button
                      title={isMine ? 'Soltar' : item.assignedTo ? 'Tomar' : 'Yo llevo'}
                      variant={isMine ? 'outline' : 'ghost'}
                      small
                      onPress={() => handleToggleCheck(item.id, 'claim')}
                    />
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* TAB 3: CUOTAS */}
        {detailTab === 'quotas' && (
          <View style={{ gap: 10 }}>
            <Card style={styles.quotaSummary}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={styles.quotaBig}>
                  {space.currency} {selectedEvent.collectedTotal.toFixed(0)}
                  <Text style={styles.quotaOf}> / {selectedEvent.expectedTotal.toFixed(0)}</Text>
                </Text>
                <Badge
                  label={`${selectedEvent.paidCount} de ${selectedEvent.totalMembers} al día`}
                  color={COLORS.success}
                  bg={COLORS.successLight}
                />
              </View>
              {selectedEvent.budgetNote ? (
                <Text style={{ fontSize: 12, color: COLORS.textMuted }}>{selectedEvent.budgetNote}</Text>
              ) : null}
            </Card>

            {selectedEvent.contributions.map((c) => {
              const canToggle = isAdmin || c.memberId === me.id;
              return (
                <Card key={c.memberId} style={styles.contribRow}>
                  <Avatar emoji={c.avatarEmoji} color={c.avatarColor} size={40} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.optTitle}>{c.memberName}</Text>
                    <Text style={styles.optDesc}>
                      Cuota: {space.currency} {c.amount}
                    </Text>
                  </View>
                  <TouchableOpacity
                    disabled={!canToggle}
                    onPress={() => handleToggleContribution(c.memberId)}
                    style={[
                      styles.paidPill,
                      c.paid ? styles.paidPillYes : styles.paidPillNo,
                      !canToggle && { opacity: 0.6 },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: c.paid ? '#065F46' : '#92400E',
                      }}
                    >
                      {c.paid ? '✓ Pagado' : 'Pendiente'}
                    </Text>
                  </TouchableOpacity>
                </Card>
              );
            })}
          </View>
        )}

        {/* Modal: Proponer temática */}
        <ModalSheet
          visible={themeModalOpen}
          title="Proponer Temática"
          onClose={() => setThemeModalOpen(false)}
        >
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {THEME_EMOJIS.map((em) => (
              <TouchableOpacity
                key={em}
                onPress={() => setThemeEmoji(em)}
                style={[styles.emojiBox, themeEmoji === em && styles.emojiBoxActive]}
              >
                <Text style={{ fontSize: 20 }}>{em}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Input
            label="Nombre de la temática"
            placeholder="Ej. Noche de Trivia & Pizza"
            value={themeTitle}
            onChangeText={setThemeTitle}
          />
          <Input
            label="Descripción (opcional)"
            placeholder="Idea de decoración, comida o lugar..."
            multiline
            value={themeDesc}
            onChangeText={setThemeDesc}
          />
          <Button title="Agregar a votación 🗳️" loading={saving} onPress={handleProposeTheme} />
        </ModalSheet>

        {/* Modal: Agregar ítem checklist */}
        <ModalSheet
          visible={checkModalOpen}
          title="Agregar al Checklist"
          onClose={() => setCheckModalOpen(false)}
        >
          <Input
            label="¿Qué hay que llevar o hacer?"
            placeholder="Ej. Torta sin nueces, vasos, velitas..."
            value={checkTitle}
            onChangeText={setCheckTitle}
          />
          <Text style={styles.label}>Categoría</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {CHECKLIST_CATS.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCheckCat(cat)}
                style={[styles.catChip, checkCat === cat && styles.catChipActive]}
              >
                <Text style={[styles.catChipText, checkCat === cat && { color: '#FFFFFF' }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Input
            label={`Costo estimado (${space.currency})`}
            placeholder="Ej. 15"
            keyboardType="numeric"
            value={checkCost}
            onChangeText={setCheckCost}
          />
          <TouchableOpacity
            onPress={() => setCheckClaim(!checkClaim)}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 }}
          >
            <View style={[styles.checkbox, checkClaim && styles.checkboxDone]}>
              {checkClaim ? <Text style={{ color: '#FFF', fontWeight: '900' }}>✓</Text> : null}
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.secondary }}>
              Asignármelo a mí ("Yo lo llevo")
            </Text>
          </TouchableOpacity>
          <Button title="Guardar ítem" loading={saving} onPress={handleAddChecklist} />
        </ModalSheet>
      </ScrollView>
    );
  }

  // ==================== EVENTS LIST VIEW ====================
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadEvents} />}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader
        title="Eventos y Temáticas"
        subtitle="Vota temáticas, reparte el checklist y lleva cuotas"
        right={
          isAdmin ? (
            <Button title="+ Nuevo" small onPress={() => setCreateOpen(true)} />
          ) : (
            <Badge label="Solo Admin crea" color={COLORS.textMuted} bg={COLORS.surfaceMuted} />
          )
        }
      />

      {events.length === 0 ? (
        <EmptyState
          emoji="🎉"
          title="Todavía no hay eventos creados"
          description="El administrador puede crear el Cumpleaños del Mes o el Amigo Secreto."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {events.map((ev) => {
            const meta = EVENT_TYPE_META[ev.type] || EVENT_TYPE_META.CELEBRATION;
            return (
              <TouchableOpacity
                key={ev.id}
                activeOpacity={0.85}
                onPress={() => {
                  setSelectedEvent(ev);
                  setDetailTab('themes');
                }}
              >
                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Badge label={`${meta.emoji} ${meta.label}`} color={meta.color} bg={meta.bg} />
                    <Badge
                      label={formatCountdown(ev.daysUntil)}
                      color={COLORS.secondary}
                      bg={COLORS.secondaryLight}
                    />
                  </View>

                  <Text style={styles.evTitle}>{ev.title}</Text>
                  <Text style={styles.evMeta}>
                    📅 {formatFriendlyDate(ev.eventDate)} · ⏰ {ev.eventTime}
                    {ev.location ? ` · 📍 ${ev.location}` : ''}
                  </Text>

                  {ev.selectedTheme ? (
                    <Text style={styles.evTheme}>🏆 {ev.selectedTheme}</Text>
                  ) : ev.themeOptions.length > 0 ? (
                    <Text style={styles.evVoting}>
                      🗳️ {ev.themeOptions.length} temáticas en votación ({ev.totalVotes} votos)
                    </Text>
                  ) : null}

                  <View style={styles.evStats}>
                    <Text style={styles.evStatText}>
                      ✅ {ev.checklistDoneCount}/{ev.checklistTotalCount} checklist
                    </Text>
                    {ev.quotaAmount > 0 && (
                      <Text style={styles.evStatText}>
                        💰 {space.currency} {ev.collectedTotal}/{ev.expectedTotal}
                      </Text>
                    )}
                    <Text style={[styles.evStatText, { color: COLORS.primary }]}>Abrir →</Text>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Modal: Crear evento (Admin) */}
      <ModalSheet
        visible={createOpen}
        title="Crear Celebración"
        onClose={() => setCreateOpen(false)}
      >
        <Input
          label="Nombre del evento"
          placeholder="Ej. Cumpleaños de Diciembre o Navidad"
          value={evTitle}
          onChangeText={setEvTitle}
        />
        <Text style={styles.label}>Tipo de celebración</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {(['BIRTHDAY_GROUP', 'SECRET_SANTA', 'GIFT_EXCHANGE', 'ANNIVERSARY', 'CELEBRATION'] as const).map(
            (t) => {
              const m = EVENT_TYPE_META[t];
              const active = evType === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setEvType(t)}
                  style={[styles.catChip, active && styles.catChipActive]}
                >
                  <Text style={[styles.catChipText, active && { color: '#FFFFFF' }]}>
                    {m.emoji} {m.label}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </View>

        <DatePickerField
          label="Fecha del evento"
          mode="event"
          value={evDate}
          onChange={setEvDate}
        />

        <Input label="Hora" placeholder="16:30" value={evTime} onChangeText={setEvTime} />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label="Lugar" placeholder="Terraza / Sala" value={evLocation} onChangeText={setEvLocation} />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label={`Cuota (${space.currency})`}
              keyboardType="numeric"
              value={evQuota}
              onChangeText={setEvQuota}
            />
          </View>
        </View>

        <Input
          label="Temáticas iniciales a votar (separadas por coma)"
          placeholder="Noche de Cine, Fiesta Retro, Desayuno Sorpresa"
          value={evThemesRaw}
          onChangeText={setEvThemesRaw}
        />
        <Input
          label="Notas / descripción"
          placeholder="Detalles importantes, alergias a cuidar..."
          multiline
          value={evDesc}
          onChangeText={setEvDesc}
        />
        <Button title="Crear evento 🎉" loading={saving} onPress={handleCreateEvent} />
      </ModalSheet>
    </ScrollView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 28 },
  backBtn: {
    marginBottom: 10,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
  },
  backBtnText: { fontSize: 13.5, fontWeight: '800', color: COLORS.primaryDark },
  detailTitle: {
    fontSize: 19,
    fontFamily: FONTS.title,
    letterSpacing: 0.8,
    color: COLORS.secondary,
    marginTop: 10,
  },
  detailDesc: { fontSize: 13.5, fontFamily: FONTS.regular, color: COLORS.textMuted, marginTop: 6, lineHeight: 20 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metaChip: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: COLORS.secondary,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  winnerBanner: {
    marginTop: 12,
    backgroundColor: COLORS.tealLight,
    borderWidth: 1,
    borderColor: COLORS.teal,
    borderRadius: 12,
    padding: 10,
  },
  winnerText: { fontSize: 13.5, fontFamily: FONTS.bold, color: COLORS.secondary },
  santaCard: {
    marginBottom: 14,
    backgroundColor: COLORS.tealLight,
    borderColor: COLORS.teal,
  },
  santaTitle: { fontSize: 16, fontFamily: FONTS.title, letterSpacing: 0.8, color: COLORS.secondary, marginBottom: 6 },
  santaHint: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.tealDark, marginBottom: 10 },
  santaPersonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 14,
  },
  santaPersonName: { fontSize: 16, fontWeight: '800', color: COLORS.secondary },
  santaPersonSub: { fontSize: 12, color: COLORS.textMuted },
  santaAllergy: { fontSize: 12, color: COLORS.danger, fontWeight: '700', marginTop: 3 },
  subTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceMuted,
    padding: 4,
    borderRadius: 14,
    marginBottom: 14,
  },
  subTab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  subTabActive: { backgroundColor: COLORS.surface },
  subTabText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  subTabTextActive: { color: COLORS.primary },
  tabHint: { fontSize: 12, color: COLORS.textMuted, flex: 1, marginRight: 8 },
  votedCard: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  optTitle: { fontSize: 15, fontWeight: '800', color: COLORS.secondary },
  optDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  optPct: { fontSize: 16, fontWeight: '900', color: COLORS.secondary },
  optVotes: { fontSize: 11, color: COLORS.textMuted },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  optFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  optMeta: { fontSize: 12, color: COLORS.textMuted },
  adminAction: { fontSize: 12, fontWeight: '800', color: COLORS.accent },
  checkCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  checkTitle: { fontSize: 14, fontWeight: '800', color: COLORS.secondary },
  assigneeText: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  quotaSummary: { backgroundColor: COLORS.tealLight, borderColor: COLORS.teal },
  quotaBig: { fontSize: 22, fontFamily: FONTS.extrabold, color: COLORS.secondary },
  quotaOf: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.tealDark },
  contribRow: { flexDirection: 'row', alignItems: 'center' },
  paidPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  paidPillYes: { backgroundColor: COLORS.tealLight, borderWidth: 1, borderColor: COLORS.teal },
  paidPillNo: { backgroundColor: COLORS.primaryLight },
  evTitle: { fontSize: 16.5, fontFamily: FONTS.bold, color: COLORS.secondary },
  evMeta: { fontSize: 12.5, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 4 },
  evTheme: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.tealDark, marginTop: 8 },
  evVoting: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.primary, marginTop: 8 },
  evStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  evStatText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.textMuted },
  label: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.secondary, marginBottom: 8 },
  emojiBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiBoxActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceMuted,
  },
  catChipActive: { backgroundColor: COLORS.primary },
  catChipText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.secondary },
});

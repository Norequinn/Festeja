import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, resolveMediaUrl } from '../api';
import { DatePickerField, ImageLightboxModal, ImagePickerField } from '../components/Pickers';
import { Avatar, Badge, Button, Card, EmptyState, Input, ModalSheet } from '../components/UI';
import { FONTS, ThemeColors, useTheme, formatCountdown, formatFriendlyDate } from '../theme';
import type { MemberSummary, SurpriseMessage, WishlistItem } from '../types';

interface Props {
  memberId: string;
  currentUser: MemberSummary;
  onBack: () => void;
  onProfileUpdated?: (member: MemberSummary) => void;
  onScheduleGroupGiftPayment?: (prefill: {
    targetMemberId: string;
    targetMemberName: string;
    wishlistItemId: string;
    giftTitle: string;
  }) => void;
}

export function MemberDetailScreen({
  memberId,
  currentUser,
  onBack,
  onProfileUpdated,
  onScheduleGroupGiftPayment,
}: Props) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<MemberSummary | null>(null);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [surpriseMsgs, setSurpriseMsgs] = useState<SurpriseMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'wishlist' | 'surprise'>('wishlist');

  // Add wishlist item modal (for self)
  const [wishModalOpen, setWishModalOpen] = useState(false);
  const [wishTitle, setWishTitle] = useState('');
  const [wishDesc, setWishDesc] = useState('');
  const [wishUrl, setWishUrl] = useState('');
  const [wishImageUrl, setWishImageUrl] = useState('');
  const [wishPrice, setWishPrice] = useState('');
  const [wishPriority, setWishPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');

  // Edit profile modal (for self)
  const [editOpen, setEditOpen] = useState(false);
  const [editAvatarImg, setEditAvatarImg] = useState('');
  const [editJob, setEditJob] = useState('');
  const [editBirth, setEditBirth] = useState('');
  const [editAnniv, setEditAnniv] = useState('');
  const [editShirt, setEditShirt] = useState('');
  const [editShoe, setEditShoe] = useState('');
  const [editColors, setEditColors] = useState('');
  const [editAllergies, setEditAllergies] = useState('');
  const [editTreats, setEditTreats] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Lightbox for gift/profile photos
  const [lightbox, setLightbox] = useState<{ uri: string; title: string } | null>(null);

  // Surprise mode composer
  const [surpriseInput, setSurpriseInput] = useState('');
  const [isIdea, setIsIdea] = useState(false);

  // Reserve note modal
  const [reserveTarget, setReserveTarget] = useState<WishlistItem | null>(null);
  const [reserveNote, setReserveNote] = useState('');

  // Group gift modal
  const [groupGiftTarget, setGroupGiftTarget] = useState<WishlistItem | null>(null);
  const [groupGiftNote, setGroupGiftNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isSelf = memberId === currentUser.id;
  const isAdmin = currentUser.role === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const detail = await api.getMemberDetail(memberId);
      setMember(detail.member);
      setWishlist(detail.wishlist);

      // Fill edit form if self
      setEditAvatarImg(detail.member.avatarImageUrl || '');
      setEditJob(detail.member.jobTitle || '');
      setEditBirth(detail.member.birthDate || '');
      setEditAnniv(detail.member.workAnniversary || '');
      setEditShirt(detail.member.shirtSize || '');
      setEditShoe(detail.member.shoeSize || '');
      setEditColors(detail.member.favoriteColors || '');
      setEditAllergies(detail.member.allergies || '');
      setEditTreats(detail.member.favoriteTreats || '');
      setEditNotes(detail.member.hobbiesNotes || '');

      if (!detail.member.isSelf && detail.member.canAccessSurpriseMode) {
        const s = await api.getSurpriseMessages(memberId);
        setSurpriseMsgs(s.messages);
      } else {
        setSurpriseMsgs([]);
      }
    } catch (e: any) {
      setError(e.message || 'Error al cargar perfil');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddWish() {
    if (!wishTitle.trim()) return;
    setSaving(true);
    try {
      const { item } = await api.addWishlistItem({
        title: wishTitle.trim(),
        description: wishDesc.trim(),
        url: wishUrl.trim(),
        imageUrl: wishImageUrl.trim(),
        estimatedPrice: wishPrice.trim(),
        priority: wishPriority,
      });
      setWishlist((prev) => [item, ...prev]);
      setWishTitle('');
      setWishDesc('');
      setWishUrl('');
      setWishImageUrl('');
      setWishPrice('');
      setWishModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWish(itemId: string) {
    await api.deleteWishlistItem(itemId);
    setWishlist((prev) => prev.filter((i) => i.id !== itemId));
  }

  async function handleConfirmReserve(item: WishlistItem, note = '') {
    setSaving(true);
    setError('');
    try {
      const { item: updated } = await api.toggleReserveWishlistItem(memberId, item.id, note);
      setWishlist((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setReserveTarget(null);
      setReserveNote('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSetGroupGift(item: WishlistItem, enabled: boolean, note = '') {
    setSaving(true);
    setError('');
    try {
      await api.toggleGroupGift(memberId, item.id, { enabled, note });
      // Reload wishlist because selecting a new group gift unselects any previous one cleanly
      const refreshed = await api.getMemberDetail(memberId);
      setWishlist(refreshed.wishlist);
      setGroupGiftTarget(null);
      setGroupGiftNote('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleJoinGroupGift(item: WishlistItem) {
    setSaving(true);
    setError('');
    try {
      const { item: updated } = await api.toggleJoinGroupGift(memberId, item.id);
      setWishlist((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSendSurprise() {
    if (!surpriseInput.trim()) return;
    setSaving(true);
    try {
      const { message } = await api.postSurpriseMessage(memberId, {
        message: surpriseInput.trim(),
        isIdea,
      });
      setSurpriseMsgs((prev) => [...prev, message]);
      setSurpriseInput('');
      setIsIdea(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      const { member: updated } = await api.updateMyProfile({
        avatarImageUrl: editAvatarImg,
        jobTitle: editJob.trim(),
        birthDate: editBirth.trim(),
        workAnniversary: editAnniv.trim() || null,
        shirtSize: editShirt.trim(),
        shoeSize: editShoe.trim(),
        favoriteColors: editColors.trim(),
        allergies: editAllergies.trim(),
        favoriteTreats: editTreats.trim(),
        hobbiesNotes: editNotes.trim(),
      });
      setMember((prev) => (prev ? { ...prev, ...updated } : updated));
      onProfileUpdated?.(updated);
      setEditOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!member) {
    return (
      <View style={styles.centered}>
        <Text>{error || 'Perfil no encontrado'}</Text>
        <Button title="Volver" onPress={onBack} style={{ marginTop: 12 }} />
      </View>
    );
  }

  const hasAllergy = Boolean(member.allergies && member.allergies.toLowerCase() !== 'ninguna');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Volver</Text>
      </TouchableOpacity>

      {/* Profile Hero */}
      <Card style={styles.profileHero}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            disabled={!member.avatarImageUrl}
            onPress={() =>
              member.avatarImageUrl &&
              setLightbox({ uri: member.avatarImageUrl, title: member.name })
            }
          >
            <Avatar
              emoji={member.avatarEmoji}
              color={member.avatarColor}
              imageUrl={member.avatarImageUrl}
              size={64}
            />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.name}>{member.name}</Text>
            <Text style={styles.job}>
              {member.jobTitle || 'Miembro del equipo'}
              {member.department ? ` · ${member.department}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <Badge
                label={`🎂 ${formatFriendlyDate(member.birthDate)} (${formatCountdown(member.daysUntilBirthday)})`}
                color={COLORS.primaryDark}
                bg={COLORS.primaryLight}
              />
            </View>
          </View>
        </View>

        {hasAllergy && (
          <View style={styles.allergyAlert}>
            <Text style={styles.allergyAlertText}>
              ⚠️ Alergias importantes: {member.allergies}
            </Text>
          </View>
        )}

        {isSelf && (
          <Button
            title="✏️ Editar mi perfil, tallas y alergias"
            variant="outline"
            small
            onPress={() => setEditOpen(true)}
            style={{ marginTop: 12 }}
          />
        )}
      </Card>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={{ color: COLORS.danger, fontSize: 13, fontWeight: '700' }}>⚠️ {error}</Text>
        </View>
      ) : null}

      {/* Tabs: Wishlist | Gustos y Tallas | Modo Sorpresa (ONLY for colleagues!) */}
      <View style={styles.tabs}>
        <TouchableOpacity
          onPress={() => setActiveTab('wishlist')}
          style={[styles.tab, activeTab === 'wishlist' && styles.tabActive]}
        >
          <Text
            numberOfLines={1}
            style={[styles.tabText, activeTab === 'wishlist' && styles.tabTextActive]}
          >
            🎁 Regalos ({wishlist.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('profile')}
          style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
        >
          <Text
            numberOfLines={1}
            style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}
          >
            👕 Gustos
          </Text>
        </TouchableOpacity>

        {!isSelf && member.canAccessSurpriseMode && (
          <TouchableOpacity
            onPress={() => setActiveTab('surprise')}
            style={[styles.tab, activeTab === 'surprise' && styles.tabActiveSurprise]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.tabText,
                activeTab === 'surprise' && { color: '#FFFFFF' },
              ]}
            >
              🤫 Sorpresa ({surpriseMsgs.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* TAB 1: WISHLIST */}
      {activeTab === 'wishlist' && (
        <View style={{ gap: 10 }}>
          {isSelf ? (
            <View style={styles.privacyBanner}>
              <Text style={styles.privacyBannerText}>
                🔒 Tus compañeros pueden marcar regalos como "reservados" en secreto para evitar
                regalos repetidos sin arruinarte la sorpresa.
              </Text>
              <Button title="+ Agregar deseo" small onPress={() => setWishModalOpen(true)} />
            </View>
          ) : (
            <View style={styles.colleagueBanner}>
              <Text style={styles.colleagueBannerText}>
                🤫 Aquí pueden elegir cuál será el <Text style={{ fontWeight: '800' }}>Regalo Grupal</Text> o reservar un regalo individual. {member.name.split(' ')[0]} NO podrá ver ninguna selección.
              </Text>
            </View>
          )}

          {wishlist.length === 0 ? (
            <EmptyState
              emoji="🎁"
              title="Lista de deseos vacía"
              description={
                isSelf
                  ? 'Agrega links, ideas o regalos que te encantarían recibir.'
                  : `${member.name.split(' ')[0]} aún no ha agregado regalos a su wishlist.`
              }
            />
          ) : (
            wishlist.map((item) => {
              const prioLabel =
                item.priority === 'HIGH'
                  ? '🔥 Muy deseado'
                  : item.priority === 'LOW'
                  ? '💡 Idea extra'
                  : '⭐ Me gustaría';
              return (
                <Card
                  key={item.id}
                  style={
                    !isSelf && item.isGroupGift
                      ? styles.groupGiftCard
                      : item.isReserved
                      ? styles.reservedCard
                      : undefined
                  }
                >
                  {!isSelf && item.isGroupGift && (
                    <View style={styles.groupGiftRibbon}>
                      <Text style={styles.groupGiftRibbonText}>
                        👥 REGALO GRUPAL SELECCIONADO
                      </Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Badge label={prioLabel} color={COLORS.secondary} bg={COLORS.surfaceMuted} />
                    {item.estimatedPrice ? (
                      <Text style={styles.price}>{item.estimatedPrice}</Text>
                    ) : null}
                  </View>

                  <Text style={styles.wishTitle}>{item.title}</Text>
                  {item.description ? <Text style={styles.wishDesc}>{item.description}</Text> : null}

                  {resolveMediaUrl(item.imageUrl) ? (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setLightbox({ uri: item.imageUrl, title: item.title })}
                    >
                      <Image
                        source={{ uri: resolveMediaUrl(item.imageUrl) || undefined }}
                        style={styles.wishPhoto}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : null}

                  {item.url ? (
                    <TouchableOpacity onPress={() => Linking.openURL(item.url).catch(() => {})}>
                      <Text style={styles.wishLink}>🔗 Ver enlace de referencia →</Text>
                    </TouchableOpacity>
                  ) : null}

                  <View style={styles.wishFooter}>
                    {isSelf ? (
                      <TouchableOpacity onPress={() => handleDeleteWish(item.id)}>
                        <Text style={{ color: COLORS.danger, fontSize: 13, fontWeight: '700' }}>
                          Eliminar de mi lista
                        </Text>
                      </TouchableOpacity>
                    ) : item.isGroupGift ? (
                      <View style={{ flex: 1, gap: 10 }}>
                        {item.groupGiftNote ? (
                          <Text style={styles.groupNoteText}>💬 {item.groupGiftNote}</Text>
                        ) : null}

                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <Text style={styles.groupMetaText}>
                            Participan ({item.groupGiftParticipants.length}):
                          </Text>
                          {item.groupGiftParticipants.map((p) => (
                            <View key={p.id} style={styles.participantChip}>
                              <Text style={styles.participantChipText}>
                                {p.avatarEmoji} {p.name.split(' ')[0]}
                              </Text>
                            </View>
                          ))}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                          <Button
                            title={
                              item.joinedGroupGift
                                ? '✓ Participas (Salir)'
                                : '🙋‍♂️ Sumarme al regalo'
                            }
                            variant={item.joinedGroupGift ? 'outline' : 'secondary'}
                            small
                            style={{ flex: 1 }}
                            onPress={() => handleToggleJoinGroupGift(item)}
                          />
                          <Button
                            title="Quitar grupal"
                            variant="ghost"
                            small
                            onPress={() => handleSetGroupGift(item, false)}
                          />
                        </View>

                        {isAdmin && onScheduleGroupGiftPayment && (
                          <Button
                            title="💵 Programar pago para este regalo grupal"
                            variant="success"
                            small
                            onPress={() =>
                              onScheduleGroupGiftPayment({
                                targetMemberId: member.id,
                                targetMemberName: member.name,
                                wishlistItemId: item.id,
                                giftTitle: item.title,
                              })
                            }
                          />
                        )}
                      </View>
                    ) : item.isReserved ? (
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Badge
                            label={
                              item.reservedByMe
                                ? '✅ Reservado por ti (secreto)'
                                : `🔒 Reservado por ${item.reservedByName}`
                            }
                            color="#065F46"
                            bg={COLORS.successLight}
                          />
                          {item.reservedByMe && (
                            <Button
                              title="Liberar"
                              variant="outline"
                              small
                              onPress={() => handleConfirmReserve(item)}
                            />
                          )}
                        </View>
                        {item.reservedNote ? (
                          <Text style={styles.reservedNote}>Nota: "{item.reservedNote}"</Text>
                        ) : null}
                      </View>
                    ) : (
                      <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
                        <Button
                          title="👥 Regalo grupal"
                          variant="secondary"
                          small
                          style={{ flex: 1 }}
                          onPress={() => {
                            setGroupGiftTarget(item);
                            setGroupGiftNote('');
                          }}
                        />
                        <Button
                          title="🎁 Reservar"
                          variant="outline"
                          small
                          style={{ flex: 1 }}
                          onPress={() => {
                            setReserveTarget(item);
                            setReserveNote('');
                          }}
                        />
                      </View>
                    )}
                  </View>
                </Card>
              );
            })
          )}
        </View>
      )}

      {/* TAB 2: GUSTOS Y TALLAS */}
      {activeTab === 'profile' && (
        <Card style={{ gap: 12 }}>
          <InfoRow icon="👕" label="Talla de ropa" value={member.shirtSize || 'Sin especificar'} />
          <InfoRow icon="👟" label="Talla de calzado" value={member.shoeSize || 'Sin especificar'} />
          <InfoRow icon="🎨" label="Colores favoritos" value={member.favoriteColors || 'Sin especificar'} />
          <InfoRow
            icon="⚠️"
            label="Alergias alimentarias"
            value={member.allergies || 'Ninguna registrada'}
            highlight={hasAllergy}
          />
          <InfoRow icon="🍬" label="Dulces y bebidas favoritos" value={member.favoriteTreats || 'Sin especificar'} />
          <InfoRow icon="✨" label="Hobbies y notas" value={member.hobbiesNotes || 'Sin notas adicionales'} />
          {member.workAnniversary ? (
            <InfoRow
              icon="🏆"
              label="Aniversario laboral"
              value={formatFriendlyDate(member.workAnniversary)}
            />
          ) : null}
        </Card>
      )}

      {/* TAB 3: MODO SORPRESA (Solo visible para compañeros!) */}
      {activeTab === 'surprise' && !isSelf && member.canAccessSurpriseMode && (
        <View style={{ gap: 12 }}>
          <Card style={styles.surpriseBanner}>
            <Text style={styles.surpriseBannerTitle}>🤫 Modo Sorpresa Activo</Text>
            <Text style={styles.surpriseBannerText}>
              {member.name} NO tiene acceso a esta pestaña ni recibe notificaciones de aquí.
              Úsenlo para coordinar el regalo grupal, la torta sorpresa o mensajes secretos.
            </Text>
          </Card>

          {surpriseMsgs.length === 0 ? (
            <EmptyState
              emoji="🤫"
              title="Empieza a planear la sorpresa"
              description={`Escribe la primera idea para sorprender a ${member.name.split(' ')[0]}.`}
            />
          ) : (
            surpriseMsgs.map((msg) => (
              <Card
                key={msg.id}
                style={msg.isIdea ? styles.ideaCard : undefined}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Avatar emoji={msg.author.avatarEmoji} color={msg.author.avatarColor} size={32} />
                  <Text style={styles.msgAuthor}>{msg.author.name}</Text>
                  {msg.isIdea && (
                    <Badge label="💡 Idea de regalo" color="#92400E" bg="#FEF3C7" />
                  )}
                </View>
                <Text style={styles.msgText}>{msg.message}</Text>
              </Card>
            ))
          )}

          {/* Composer */}
          <Card>
            <Input
              label="Coordinar en secreto"
              placeholder={`Escribe una idea o mensaje sobre ${member.name.split(' ')[0]}...`}
              multiline
              value={surpriseInput}
              onChangeText={setSurpriseInput}
            />
            <TouchableOpacity
              onPress={() => setIsIdea(!isIdea)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}
            >
              <View style={[styles.ideaToggle, isIdea && styles.ideaToggleOn]}>
                {isIdea ? <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>✓</Text> : null}
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.secondary }}>
                Destacar como 💡 Idea de regalo / colecta
              </Text>
            </TouchableOpacity>
            <Button
              title="Enviar al muro secreto 🤫"
              variant="secondary"
              loading={saving}
              onPress={handleSendSurprise}
            />
          </Card>
        </View>
      )}

      {/* Modal: Elegir como Regalo Grupal */}
      <ModalSheet
        visible={Boolean(groupGiftTarget)}
        title="Elegir Regalo Grupal"
        onClose={() => setGroupGiftTarget(null)}
      >
        {groupGiftTarget && (
          <View>
            <Text style={styles.modalItemTitle}>👥 {groupGiftTarget.title}</Text>
            <Text style={styles.modalHint}>
              Este regalo quedará destacado como el <Text style={{ fontWeight: '800' }}>Regalo Grupal</Text> para todo el equipo (en secreto: {member.name} NO lo verá) y todos podrán sumarse.
            </Text>
            <Input
              label="Nota para el equipo (opcional)"
              placeholder="Ej. Lo compramos entre todos, cuota aproximada $10"
              value={groupGiftNote}
              onChangeText={setGroupGiftNote}
            />
            <Button
              title="Confirmar como Regalo Grupal 👥"
              variant="secondary"
              loading={saving}
              onPress={() => handleSetGroupGift(groupGiftTarget, true, groupGiftNote)}
            />
          </View>
        )}
      </ModalSheet>

      {/* Modal: Reservar regalo con nota opcional */}
      <ModalSheet
        visible={Boolean(reserveTarget)}
        title="Reservar regalo en secreto"
        onClose={() => setReserveTarget(null)}
      >
        {reserveTarget && (
          <View>
            <Text style={styles.modalItemTitle}>🎁 {reserveTarget.title}</Text>
            <Text style={styles.modalHint}>
              {member.name} NO verá esta reserva. El resto del equipo sabrá que ya está cubierto
              para evitar regalos repetidos.
            </Text>
            <Input
              label="Nota para el equipo (opcional)"
              placeholder="Ej. Lo compro a medias con alguien más..."
              value={reserveNote}
              onChangeText={setReserveNote}
            />
            <Button
              title="Confirmar reserva secreta 🔒"
              variant="success"
              loading={saving}
              onPress={() => handleConfirmReserve(reserveTarget, reserveNote)}
            />
          </View>
        )}
      </ModalSheet>

      {/* Modal: Agregar deseo a mi Wishlist */}
      <ModalSheet
        visible={wishModalOpen}
        title="Agregar a mi Wishlist"
        onClose={() => setWishModalOpen(false)}
      >
        <Input
          label="Nombre del regalo"
          placeholder="Ej. Teclado mecánico, termo, libro..."
          value={wishTitle}
          onChangeText={setWishTitle}
        />
        <ImagePickerField
          label="Foto de referencia del regalo (opcional)"
          placeholder="Subir foto del regalo"
          value={wishImageUrl}
          onChange={setWishImageUrl}
        />
        <Input
          label="Detalles (color, talla, modelo)"
          placeholder="Ej. Color azul marino o negro"
          multiline
          value={wishDesc}
          onChangeText={setWishDesc}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label="Precio aprox." placeholder="Ej. $30" value={wishPrice} onChangeText={setWishPrice} />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Link (opcional)"
              placeholder="https://..."
              autoCapitalize="none"
              value={wishUrl}
              onChangeText={setWishUrl}
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setWishPriority(p)}
              style={[styles.prioChip, wishPriority === p && styles.prioChipActive]}
            >
              <Text style={[styles.prioText, wishPriority === p && { color: '#FFFFFF' }]}>
                {p === 'HIGH' ? '🔥 Top' : p === 'MEDIUM' ? '⭐ Medio' : '💡 Extra'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Button title="Guardar en mi Wishlist 🎁" loading={saving} onPress={handleAddWish} />
      </ModalSheet>

      {/* Modal: Editar mi perfil */}
      <ModalSheet visible={editOpen} title="Editar mi perfil" onClose={() => setEditOpen(false)}>
        <ImagePickerField
          label="Tu foto de perfil"
          placeholder="Subir foto de perfil"
          shape="circle"
          value={editAvatarImg}
          onChange={setEditAvatarImg}
        />
        <Input label="Cargo / Área" value={editJob} onChangeText={setEditJob} />
        <DatePickerField
          label="Fecha de cumpleaños"
          mode="birthday"
          value={editBirth}
          onChange={setEditBirth}
        />
        <DatePickerField
          label="Aniversario laboral (opcional)"
          mode="birthday"
          placeholder="Seleccionar fecha de ingreso..."
          allowClear
          value={editAnniv}
          onChange={setEditAnniv}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label="Talla de ropa" placeholder="S / M / L" value={editShirt} onChangeText={setEditShirt} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Talla de calzado" placeholder="40" value={editShoe} onChangeText={setEditShoe} />
          </View>
        </View>
        <Input label="Colores favoritos" value={editColors} onChangeText={setEditColors} />
        <Input
          label="Alergias alimentarias"
          placeholder="Ej. Maní, lactosa, Ninguna"
          value={editAllergies}
          onChangeText={setEditAllergies}
        />
        <Input label="Dulces / snacks preferidos" value={editTreats} onChangeText={setEditTreats} />
        <Input label="Hobbies / notas" multiline value={editNotes} onChangeText={setEditNotes} />
        <Button title="Guardar cambios" loading={saving} onPress={handleSaveProfile} />
      </ModalSheet>

      <ImageLightboxModal
        uri={lightbox?.uri || null}
        title={lightbox?.title}
        onClose={() => setLightbox(null)}
      />
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <View style={[styles.infoRow, highlight && styles.infoRowAlert]}>
      <Text style={{ fontSize: 20, marginRight: 10 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, highlight && { color: COLORS.danger, fontWeight: '800' }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
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
  profileHero: { marginBottom: 14 },
  name: { fontSize: 19, fontFamily: FONTS.title, letterSpacing: 0.9, color: COLORS.secondary },
  job: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 2 },
  allergyAlert: {
    marginTop: 12,
    backgroundColor: COLORS.dangerLight,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  allergyAlertText: { fontSize: 13, fontWeight: '800', color: COLORS.danger },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceMuted,
    padding: 4,
    borderRadius: 14,
    marginBottom: 14,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary },
  tabActiveSurprise: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.textMuted },
  tabTextActive: { color: COLORS.primary },
  privacyBanner: {
    backgroundColor: COLORS.tealLight,
    borderWidth: 1,
    borderColor: COLORS.teal,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  privacyBannerText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.secondary, lineHeight: 18 },
  colleagueBanner: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 14,
    padding: 12,
  },
  colleagueBannerText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.secondary, lineHeight: 18 },
  reservedCard: { backgroundColor: COLORS.tealLight, borderColor: COLORS.teal },
  groupGiftCard: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  groupGiftRibbon: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  groupGiftRibbonText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontFamily: FONTS.extrabold,
    letterSpacing: 0.6,
  },
  groupNoteText: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.secondary },
  groupMetaText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.secondary },
  participantChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.teal,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  participantChipText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.secondary },
  price: { fontSize: 14, fontWeight: '900', color: COLORS.secondary },
  wishTitle: { fontSize: 16, fontWeight: '800', color: COLORS.secondary },
  wishDesc: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, lineHeight: 19 },
  wishPhoto: {
    width: '100%',
    height: 175,
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: COLORS.surfaceMuted,
  },
  wishLink: { fontSize: 13, fontWeight: '700', color: COLORS.accent, marginTop: 8 },
  wishFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  reservedNote: { fontSize: 12, color: '#047857', marginTop: 6, fontStyle: 'italic' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoRowAlert: {
    backgroundColor: COLORS.dangerLight,
    padding: 10,
    borderRadius: 12,
    borderBottomWidth: 0,
  },
  infoLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  infoValue: { fontSize: 14, color: COLORS.text, marginTop: 2 },
  surpriseBanner: {
    backgroundColor: COLORS.tealLight,
    borderColor: COLORS.teal,
  },
  surpriseBannerTitle: { fontSize: 16, fontFamily: FONTS.title, letterSpacing: 0.8, color: COLORS.secondary },
  surpriseBannerText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.secondary, marginTop: 4, lineHeight: 19 },
  ideaCard: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  msgAuthor: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.secondary, marginLeft: 8, flex: 1 },
  msgText: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.text, lineHeight: 20 },
  ideaToggle: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ideaToggleOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modalItemTitle: { fontSize: 17, fontFamily: FONTS.bold, color: COLORS.secondary, marginBottom: 6 },
  modalHint: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textMuted, lineHeight: 19, marginBottom: 14 },
  prioChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
  },
  prioChipActive: { backgroundColor: COLORS.primary },
  prioText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.secondary },
});

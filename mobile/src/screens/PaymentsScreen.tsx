import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, resolveMediaUrl } from '../api';
import { DatePickerField, ImageLightboxModal, ImagePickerField } from '../components/Pickers';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  ModalSheet,
  SectionHeader,
} from '../components/UI';
import { FONTS, ThemeColors, useTheme, formatCountdown, formatFriendlyDate } from '../theme';
import type { MemberSummary, PaymentSchedule, Space, WishlistItem } from '../types';

export interface PaymentPrefill {
  targetMemberId: string;
  targetMemberName: string;
  wishlistItemId: string;
  giftTitle: string;
}

interface Props {
  space: Space;
  me: MemberSummary;
  initialScheduleId?: string | null;
  onClearInitialSchedule?: () => void;
  prefillPayment?: PaymentPrefill | null;
  onClearPrefill?: () => void;
}

const PAYMENT_METHODS = [
  'Pago Móvil',
  'Transferencia',
  'Zelle',
  'Efectivo',
  'Binance / PayPal',
];

export function PaymentsScreen({
  space,
  me,
  initialScheduleId,
  onClearInitialSchedule,
  prefillPayment,
  onClearPrefill,
}: Props) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [selected, setSelected] = useState<PaymentSchedule | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState('');

  // Admin Create/Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('2026-11-28');
  const [amount, setAmount] = useState('12');
  const [currency, setCurrency] = useState(space.currency || 'USD');
  const [targetMemberId, setTargetMemberId] = useState<string | null>(null);
  const [excludeTarget, setExcludeTarget] = useState(true);
  const [wishlistItemId, setWishlistItemId] = useState<string | null>(null);
  const [targetWishlist, setTargetWishlist] = useState<WishlistItem[]>([]);
  const [buyerMemberId, setBuyerMemberId] = useState<string | null>(me.id);
  const [buyerName, setBuyerName] = useState(me.name);
  const [paymentMethod, setPaymentMethod] = useState('Pago Móvil');
  const [bankName, setBankName] = useState('');
  const [accountOrPhone, setAccountOrPhone] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Member report payment modal
  const [reportOpen, setReportOpen] = useState(false);
  const [reportRef, setReportRef] = useState('');
  const [reportReceiptImg, setReportReceiptImg] = useState('');
  const [reportNote, setReportNote] = useState('');
  const [lightbox, setLightbox] = useState<{ uri: string; title: string } | null>(null);

  const isAdmin = me.role === 'ADMIN';

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [payRes, teamRes] = await Promise.all([api.getPayments(), api.getMembers()]);
      setSchedules(payRes.schedules);
      setMembers(teamRes.members);

      if (initialScheduleId) {
        const found = payRes.schedules.find((s) => s.id === initialScheduleId);
        if (found) setSelected(found);
        onClearInitialSchedule?.();
      } else if (selected) {
        const refreshed = payRes.schedules.find((s) => s.id === selected.id);
        if (refreshed) setSelected(refreshed);
      }
    } finally {
      setRefreshing(false);
    }
  }, [initialScheduleId, onClearInitialSchedule, selected?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Fetch target colleague's wishlist when Admin picks a birthday person in the form
  useEffect(() => {
    let active = true;
    async function loadWishlist() {
      if (!formOpen || !targetMemberId || targetMemberId === me.id) {
        setTargetWishlist([]);
        return;
      }
      try {
        const res = await api.getMemberDetail(targetMemberId);
        if (active) setTargetWishlist(res.wishlist);
      } catch {
        if (active) setTargetWishlist([]);
      }
    }
    loadWishlist();
    return () => {
      active = false;
    };
  }, [formOpen, targetMemberId, me.id]);

  // Open pre-filled payment form when jumping from a Group Gift in a colleague's Wishlist
  useEffect(() => {
    if (prefillPayment && isAdmin) {
      setEditingId(null);
      setTitle(`Regalo grupal: ${prefillPayment.targetMemberName.split(' ')[0]}`);
      setDescription(`Colecta para comprar "${prefillPayment.giftTitle}" entre el equipo.`);
      setDueDate('2026-11-28');
      setAmount('12');
      setCurrency(space.currency || 'USD');
      setTargetMemberId(prefillPayment.targetMemberId);
      setExcludeTarget(true);
      setWishlistItemId(prefillPayment.wishlistItemId);
      setBuyerMemberId(me.id);
      setBuyerName(me.name);
      setPaymentMethod('Pago Móvil');
      setBankName('');
      setAccountOrPhone('');
      setDocumentId('');
      setPaymentNotes('');
      setFormError('');
      setFormOpen(true);
      onClearPrefill?.();
    }
  }, [prefillPayment, isAdmin, me.id, me.name, space.currency, onClearPrefill]);

  function syncSchedule(updated: PaymentSchedule) {
    setSelected(updated);
    setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  function openCreateModal() {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setDueDate('2026-11-28');
    setAmount('12');
    setCurrency(space.currency || 'USD');
    setTargetMemberId(null);
    setExcludeTarget(true);
    setWishlistItemId(null);
    setBuyerMemberId(me.id);
    setBuyerName(me.name);
    setPaymentMethod('Pago Móvil');
    setBankName('');
    setAccountOrPhone('');
    setDocumentId('');
    setPaymentNotes('');
    setFormError('');
    setFormOpen(true);
  }

  function openEditModal(s: PaymentSchedule) {
    setEditingId(s.id);
    setTitle(s.title);
    setDescription(s.description);
    setDueDate(s.dueDate);
    setAmount(String(s.amountPerPerson));
    setCurrency(s.currency);
    setTargetMemberId(s.targetMemberId);
    setExcludeTarget(s.excludeTargetMember);
    setWishlistItemId(s.wishlistItemId || null);
    setBuyerMemberId(s.buyerMemberId);
    setBuyerName(s.buyerName);
    setPaymentMethod(s.paymentMethod);
    setBankName(s.bankName);
    setAccountOrPhone(s.accountOrPhone);
    setDocumentId(s.documentId);
    setPaymentNotes(s.paymentNotes);
    setFormError('');
    setFormOpen(true);
  }

  async function handleSaveSchedule() {
    if (!title.trim() || !dueDate.trim() || !buyerName.trim()) {
      setFormError('Completa el título, la fecha de pago y el nombre de quien realiza la compra.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate.trim(),
        amountPerPerson: Number(amount) || 0,
        currency: currency.trim() || 'USD',
        targetMemberId,
        excludeTargetMember: Boolean(targetMemberId && excludeTarget),
        wishlistItemId: targetMemberId ? wishlistItemId : null,
        buyerMemberId,
        buyerName: buyerName.trim(),
        paymentMethod: paymentMethod.trim(),
        bankName: bankName.trim(),
        accountOrPhone: accountOrPhone.trim(),
        documentId: documentId.trim(),
        paymentNotes: paymentNotes.trim(),
      };

      if (editingId) {
        const { schedule } = await api.updatePayment(editingId, payload);
        syncSchedule(schedule);
      } else {
        const { schedule } = await api.createPayment(payload);
        setSchedules((prev) => [schedule, ...prev]);
        setSelected(schedule);
      }
      setFormOpen(false);
    } catch (e: any) {
      setFormError(e.message || 'No se pudo guardar la fecha de pago.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!selected) return;
    setSaving(true);
    try {
      const nextStatus = selected.status === 'OPEN' ? 'CLOSED' : 'OPEN';
      const { schedule } = await api.updatePayment(selected.id, { status: nextStatus });
      syncSchedule(schedule);
    } finally {
      setSaving(false);
    }
  }

  async function handleReportMyPayment() {
    if (!selected) return;
    setSaving(true);
    try {
      const { schedule } = await api.reportMyPayment(selected.id, {
        reference: reportRef.trim(),
        receiptImageUrl: reportReceiptImg.trim(),
        note: reportNote.trim(),
      });
      syncSchedule(schedule);
      setReportRef('');
      setReportReceiptImg('');
      setReportNote('');
      setReportOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdminSetRecord(
    memberId: string,
    status: 'PENDING' | 'REPORTED' | 'CONFIRMED'
  ) {
    if (!selected) return;
    const { schedule } = await api.updatePaymentRecord(selected.id, memberId, { status });
    syncSchedule(schedule);
  }

  async function handleCopyPaymentDetails(text: string) {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopiedMsg('✅ Datos copiados al portapapeles');
        setTimeout(() => setCopiedMsg(''), 2500);
        return;
      }
      await Share.share({ message: text });
    } catch {
      await Share.share({ message: text }).catch(() => {});
    }
  }

  function handleShareWhatsApp(text: string) {
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`).catch(() => {});
  }

  // ==================== SCHEDULE FORM MODAL (ADMIN) ====================
  const renderFormModal = () => (
    <ModalSheet
      visible={formOpen}
      title={editingId ? 'Editar Fecha de Pago' : 'Nueva Fecha de Pago'}
      onClose={() => setFormOpen(false)}
    >
      {formError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {formError}</Text>
        </View>
      ) : null}

      <Input
        label="Concepto / Cumpleaños"
        placeholder="Ej. Colecta Cumpleaños de Mateo y Sofía"
        value={title}
        onChangeText={setTitle}
      />

      <DatePickerField
        label="Fecha de pago"
        mode="event"
        value={dueDate}
        onChange={setDueDate}
      />

      <View style={styles.row2}>
        <View style={{ flex: 1.4 }}>
          <Input
            label="Monto por persona"
            placeholder="12"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Moneda" placeholder="USD / Bs" value={currency} onChangeText={setCurrency} />
        </View>
      </View>

      <Input
        label="¿Qué cubre este pago? (opcional)"
        placeholder="Torta, globos, regalo grupal..."
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.fieldLabel}>Cumpleañero asociado (opcional)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setTargetMemberId(null)}
            style={[styles.chip, targetMemberId === null && styles.chipActive]}
          >
            <Text style={[styles.chipText, targetMemberId === null && { color: '#FFF' }]}>
              General / Varios
            </Text>
          </TouchableOpacity>
          {members.map((m) => (
            <TouchableOpacity
              key={m.id}
              onPress={() => setTargetMemberId(m.id)}
              style={[styles.chip, targetMemberId === m.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, targetMemberId === m.id && { color: '#FFF' }]}>
                {m.avatarEmoji} {m.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {targetMemberId ? (
        <View>
          <TouchableOpacity
            onPress={() => setExcludeTarget(!excludeTarget)}
            style={styles.checkToggleRow}
          >
            <View style={[styles.checkbox, excludeTarget && styles.checkboxOn]}>
              {excludeTarget ? <Text style={{ color: '#FFF', fontWeight: '900' }}>✓</Text> : null}
            </View>
            <Text style={styles.checkToggleText}>
              Excluir al cumpleañero de esta cuota (no paga su propio festejo)
            </Text>
          </TouchableOpacity>

          {targetWishlist.length > 0 && (
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.fieldLabel}>
                🎁 Elegir Regalo Grupal de su Wishlist (secreto)
              </Text>
              <View style={{ gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setWishlistItemId(null)}
                  style={[styles.giftOption, wishlistItemId === null && styles.giftOptionActive]}
                >
                  <Text style={styles.giftOptionTitle}>Sin regalo específico (solo cuota)</Text>
                </TouchableOpacity>
                {targetWishlist.map((w) => {
                  const active = wishlistItemId === w.id;
                  return (
                    <TouchableOpacity
                      key={w.id}
                      onPress={() => setWishlistItemId(w.id)}
                      style={[styles.giftOption, active && styles.giftOptionActive]}
                    >
                      <Text style={styles.giftOptionTitle}>
                        {active ? '👥 ' : '🎁 '}
                        {w.title} {w.estimatedPrice ? `(${w.estimatedPrice})` : ''}
                      </Text>
                      {w.isGroupGift ? (
                        <Text style={{ fontSize: 11, color: COLORS.accent, fontWeight: '700' }}>
                          Actualmente marcado como regalo grupal
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.divider} />
      <Text style={styles.sectionMini}>🛍️ Datos de quien realizará la compra</Text>

      <Text style={styles.fieldLabel}>Seleccionar compañero responsable</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {members.map((m) => {
            const active = buyerMemberId === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => {
                  setBuyerMemberId(m.id);
                  setBuyerName(m.name);
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && { color: '#FFF' }]}>
                  {m.avatarEmoji} {m.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Input
        label="Nombre completo de quien hace la compra"
        placeholder="Ej. Camila Rojas"
        value={buyerName}
        onChangeText={setBuyerName}
      />

      <Text style={styles.fieldLabel}>Método de pago</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {PAYMENT_METHODS.map((pm) => {
          const active = paymentMethod === pm;
          return (
            <TouchableOpacity
              key={pm}
              onPress={() => setPaymentMethod(pm)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && { color: '#FFF' }]}>{pm}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <Input
            label="Banco / Entidad"
            placeholder="Ej. Banesco / Chase"
            value={bankName}
            onChangeText={setBankName}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Cédula / ID / Titular"
            placeholder="Ej. V-24.819.302"
            value={documentId}
            onChangeText={setDocumentId}
          />
        </View>
      </View>

      <Input
        label="Teléfono, N° de cuenta o Correo Zelle"
        placeholder="Ej. 0414-555-8290 o correo@banco.com"
        value={accountOrPhone}
        onChangeText={setAccountOrPhone}
      />

      <Input
        label="Instrucciones de pago (opcional)"
        placeholder="Ej. Colocar 'Cumple Nov' en concepto y reportar referencia"
        multiline
        value={paymentNotes}
        onChangeText={setPaymentNotes}
      />

      <Button
        title={editingId ? 'Guardar cambios 💾' : 'Programar fecha de pago 💵'}
        variant="success"
        loading={saving}
        onPress={handleSaveSchedule}
      />
    </ModalSheet>
  );

  // ==================== DETAIL VIEW ====================
  if (selected) {
    const progressPct =
      selected.expectedTotal > 0
        ? Math.min(100, Math.round((selected.collectedTotal / selected.expectedTotal) * 100))
        : 0;

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.bg }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Calendario de Pagos</Text>
        </TouchableOpacity>

        {/* Header Card */}
        <Card style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <Badge
              label={selected.status === 'OPEN' ? '🟢 Colecta abierta' : '🔒 Colecta cerrada'}
              color={selected.status === 'OPEN' ? '#065F46' : COLORS.textMuted}
              bg={selected.status === 'OPEN' ? COLORS.successLight : COLORS.surfaceMuted}
            />
            <Badge
              label={`📅 ${formatFriendlyDate(selected.dueDate)} (${formatCountdown(selected.daysUntil)})`}
              color="#B45309"
              bg="#FEF3C7"
            />
          </View>

          <Text style={styles.detailTitle}>{selected.title}</Text>
          {selected.description ? <Text style={styles.detailDesc}>{selected.description}</Text> : null}

          {selected.groupGift ? (
            <View style={styles.groupGiftBox}>
              <Text style={styles.groupGiftEyebrow}>👥 REGALO GRUPAL ELEGIDO DE SU WISHLIST</Text>
              <Text style={styles.groupGiftName}>
                🎁 {selected.groupGift.title}
                {selected.groupGift.estimatedPrice ? ` · ${selected.groupGift.estimatedPrice}` : ''}
              </Text>
              {selected.groupGift.url ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(selected.groupGift!.url).catch(() => {})}
                >
                  <Text style={styles.groupGiftLink}>🔗 Ver enlace del regalo →</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <View style={styles.amountStrip}>
            <View>
              <Text style={styles.stripLabel}>MONTO POR PERSONA</Text>
              <Text style={styles.stripBig}>
                {selected.currency} {selected.amountPerPerson}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.stripLabel}>RECAUDADO</Text>
              <Text style={[styles.stripBig, { color: COLORS.success }]}>
                {selected.currency} {selected.collectedTotal}
                <Text style={styles.stripOf}> / {selected.expectedTotal}</Text>
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.progressCaption}>
            {selected.confirmedCount} confirmados · {selected.reportedCount} por confirmar ·{' '}
            {selected.pendingCount} pendientes
          </Text>

          {isAdmin && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Button
                title="✏️ Editar fecha/datos"
                variant="outline"
                small
                style={{ flex: 1 }}
                onPress={() => openEditModal(selected)}
              />
              <Button
                title={selected.status === 'OPEN' ? '🔒 Cerrar' : '🔓 Reabrir'}
                variant="ghost"
                small
                onPress={handleToggleStatus}
              />
            </View>
          )}
        </Card>

        {/* Buyer & Bank Details Card */}
        <Card style={styles.buyerCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Avatar
              emoji={selected.buyerMember?.avatarEmoji || '🛍️'}
              color={selected.buyerMember?.avatarColor || COLORS.success}
              size={46}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.buyerEyebrow}>RESPONSABLE DE LA COMPRA</Text>
              <Text style={styles.buyerName}>{selected.buyerName}</Text>
            </View>
            <Badge label={selected.paymentMethod} color={COLORS.secondary} bg="#FFFFFF" />
          </View>

          <View style={styles.bankBox}>
            {selected.bankName ? (
              <BankRow label="Banco / Entidad" value={selected.bankName} />
            ) : null}
            {selected.accountOrPhone ? (
              <BankRow label="Teléfono / Cuenta" value={selected.accountOrPhone} />
            ) : null}
            {selected.documentId ? (
              <BankRow label="Cédula / ID" value={selected.documentId} />
            ) : null}
            <BankRow
              label="Monto exacto"
              value={`${selected.currency} ${selected.amountPerPerson}`}
            />
            {selected.paymentNotes ? (
              <BankRow label="Nota" value={selected.paymentNotes} />
            ) : null}
          </View>

          {copiedMsg ? <Text style={styles.copiedToast}>{copiedMsg}</Text> : null}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button
              title="📋 Copiar datos"
              variant="secondary"
              small
              style={{ flex: 1 }}
              onPress={() => handleCopyPaymentDetails(selected.paymentSummaryText)}
            />
            <Button
              title="💬 WhatsApp"
              variant="success"
              small
              style={{ flex: 1 }}
              onPress={() => handleShareWhatsApp(selected.paymentSummaryText)}
            />
          </View>
        </Card>

        {/* Personal Action CTA */}
        {selected.myRecord && selected.status === 'OPEN' && selected.myRecord.status !== 'CONFIRMED' && (
          <Card style={styles.myActionCard}>
            <Text style={styles.myActionTitle}>
              {selected.myRecord.status === 'REPORTED'
                ? '⏳ Tu pago está reportado y esperando confirmación del Admin'
                : `Tienes un pago pendiente de ${selected.currency} ${selected.myRecord.amount}`}
            </Text>
            <Button
              title={
                selected.myRecord.status === 'REPORTED'
                  ? '✏️ Actualizar referencia de pago'
                  : '✅ Ya pagué · Reportar comprobante'
              }
              variant="primary"
              onPress={() => {
                setReportRef(selected.myRecord?.reference || '');
                setReportReceiptImg(selected.myRecord?.receiptImageUrl || '');
                setReportNote(selected.myRecord?.note || '');
                setReportOpen(true);
              }}
            />
          </Card>
        )}

        {/* Team Payment Status List */}
        <SectionHeader
          title={`Estado de pagos (${selected.confirmedCount}/${selected.totalParticipants})`}
          subtitle={
            isAdmin
              ? 'Como Admin puedes confirmar pagos o marcar pendientes'
              : 'Transparencia de aportes del equipo'
          }
        />

        <View style={{ gap: 10 }}>
          {selected.records.map((rec) => {
            const statusMeta = {
              CONFIRMED: { label: '✓ Confirmado', color: '#065F46', bg: COLORS.successLight },
              REPORTED: { label: '⏳ Por confirmar', color: '#92400E', bg: COLORS.warningLight },
              PENDING: { label: 'Pendiente', color: COLORS.textMuted, bg: COLORS.surfaceMuted },
            }[rec.status];

            const receiptUri = resolveMediaUrl(rec.receiptImageUrl);
            return (
              <Card key={rec.memberId} style={styles.recordCard}>
                <Avatar
                  emoji={rec.avatarEmoji}
                  color={rec.avatarColor}
                  imageUrl={rec.avatarImageUrl}
                  size={40}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.recName}>
                    {rec.memberName} {rec.memberId === me.id ? '(Tú)' : ''}
                  </Text>
                  <Text style={styles.recMeta}>
                    {selected.currency} {rec.amount}
                    {rec.reference ? ` · Ref: ${rec.reference}` : ''}
                  </Text>
                  {rec.note ? <Text style={styles.recNote}>"{rec.note}"</Text> : null}
                  {receiptUri ? (
                    <TouchableOpacity
                      onPress={() =>
                        setLightbox({
                          uri: receiptUri,
                          title: `Soporte de pago · ${rec.memberName}`,
                        })
                      }
                      style={styles.receiptPill}
                    >
                      <Image source={{ uri: receiptUri }} style={styles.receiptThumb} />
                      <Text style={styles.receiptPillText}>🖼️ Ver soporte</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Badge label={statusMeta.label} color={statusMeta.color} bg={statusMeta.bg} />
                  {isAdmin && (
                    <TouchableOpacity
                      onPress={() =>
                        handleAdminSetRecord(
                          rec.memberId,
                          rec.status === 'CONFIRMED' ? 'PENDING' : 'CONFIRMED'
                        )
                      }
                    >
                      <Text style={styles.adminToggleText}>
                        {rec.status === 'CONFIRMED'
                          ? 'Marcar pendiente'
                          : rec.status === 'REPORTED'
                          ? '✓ Confirmar pago'
                          : 'Marcar pagado'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            );
          })}
        </View>

        {/* Modal: Report my payment */}
        <ModalSheet
          visible={reportOpen}
          title="Reportar mi pago"
          onClose={() => setReportOpen(false)}
        >
          <Text style={styles.reportHint}>
            Pago a <Text style={{ fontWeight: '800' }}>{selected.buyerName}</Text> ({selected.paymentMethod}) por{' '}
            <Text style={{ fontWeight: '800' }}>
              {selected.currency} {selected.amountPerPerson}
            </Text>
            .
          </Text>
          <Input
            label="Número de referencia / comprobante"
            placeholder="Ej. #492018"
            value={reportRef}
            onChangeText={setReportRef}
          />
          <ImagePickerField
            label="Soporte / captura del pago (imagen)"
            placeholder="Adjuntar foto o captura del pago"
            value={reportReceiptImg}
            onChange={setReportReceiptImg}
          />
          <Input
            label="Nota (opcional)"
            placeholder="Ej. Transferido desde Mercantil"
            value={reportNote}
            onChangeText={setReportNote}
          />
          <Button
            title="Enviar reporte de pago ✅"
            variant="success"
            loading={saving}
            onPress={handleReportMyPayment}
          />
        </ModalSheet>

        {renderFormModal()}
        <ImageLightboxModal
          uri={lightbox?.uri || null}
          title={lightbox?.title}
          onClose={() => setLightbox(null)}
        />
      </ScrollView>
    );
  }

  // ==================== LIST VIEW ====================
  const openSchedules = schedules.filter((s) => s.status === 'OPEN');
  const myPendingCount = openSchedules.filter(
    (s) => s.myRecord && s.myRecord.status === 'PENDING'
  ).length;
  const totalCollectedAll = openSchedules.reduce((sum, s) => sum + s.collectedTotal, 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Summary */}
      <Card style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>CALENDARIO DE PAGOS · CUMPLEAÑOS</Text>
        <Text style={styles.heroTitle}>
          {myPendingCount > 0
            ? `Tienes ${myPendingCount} ${myPendingCount === 1 ? 'pago pendiente' : 'pagos pendientes'}`
            : '¡Estás al día con las colectas! 🎉'}
        </Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatText}>📅 {openSchedules.length} colectas activas</Text>
          </View>
          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatText}>
              💰 {space.currency} {totalCollectedAll} recaudados
            </Text>
          </View>
        </View>
      </Card>

      <SectionHeader
        title="Fechas de pago programadas"
        subtitle="Montos y datos bancarios de quien realiza la compra"
        right={
          isAdmin ? (
            <Button title="+ Programar" small onPress={openCreateModal} />
          ) : (
            <Badge label="Admin programa" color={COLORS.textMuted} bg={COLORS.surfaceMuted} />
          )
        }
      />

      {schedules.length === 0 ? (
        <EmptyState
          emoji="💵"
          title="Aún no hay fechas de pago"
          description="El administrador puede programar fechas de pago para los cumpleaños, indicar el monto y los datos de quien realizará la compra."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {schedules.map((s) => {
            const pct =
              s.expectedTotal > 0 ? Math.round((s.collectedTotal / s.expectedTotal) * 100) : 0;
            const myStatus = s.myRecord?.status;
            return (
              <TouchableOpacity
                key={s.id}
                activeOpacity={0.85}
                onPress={() => setSelected(s)}
              >
                <Card style={s.status === 'CLOSED' ? { opacity: 0.72 } : undefined}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <Badge
                      label={`📅 ${formatFriendlyDate(s.dueDate)} · ${formatCountdown(s.daysUntil)}`}
                      color="#065F46"
                      bg={COLORS.successLight}
                    />
                    <Text style={styles.cardAmount}>
                      {s.currency} {s.amountPerPerson}
                    </Text>
                  </View>

                  <Text style={styles.cardTitle}>{s.title}</Text>

                  {s.groupGift ? (
                    <Text style={styles.cardGroupGift}>
                      👥 Regalo grupal: {s.groupGift.title}
                      {s.groupGift.estimatedPrice ? ` (${s.groupGift.estimatedPrice})` : ''}
                    </Text>
                  ) : null}

                  <View style={styles.buyerMiniRow}>
                    <Text style={styles.buyerMiniText}>
                      🛍️ Compra: <Text style={{ fontWeight: '800' }}>{s.buyerName}</Text> ·{' '}
                      {s.paymentMethod}
                      {s.bankName ? ` (${s.bankName})` : ''}
                    </Text>
                  </View>

                  <View style={[styles.progressTrack, { marginTop: 10 }]}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.cardFooterText}>
                      ✅ {s.confirmedCount}/{s.totalParticipants} pagados ({s.currency}{' '}
                      {s.collectedTotal}/{s.expectedTotal})
                    </Text>
                    {myStatus === 'CONFIRMED' ? (
                      <Text style={[styles.myStatusTag, { color: COLORS.success }]}>✓ Pagaste</Text>
                    ) : myStatus === 'REPORTED' ? (
                      <Text style={[styles.myStatusTag, { color: COLORS.warning }]}>
                        ⏳ Reportado
                      </Text>
                    ) : myStatus === 'PENDING' ? (
                      <Text style={[styles.myStatusTag, { color: COLORS.primary }]}>
                        Pagar →
                      </Text>
                    ) : (
                      <Text style={[styles.myStatusTag, { color: COLORS.textMuted }]}>
                        Exento 🎂
                      </Text>
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {renderFormModal()}
    </ScrollView>
  );
}

function BankRow({ label, value }: { label: string; value: string }) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <View style={styles.bankRow}>
      <Text style={styles.bankLabel}>{label}</Text>
      <Text style={styles.bankValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 28 },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  heroEyebrow: {
    fontSize: 10.5,
    fontFamily: FONTS.bold,
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 19,
    fontFamily: FONTS.title,
    letterSpacing: 0.9,
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  heroStatPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroStatText: { color: '#FFFFFF', fontSize: 12, fontFamily: FONTS.bold },
  cardAmount: { fontSize: 18, fontFamily: FONTS.extrabold, color: COLORS.secondary },
  cardTitle: { fontSize: 16.5, fontFamily: FONTS.bold, color: COLORS.secondary },
  buyerMiniRow: {
    marginTop: 6,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  buyerMiniText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.text },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 999 },
  progressCaption: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 6 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cardFooterText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.textMuted },
  myStatusTag: { fontSize: 12, fontFamily: FONTS.extrabold },
  backBtn: {
    marginBottom: 10,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
  },
  backBtnText: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.primaryDark },
  detailTitle: {
    fontSize: 19,
    fontFamily: FONTS.title,
    letterSpacing: 0.8,
    color: COLORS.secondary,
    marginTop: 10,
  },
  detailDesc: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textMuted, marginTop: 4, lineHeight: 19 },
  amountStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
    marginBottom: 10,
    padding: 12,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 14,
  },
  stripLabel: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.textLight, letterSpacing: 0.8 },
  stripBig: { fontSize: 20, fontFamily: FONTS.extrabold, color: COLORS.secondary, marginTop: 2 },
  stripOf: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textMuted },
  buyerCard: {
    backgroundColor: COLORS.tealLight,
    borderColor: COLORS.teal,
    marginBottom: 14,
  },
  buyerEyebrow: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.tealDark, letterSpacing: 0.8 },
  buyerName: { fontSize: 16.5, fontFamily: FONTS.extrabold, color: COLORS.secondary },
  bankBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  bankLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  bankValue: { fontSize: 13, fontWeight: '800', color: COLORS.secondary, textAlign: 'right', flex: 1 },
  copiedToast: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  myActionCard: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
    marginBottom: 12,
    gap: 10,
  },
  myActionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.secondary },
  recordCard: { flexDirection: 'row', alignItems: 'center' },
  recName: { fontSize: 14, fontWeight: '800', color: COLORS.secondary },
  recMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  recNote: { fontSize: 11, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 2 },
  receiptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
  },
  receiptThumb: { width: 22, height: 22, borderRadius: 5 },
  receiptPillText: { fontSize: 11.5, fontWeight: '800', color: COLORS.secondary },
  adminToggleText: { fontSize: 12, fontWeight: '800', color: COLORS.accent },
  reportHint: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19, marginBottom: 14 },
  row2: { flexDirection: 'row', gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.secondary, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceMuted,
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.secondary },
  checkToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkToggleText: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.secondary, flex: 1 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  sectionMini: { fontSize: 15, fontFamily: FONTS.title, letterSpacing: 0.8, color: COLORS.secondary, marginBottom: 10 },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.danger },
  giftOption: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  giftOptionActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  giftOptionTitle: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.secondary },
  groupGiftBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  groupGiftEyebrow: { fontSize: 10, fontFamily: FONTS.extrabold, color: COLORS.primaryDark, letterSpacing: 0.7 },
  groupGiftName: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.secondary, marginTop: 3 },
  groupGiftLink: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primaryDark, marginTop: 6 },
  cardGroupGift: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: COLORS.primaryDark,
    marginTop: 4,
  },
});

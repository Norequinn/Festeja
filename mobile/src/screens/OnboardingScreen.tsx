import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api';
import { DatePickerField } from '../components/Pickers';
import { Badge, Button, Card, Input } from '../components/UI';
import { FONTS, ThemeColors, useTheme } from '../theme';
import type { MemberSummary, Space } from '../types';

interface Props {
  initialJoinCode?: string | null;
  demoMode?: boolean;
  onAuthenticated: (data: { token: string; space: Space; member: MemberSummary }) => void;
}

type Mode = 'join' | 'create' | 'login';

const EMOJIS = ['🎉', '🎂', '🚀', '🎨', '🌟', '⚡', '👑', '🎈', '☕', '🎧'];

export function OnboardingScreen({ initialJoinCode, demoMode = false, onAuthenticated }: Props) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [mode, setMode] = useState<Mode>('join');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Space preview when joining by code/magic link
  const [inviteCode, setInviteCode] = useState(initialJoinCode || '');
  const [spacePreview, setSpacePreview] = useState<{
    name: string;
    description: string;
    memberCount: number;
  } | null>(null);

  // Join fields
  const [joinName, setJoinName] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  const [joinPin, setJoinPin] = useState('');
  const [joinJob, setJoinJob] = useState('');
  const [joinBirthDate, setJoinBirthDate] = useState('1996-08-15');
  const [joinShirt, setJoinShirt] = useState('M');
  const [joinColors, setJoinColors] = useState('');
  const [joinAllergies, setJoinAllergies] = useState('');
  const [joinTreats, setJoinTreats] = useState('');
  const [emoji, setEmoji] = useState('🎉');

  // Create space fields
  const [spaceName, setSpaceName] = useState('');
  const [spaceDesc, setSpaceDesc] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [reminderDays, setReminderDays] = useState('7');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [adminBirthDate, setAdminBirthDate] = useState('1994-06-20');

  // Login fields
  const [loginCode, setLoginCode] = useState(initialJoinCode || '');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPin, setLoginPin] = useState('');

  useEffect(() => {
    if (initialJoinCode) {
      setInviteCode(initialJoinCode);
      setMode('join');
      lookupSpace(initialJoinCode);
    }
  }, [initialJoinCode]);

  async function lookupSpace(codeToCheck?: string) {
    const code = (codeToCheck ?? inviteCode).trim().toUpperCase();
    if (code.length < 3) return;
    setError('');
    try {
      const preview = await api.previewSpace(code);
      setSpacePreview(preview);
    } catch (e: any) {
      setSpacePreview(null);
      setError(e.message || 'Código no encontrado');
    }
  }

  async function handleDemo(email?: string) {
    setLoading(true);
    setError('');
    try {
      const res = await api.loginDemo(email);
      onAuthenticated(res);
    } catch (e: any) {
      setError(e.message || 'No se pudo conectar con el servidor API (localhost:4000).');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (
      !demoMode &&
      (!inviteCode.trim() || !joinName.trim() || !joinEmail.trim() || joinPin.trim().length < 4)
    ) {
      setError('Completa código de espacio, nombre, correo y un PIN de al menos 4 dígitos.');
      return;
    }

    const rand = Math.floor(100 + Math.random() * 900);
    const finalCode = inviteCode.trim().toUpperCase() || 'VEP-2026';
    const finalName = joinName.trim() || `Invitado Prueba ${rand}`;
    const finalEmail = joinEmail.trim() || `prueba${rand}@vepagos.com`;
    const finalPin = joinPin.trim().length >= 4 ? joinPin.trim() : '1234';
    const finalBirth = /^\d{4}-\d{2}-\d{2}$/.test(joinBirthDate.trim())
      ? joinBirthDate.trim()
      : '1996-08-15';

    setLoading(true);
    setError('');
    try {
      const res = await api.joinSpace({
        inviteCode: finalCode,
        name: finalName,
        email: finalEmail,
        pin: finalPin,
        jobTitle: joinJob.trim() || (demoMode ? 'Tester' : ''),
        birthDate: finalBirth,
        shirtSize: joinShirt.trim(),
        favoriteColors: joinColors.trim(),
        allergies: joinAllergies.trim(),
        favoriteTreats: joinTreats.trim(),
        avatarEmoji: emoji,
      });
      onAuthenticated(res);
    } catch (e: any) {
      setError(e.message || 'No se pudo unir al espacio');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSpace() {
    if (
      !demoMode &&
      (!spaceName.trim() || !adminName.trim() || !adminEmail.trim() || adminPin.trim().length < 4)
    ) {
      setError('Completa el nombre de la empresa, tu nombre, correo y PIN (mínimo 4 caracteres).');
      return;
    }

    const rand = Math.floor(100 + Math.random() * 900);
    const finalSpaceName = spaceName.trim() || `Oficina Prueba ${rand}`;
    const finalAdminName = adminName.trim() || `Admin Prueba ${rand}`;
    const finalAdminEmail = adminEmail.trim() || `admin${rand}@prueba.com`;
    const finalPin = adminPin.trim().length >= 4 ? adminPin.trim() : '1234';
    const finalBirth = /^\d{4}-\d{2}-\d{2}$/.test(adminBirthDate.trim())
      ? adminBirthDate.trim()
      : '1994-06-20';

    setLoading(true);
    setError('');
    try {
      const res = await api.createSpace({
        spaceName: finalSpaceName,
        description: spaceDesc.trim(),
        customInviteCode: customCode.trim() || undefined,
        reminderDaysBefore: Math.max(1, Number(reminderDays) || 7),
        adminName: finalAdminName,
        adminEmail: finalAdminEmail,
        pin: finalPin,
        birthDate: finalBirth,
        avatarEmoji: emoji,
      });
      onAuthenticated(res);
    } catch (e: any) {
      setError(e.message || 'No se pudo crear el espacio');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (demoMode && !loginEmail.trim() && !loginPin.trim()) {
      return handleDemo();
    }
    if (!loginCode.trim() || !loginEmail.trim() || !loginPin.trim()) {
      setError('Ingresa el código del espacio, tu correo y tu PIN.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.login({
        inviteCode: loginCode.trim().toUpperCase(),
        email: loginEmail.trim(),
        pin: loginPin.trim(),
      });
      onAuthenticated(res);
    } catch (e: any) {
      setError(e.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.logoCard}>
            <Image
              source={require('../../assets/festeja-logo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.tagline}>
            Cumpleaños, wishlists con reserva secreta, temáticas, pagos y Modo Sorpresa para tu equipo.
          </Text>
        </View>

        {/* Demo Quick Access (ONLY visible when ENABLE_DEMO_MODE=true) */}
        {demoMode && (
          <Card style={styles.demoCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Badge label="⚡ MODO PRUEBA RÁPIDA" color={COLORS.secondary} bg={COLORS.secondaryLight} />
              <Text style={styles.demoCode}>Sin llenar datos</Text>
            </View>
            <Text style={styles.demoText}>
              Toca cualquier rol para ingresar al instante al espacio <Text style={{ fontWeight: '800' }}>Vepagos (VEP-2026)</Text>, o deja cualquier formulario vacío y pulsa el botón para entrar con datos automáticos:
            </Text>
            <View style={{ gap: 8 }}>
              <Button
                title="👑 Entrar como Admin (Camila)"
                variant="primary"
                loading={loading}
                onPress={() => handleDemo('camila@vepagos.com')}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  title="🎂 Mateo"
                  variant="outline"
                  small
                  style={{ flex: 1 }}
                  disabled={loading}
                  onPress={() => handleDemo('mateo@vepagos.com')}
                />
                <Button
                  title="✨ Valeria"
                  variant="outline"
                  small
                  style={{ flex: 1 }}
                  disabled={loading}
                  onPress={() => handleDemo('valeria@vepagos.com')}
                />
              </View>
            </View>
          </Card>
        )}

        {/* Mode Switcher */}
        <View style={styles.tabs}>
          {(
            [
              { key: 'join', label: 'Unirme' },
              { key: 'create', label: 'Crear Espacio' },
              { key: 'login', label: 'Ya tengo cuenta' },
            ] as const
          ).map((t) => {
            const active = mode === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => {
                  setMode(t.key);
                  setError('');
                }}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        <Card>
          {mode === 'join' && (
            <View>
              <Text style={styles.cardTitle}>Unirme con código de invitación</Text>
              <Text style={styles.cardHint}>
                Pide el código (ej. VEP-2026) o abre el enlace mágico compartido por WhatsApp.
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Código de acceso"
                    placeholder="Ej. OFI-2026"
                    autoCapitalize="characters"
                    value={inviteCode}
                    onChangeText={setInviteCode}
                  />
                </View>
                <View style={{ marginBottom: 12 }}>
                  <Button
                    title="Verificar"
                    variant="outline"
                    small
                    onPress={() => lookupSpace()}
                  />
                </View>
              </View>

              {spacePreview ? (
                <View style={styles.previewBox}>
                  <Text style={styles.previewTitle}>🏢 {spacePreview.name}</Text>
                  <Text style={styles.previewSub}>
                    {spacePreview.memberCount} personas celebrando aquí
                    {spacePreview.description ? ` · ${spacePreview.description}` : ''}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.emojiLabel}>Elige tu avatar</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {EMOJIS.map((em) => (
                    <TouchableOpacity
                      key={em}
                      onPress={() => setEmoji(em)}
                      style={[styles.emojiChip, emoji === em && styles.emojiChipActive]}
                    >
                      <Text style={{ fontSize: 22 }}>{em}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Input label="Tu nombre completo" placeholder="Ej. Carla Pérez" value={joinName} onChangeText={setJoinName} />
              <Input
                label="Correo"
                placeholder="carla@empresa.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={joinEmail}
                onChangeText={setJoinEmail}
              />
              <Input
                label="PIN de acceso"
                placeholder="4+ dígitos"
                secureTextEntry
                value={joinPin}
                onChangeText={setJoinPin}
              />
              <DatePickerField
                label="Fecha de cumpleaños"
                mode="birthday"
                value={joinBirthDate}
                onChange={setJoinBirthDate}
              />

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Input label="Cargo / Área" placeholder="Ej. Diseño" value={joinJob} onChangeText={setJoinJob} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Talla de ropa" placeholder="S / M / L" value={joinShirt} onChangeText={setJoinShirt} />
                </View>
              </View>

              <Input
                label="Alergias alimentarias (¡salva vidas!)"
                placeholder="Ej. Maní, lactosa o Ninguna"
                value={joinAllergies}
                onChangeText={setJoinAllergies}
              />
              <Input
                label="Dulces / snacks y colores favoritos"
                placeholder="Ej. Chocolate oscuro, azul marino"
                value={joinTreats}
                onChangeText={(v) => {
                  setJoinTreats(v);
                  setJoinColors(v);
                }}
              />

              <Button
                title={demoMode ? 'Crear mi perfil y entrar 🎉 (o sin llenar)' : 'Crear mi perfil y entrar 🎉'}
                loading={loading}
                onPress={handleJoin}
                style={{ marginTop: 6 }}
              />
            </View>
          )}

          {mode === 'create' && (
            <View>
              <Text style={styles.cardTitle}>Crear nuevo espacio de empresa</Text>
              <Text style={styles.cardHint}>
                Serás el Administrador: podrás crear eventos, moderar temáticas y compartir el código.
              </Text>

              <Input
                label="Nombre de la empresa / oficina"
                placeholder="Ej. Vepagos, Oficina Norte..."
                value={spaceName}
                onChangeText={setSpaceName}
              />
              <Input
                label="Descripción corta (opcional)"
                placeholder="Celebraciones del equipo de producto"
                value={spaceDesc}
                onChangeText={setSpaceDesc}
              />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Código (opcional)"
                    placeholder="Ej. OFI-2026"
                    autoCapitalize="characters"
                    value={customCode}
                    onChangeText={setCustomCode}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Avisar días antes"
                    placeholder="7"
                    keyboardType="numeric"
                    value={reminderDays}
                    onChangeText={setReminderDays}
                  />
                </View>
              </View>

              <View style={styles.divider} />
              <Text style={styles.subSection}>Tu perfil de Administrador</Text>
              <Input label="Tu nombre" placeholder="Ej. Camila Rojas" value={adminName} onChangeText={setAdminName} />
              <Input
                label="Tu correo"
                placeholder="admin@empresa.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={adminEmail}
                onChangeText={setAdminEmail}
              />
              <Input
                label="PIN de acceso"
                placeholder="4+ dígitos"
                secureTextEntry
                value={adminPin}
                onChangeText={setAdminPin}
              />
              <DatePickerField
                label="Tu cumpleaños"
                mode="birthday"
                value={adminBirthDate}
                onChange={setAdminBirthDate}
              />

              <Button
                title={demoMode ? 'Crear espacio ✨ (o de prueba sin llenar)' : 'Crear espacio y generar código ✨'}
                loading={loading}
                onPress={handleCreateSpace}
                style={{ marginTop: 6 }}
              />
            </View>
          )}

          {mode === 'login' && (
            <View>
              <Text style={styles.cardTitle}>Iniciar sesión</Text>
              <Text style={styles.cardHint}>
                {demoMode
                  ? 'En el espacio demo VEP-2026 puedes entrar con camila@vepagos.com o mateo@vepagos.com (PIN: 1234).'
                  : 'Ingresa con el código de tu espacio, tu correo electrónico y tu PIN.'}
              </Text>
              <Input
                label="Código del espacio"
                placeholder="Ej. OFI-2026"
                autoCapitalize="characters"
                value={loginCode}
                onChangeText={setLoginCode}
              />
              <Input
                label="Correo electrónico"
                placeholder="tu@empresa.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={loginEmail}
                onChangeText={setLoginEmail}
              />
              <Input
                label="PIN"
                placeholder="Tu PIN"
                secureTextEntry
                value={loginPin}
                onChangeText={setLoginPin}
              />
              <Button
                title={demoMode ? 'Entrar (o entrar al demo sin llenar)' : 'Entrar'}
                loading={loading}
                onPress={handleLogin}
                style={{ marginTop: 6 }}
              />
            </View>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 40,
    width: '100%',
  },
  hero: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  logoCard: {
    width: 146,
    height: 146,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginBottom: 10,
    shadowColor: '#0C1C31',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  tagline: {
    fontSize: 13.5,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 340,
  },
  demoCard: {
    backgroundColor: COLORS.tealLight,
    borderColor: COLORS.teal,
    marginBottom: 16,
  },
  demoCode: {
    marginLeft: 10,
    fontSize: 12.5,
    fontFamily: FONTS.bold,
    color: COLORS.secondary,
  },
  demoText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    lineHeight: 19,
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceMuted,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 12.5,
    fontFamily: FONTS.bold,
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontFamily: FONTS.semibold,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: FONTS.title,
    letterSpacing: 0.8,
    color: COLORS.secondary,
  },
  cardHint: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  previewBox: {
    backgroundColor: COLORS.successLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#065F46',
  },
  previewSub: {
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
  },
  emojiLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  row2: {
    flexDirection: 'row',
    gap: 10,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  subSection: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.secondary,
    marginBottom: 10,
  },
});

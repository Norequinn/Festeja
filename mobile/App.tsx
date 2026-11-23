import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
} from '@expo-google-fonts/montserrat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { api, getPublicInviteUrl, getPublicWhatsappText, setApiToken } from './src/api';
import { InstallAppBanner } from './src/components/InstallAppBanner';
import { Button, ModalSheet } from './src/components/UI';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { EventsScreen } from './src/screens/EventsScreen';
import { HomeWallScreen } from './src/screens/HomeWallScreen';
import { MemberDetailScreen } from './src/screens/MemberDetailScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PaymentPrefill, PaymentsScreen } from './src/screens/PaymentsScreen';
import { TeamScreen } from './src/screens/TeamScreen';
import { FONTS, ThemeColors, ThemeProvider, useTheme } from './src/theme';
import type { MemberSummary, Space } from './src/types';

const TOKEN_KEY = 'festeja_session_token_v1';

type TabKey = 'home' | 'chat' | 'agenda' | 'payments' | 'team';

function extractJoinCodeFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    if (typeof parsed.queryParams?.join === 'string' && parsed.queryParams.join.trim()) {
      return parsed.queryParams.join.trim().toUpperCase();
    }
    if (parsed.path && parsed.path.toLowerCase().startsWith('join/')) {
      const code = parsed.path.slice('join/'.length).trim();
      if (code) return code.toUpperCase();
    }
  } catch {
    // ignore invalid URL
  }
  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { colors: COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [fontsLoaded] = useFonts({
    Abang: require('./assets/fonts/Abang.otf'),
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
  });

  const { width } = useWindowDimensions();
  const isWideDesktop = Platform.OS === 'web' && width >= 600;

  const [booting, setBooting] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [space, setSpace] = useState<Space | null>(null);
  const [me, setMe] = useState<MemberSummary | null>(null);
  const [initialJoinCode, setInitialJoinCode] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>('home');
  const [agendaMode, setAgendaMode] = useState<'calendar' | 'events'>('calendar');
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [prefillPayment, setPrefillPayment] = useState<PaymentPrefill | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Mobile-web viewport, color-scheme & orange theme-color protection (prevents browser auto-dark from mutating #FF821C!)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const ensureMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    ensureMeta(
      'viewport',
      'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'
    );
    ensureMeta('color-scheme', 'light dark');
    ensureMeta('theme-color', '#FF821C');

    const styleId = 'festeja-mobile-web-polish';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      :root {
        color-scheme: light dark;
      }
      html, body, #root {
        height: 100%;
        height: 100dvh;
        width: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        overscroll-behavior: none;
        background-color: ${COLORS.bg};
        color: ${COLORS.text};
        font-family: 'Montserrat_400Regular', 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
        -webkit-tap-highlight-color: transparent;
        -webkit-text-size-adjust: 100%;
        forced-color-adjust: none;
      }
      body, input, textarea, button, div, span {
        font-family: 'Montserrat_400Regular', 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      body {
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
        box-sizing: border-box;
      }
    `;
  }, [COLORS.bg, COLORS.text]);

  // Restore session & inspect magic links on startup
  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        // Check initial magic link (web query param ?join=CODE or native festeja://join/CODE)
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const q = params.get('join');
          if (q) setInitialJoinCode(q.trim().toUpperCase());
        } else {
          const initialUrl = await Linking.getInitialURL();
          const code = extractJoinCodeFromUrl(initialUrl);
          if (code) setInitialJoinCode(code);
        }

        api
          .getAuthConfig()
          .then((cfg) => {
            if (mounted) setDemoMode(Boolean(cfg.demoMode));
          })
          .catch(() => {});

        const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
        if (savedToken) {
          setApiToken(savedToken);
          const session = await api.getMe();
          if (mounted) {
            setMe(session.member);
            setSpace(session.space);
          }
        }
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
        setApiToken(null);
      } finally {
        if (mounted) setBooting(false);
      }
    }

    boot();

    const sub = Linking.addEventListener('url', (ev) => {
      const code = extractJoinCodeFromUrl(ev.url);
      if (code) setInitialJoinCode(code);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  async function handleAuthenticated(data: { token: string; space: Space; member: MemberSummary }) {
    setApiToken(data.token);
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    setSpace(data.space);
    setMe(data.member);
    setOpenMemberId(null);
    setTab('home');
  }

  async function handleSwitchDemoUser(email: string) {
    const res = await api.loginDemo(email);
    await handleAuthenticated(res);
  }

  async function handleLogout() {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setApiToken(null);
    setSpace(null);
    setMe(null);
    setOpenMemberId(null);
  }

  function handleOpenEvent(eventId: string) {
    setOpenMemberId(null);
    setPendingEventId(eventId);
    setAgendaMode('events');
    setTab('agenda');
  }

  function handleOpenPayment(scheduleId: string) {
    setOpenMemberId(null);
    setPendingPaymentId(scheduleId);
    setTab('payments');
  }

  function handleScheduleGroupGiftPayment(prefill: PaymentPrefill) {
    setOpenMemberId(null);
    setPrefillPayment(prefill);
    setTab('payments');
  }

  if (booting || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={styles.bootContainer}>
          <Image
            source={require('./assets/festeja-logo.png')}
            style={styles.bootLogo}
            resizeMode="contain"
          />
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={[styles.root, isWideDesktop && styles.rootDesktop]}
        edges={['top', 'bottom']}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={[styles.shell, isWideDesktop && styles.shellDesktop]}>
          <InstallAppBanner />
          {!space || !me ? (
            <OnboardingScreen
              initialJoinCode={initialJoinCode}
              demoMode={demoMode}
              onAuthenticated={handleAuthenticated}
            />
          ) : openMemberId ? (
            <MemberDetailScreen
              memberId={openMemberId}
              currentUser={me}
              onBack={() => setOpenMemberId(null)}
              onProfileUpdated={(updated) => setMe((prev) => (prev ? { ...prev, ...updated } : updated))}
              onScheduleGroupGiftPayment={handleScheduleGroupGiftPayment}
            />
          ) : (
            <>
              <View style={{ flex: 1 }}>
                {tab === 'home' && (
                  <HomeWallScreen
                    space={space}
                    me={me}
                    onOpenMember={(id) => setOpenMemberId(id)}
                    onOpenEvent={handleOpenEvent}
                    onOpenPayment={handleOpenPayment}
                    onOpenInviteModal={() => setInviteModalOpen(true)}
                  />
                )}
                {tab === 'chat' && (
                  <ChatScreen
                    space={space}
                    me={me}
                    onOpenMember={(id) => setOpenMemberId(id)}
                  />
                )}
                {tab === 'agenda' && (
                  <View style={{ flex: 1 }}>
                    <View style={styles.agendaSwitchWrap}>
                      <TouchableOpacity
                        onPress={() => setAgendaMode('calendar')}
                        style={[
                          styles.agendaSwitchBtn,
                          agendaMode === 'calendar' && styles.agendaSwitchBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.agendaSwitchText,
                            agendaMode === 'calendar' && styles.agendaSwitchTextActive,
                          ]}
                        >
                          📅 Calendario
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setAgendaMode('events')}
                        style={[
                          styles.agendaSwitchBtn,
                          agendaMode === 'events' && styles.agendaSwitchBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.agendaSwitchText,
                            agendaMode === 'events' && styles.agendaSwitchTextActive,
                          ]}
                        >
                          🎉 Eventos y Temáticas
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {agendaMode === 'calendar' ? (
                      <CalendarScreen
                        onOpenMember={(id) => setOpenMemberId(id)}
                        onOpenEvent={handleOpenEvent}
                        onOpenPayment={handleOpenPayment}
                      />
                    ) : (
                      <EventsScreen
                        space={space}
                        me={me}
                        initialEventId={pendingEventId}
                        onClearInitialEvent={() => setPendingEventId(null)}
                        onOpenMember={(id) => setOpenMemberId(id)}
                      />
                    )}
                  </View>
                )}
                {tab === 'payments' && (
                  <PaymentsScreen
                    space={space}
                    me={me}
                    initialScheduleId={pendingPaymentId}
                    onClearInitialSchedule={() => setPendingPaymentId(null)}
                    prefillPayment={prefillPayment}
                    onClearPrefill={() => setPrefillPayment(null)}
                  />
                )}
                {tab === 'team' && (
                  <TeamScreen
                    space={space}
                    me={me}
                    demoMode={demoMode}
                    onOpenMember={(id) => setOpenMemberId(id)}
                    onSpaceUpdated={(updated) => setSpace(updated)}
                    onSwitchDemoUser={handleSwitchDemoUser}
                    onLogout={handleLogout}
                  />
                )}
              </View>

              {/* Bottom Tab Bar */}
              <View style={styles.tabBar}>
                {(
                  [
                    { key: 'home', icon: '🏠', label: 'Muro' },
                    { key: 'chat', icon: '💬', label: 'Chat' },
                    { key: 'agenda', icon: '📅', label: 'Agenda' },
                    { key: 'payments', icon: '💵', label: 'Pagos' },
                    { key: 'team', icon: '👥', label: 'Equipo' },
                  ] as const
                ).map((t) => {
                  const active = tab === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      activeOpacity={0.75}
                      onPress={() => setTab(t.key)}
                      style={styles.tabBtn}
                    >
                      <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
                        <Text style={{ fontSize: 19 }}>{t.icon}</Text>
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[styles.tabLabel, active && styles.tabLabelActive]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Quick Invite Modal */}
              <ModalSheet
                visible={inviteModalOpen}
                title={`Invitar a ${space.name}`}
                onClose={() => setInviteModalOpen(false)}
              >
                <Text style={styles.inviteDesc}>
                  Comparte este código o enlace mágico por WhatsApp o correo para que el equipo
                  cree su perfil rápido:
                </Text>
                <View style={styles.codeBox}>
                  <Text style={styles.codeBig}>{space.inviteCode}</Text>
                  <Text style={styles.codeLink} selectable>
                    {getPublicInviteUrl(space.inviteCode, space.magicLinks.webLink)}
                  </Text>
                </View>
                <View style={{ gap: 10 }}>
                  <Button
                    title="💬 Compartir por WhatsApp"
                    variant="success"
                    onPress={() =>
                      Linking.openURL(
                        `https://wa.me/?text=${encodeURIComponent(
                          getPublicWhatsappText(
                            space.name,
                            space.inviteCode,
                            space.magicLinks.webLink
                          )
                        )}`
                      ).catch(() => {})
                    }
                  />
                  <Button
                    title="📤 Compartir invitación"
                    variant="secondary"
                    onPress={() =>
                      Share.share({
                        message: getPublicWhatsappText(
                          space.name,
                          space.inviteCode,
                          space.magicLinks.webLink
                        ),
                      }).catch(() => {})
                    }
                  />
                </View>
              </ModalSheet>
            </>
          )}

          {/* Cintillo institucional de derechos reservados */}
          <View style={styles.copyrightBar}>
            <Text style={styles.copyrightText} numberOfLines={1}>
              © {new Date().getFullYear()} Festeja · Somos3tech, C.A. (J-505477447) · Todos los derechos reservados.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  rootDesktop: {
    backgroundColor: COLORS.bgDesktop,
    paddingVertical: 14,
  },
  bootContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
  },
  bootLogo: {
    width: 150,
    height: 150,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  shell: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.bg,
  },
  shellDesktop: {
    maxWidth: 460,
    alignSelf: 'center',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'web' ? 10 : 6,
    paddingHorizontal: 4,
    minHeight: 62,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  tabIconWrap: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tabIconWrapActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabLabel: {
    fontSize: 10.5,
    fontFamily: FONTS.semibold,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
  agendaSwitchWrap: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 5,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  agendaSwitchBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  agendaSwitchBtnActive: {
    backgroundColor: COLORS.primary,
  },
  agendaSwitchText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.textMuted,
  },
  agendaSwitchTextActive: {
    color: '#FFFFFF',
  },
  inviteDesc: {
    fontSize: 13.5,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginBottom: 14,
  },
  codeBox: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  codeBig: {
    fontSize: 28,
    fontFamily: FONTS.title,
    color: COLORS.secondary,
    letterSpacing: 2.5,
  },
  codeLink: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.tealDark,
    marginTop: 6,
  },
  copyrightBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyrightText: {
    fontSize: 9.5,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
    textAlign: 'center',
  },
});

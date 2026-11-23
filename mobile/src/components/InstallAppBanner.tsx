import React, { useEffect, useMemo, useState } from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FONTS, ThemeColors, useTheme } from '../theme';
import { Button, ModalSheet } from './UI';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallAppBanner() {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Register Service Worker so Android Chrome enables native PWA install prompt
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const standalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      Boolean((window.navigator as any).standalone);

    setIsInstalled(standalone);

    const ua = window.navigator.userAgent || '';
    const ios = /iPhone|iPad|iPod/i.test(ua);
    const inApp = /WhatsApp|FBAN|FBAV|Instagram|Line/i.test(ua);
    setIsIOS(ios);
    setIsInAppBrowser(inApp);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstalled(false);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (Platform.OS !== 'web' || isInstalled || dismissed) {
    return null;
  }

  async function handleInstallClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }
    // Fallback (iPhone Safari, WhatsApp in-app browser, or desktop browser)
    setGuideOpen(true);
  }

  return (
    <>
      <View style={styles.bar}>
        <View style={styles.iconWrap}>
          <Image
            source={require('../../assets/festeja-logo.png')}
            style={styles.icon}
            resizeMode="contain"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            Instalar Festeja en tu teléfono
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {deferredPrompt
              ? 'Acceso directo a pantalla completa'
              : isIOS
              ? 'Agrégala a tu pantalla de inicio en Safari'
              : 'Ábrela como app sin barra de navegador'}
          </Text>
        </View>
        <TouchableOpacity activeOpacity={0.85} onPress={handleInstallClick} style={styles.installBtn}>
          <Text style={styles.installBtnText}>{deferredPrompt ? 'Instalar' : 'Ver cómo'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setDismissed(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeBtn}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ModalSheet
        visible={guideOpen}
        title="Instalar Festeja"
        onClose={() => setGuideOpen(false)}
      >
        {isInAppBrowser ? (
          <View style={styles.stepBox}>
            <Text style={styles.stepTitle}>⚠️ Estás dentro de WhatsApp / navegador interno</Text>
            <Text style={styles.stepDesc}>
              Toca el menú superior (⋮ o Compartir) y selecciona{' '}
              <Text style={{ fontFamily: FONTS.bold }}>"Abrir en Chrome"</Text> o{' '}
              <Text style={{ fontFamily: FONTS.bold }}>"Abrir en Safari"</Text> para poder instalar
              Festeja en tu pantalla de inicio.
            </Text>
          </View>
        ) : isIOS ? (
          <View style={{ gap: 12 }}>
            <View style={styles.stepBox}>
              <Text style={styles.stepTitle}>1. Toca el botón Compartir en Safari</Text>
              <Text style={styles.stepDesc}>
                Es el ícono del cuadrado con una flecha hacia arriba (⬆️) en la barra inferior de
                Safari.
              </Text>
            </View>
            <View style={styles.stepBox}>
              <Text style={styles.stepTitle}>2. Selecciona "Agregar a inicio"</Text>
              <Text style={styles.stepDesc}>
                Desliza hacia abajo en el menú y toca{' '}
                <Text style={{ fontFamily: FONTS.bold }}>"Agregar a inicio" (➕)</Text>, luego pulsa{' '}
                <Text style={{ fontFamily: FONTS.bold }}>"Agregar"</Text>.
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={styles.stepBox}>
              <Text style={styles.stepTitle}>1. Abre el menú de Chrome (⋮)</Text>
              <Text style={styles.stepDesc}>
                Toca los tres puntos en la esquina superior derecha de tu navegador.
              </Text>
            </View>
            <View style={styles.stepBox}>
              <Text style={styles.stepTitle}>2. Toca "Instalar aplicación" o "Añadir a inicio"</Text>
              <Text style={styles.stepDesc}>
                Confirma y verás el ícono de <Text style={{ fontFamily: FONTS.bold }}>Festeja</Text>{' '}
                listo junto a tus demás apps.
              </Text>
            </View>
          </View>
        )}

        <Button
          title="¡Entendido!"
          onPress={() => setGuideOpen(false)}
          style={{ marginTop: 14 }}
        />
      </ModalSheet>
    </>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: COLORS.surface,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: { width: '100%', height: '100%' },
    title: {
      fontSize: 12.5,
      fontFamily: FONTS.bold,
      color: COLORS.secondary,
    },
    sub: {
      fontSize: 11,
      fontFamily: FONTS.medium,
      color: COLORS.textMuted,
    },
    installBtn: {
      backgroundColor: COLORS.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
    },
    installBtnText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontFamily: FONTS.bold,
    },
    closeBtn: {
      padding: 4,
    },
    closeText: {
      fontSize: 14,
      fontFamily: FONTS.bold,
      color: COLORS.textLight,
    },
    stepBox: {
      backgroundColor: COLORS.surfaceMuted,
      borderRadius: 14,
      padding: 13,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    stepTitle: {
      fontSize: 14,
      fontFamily: FONTS.bold,
      color: COLORS.secondary,
      marginBottom: 4,
    },
    stepDesc: {
      fontSize: 13,
      fontFamily: FONTS.regular,
      color: COLORS.textMuted,
      lineHeight: 19,
    },
  });

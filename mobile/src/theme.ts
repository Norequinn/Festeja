import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

export const FONTS = {
  title: 'Abang',
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
};

// Paleta oficial de marca:
// - Naranja principal (se mantiene #FF821C en modo claro y modo oscuro): #FF821C
// - Gris claro neutro: #E2E2E2
// - Celeste/Teal suave: #A0C9CB
// - Azul marino oscuro (solo para detalles, textos y bordes — NO fondos principales): #0C1C31
export const LIGHT_COLORS = {
  bg: '#F5F5F5',
  bgDesktop: '#E2E2E2',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEFEF',
  primary: '#FF821C',
  primaryLight: '#FFF2E6',
  primaryDark: '#D9660A',
  secondary: '#0C1C31', // Detalles, textos, bordes, acentos finos
  secondaryLight: '#EBF5F5',
  teal: '#A0C9CB',
  tealLight: '#EBF5F5',
  tealDark: '#2A6A6E',
  accent: '#FF821C',
  success: '#2A6A6E',
  successLight: '#EBF5F5',
  warning: '#FF821C',
  warningLight: '#FFF2E6',
  danger: '#D93B41',
  dangerLight: '#FEECEC',
  pink: '#FF821C',
  pinkLight: '#FFF2E6',
  text: '#0C1C31',
  textMuted: '#5B6675',
  textLight: '#8E98A4',
  border: '#E2E2E2',
  pollFillVoted: '#FFE4CC',
  pollFillOther: '#EBF5F5',
};

export const DARK_COLORS: typeof LIGHT_COLORS = {
  bg: '#121316', // Neutro oscuro carbón (NO azul)
  bgDesktop: '#0B0C0E',
  surface: '#1C1E22',
  surfaceMuted: '#262930',
  primary: '#FF821C', // Mantiene exactamente el naranja oficial #FF821C
  primaryLight: '#332011',
  primaryDark: '#FF9B47',
  secondary: '#F5F5F5', // Textos y detalles claros legibles en oscuro
  secondaryLight: '#1B2B2D',
  teal: '#A0C9CB',
  tealLight: '#1B2B2D',
  tealDark: '#A0C9CB',
  accent: '#FF821C',
  success: '#A0C9CB',
  successLight: '#1B2B2D',
  warning: '#FF821C',
  warningLight: '#332011',
  danger: '#F87171',
  dangerLight: '#351B1E',
  pink: '#FF821C',
  pinkLight: '#332011',
  text: '#F5F5F5',
  textMuted: '#A5ADB8',
  textLight: '#7A8390',
  border: '#2E323B',
  pollFillVoted: '#4A2B11',
  pollFillOther: '#233436',
};

export type ThemeColors = typeof LIGHT_COLORS;

// Default export for static references
export const COLORS = LIGHT_COLORS;

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: LIGHT_COLORS,
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const nativeScheme = useColorScheme();
  const [webDark, setWebDark] = useState<boolean>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setWebDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setWebDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const isDark = Platform.OS === 'web' ? webDark : nativeScheme === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return React.createElement(ThemeContext.Provider, { value: { colors, isDark } }, children);
}

export function useTheme() {
  return useContext(ThemeContext);
}

export const SHADOW = {
  shadowColor: '#0C1C31',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
};

export const EVENT_TYPE_META: Record<
  string,
  { label: string; emoji: string; color: string; bg: string }
> = {
  BIRTHDAY_GROUP: {
    label: 'Cumpleaños',
    emoji: '🎂',
    color: '#FF821C',
    bg: '#FFF2E6',
  },
  SECRET_SANTA: {
    label: 'Amigo Secreto',
    emoji: '🎅',
    color: '#2A6A6E',
    bg: '#EBF5F5',
  },
  GIFT_EXCHANGE: {
    label: 'Intercambio',
    emoji: '🎁',
    color: '#FF821C',
    bg: '#FFF2E6',
  },
  ANNIVERSARY: {
    label: 'Aniversario',
    emoji: '🏆',
    color: '#0C1C31',
    bg: '#EFEFEF',
  },
  CELEBRATION: {
    label: 'Celebración',
    emoji: '🎉',
    color: '#2A6A6E',
    bg: '#EBF5F5',
  },
};

export const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const WEEKDAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function formatFriendlyDate(ymd: string): string {
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return ymd;
  const [, m, d] = parts;
  return `${d} de ${MONTHS_ES[(m - 1) % 12]}`;
}

export function formatCountdown(days: number | null | undefined): string {
  if (days === null || days === undefined) return '';
  if (days === 0) return '¡Hoy!';
  if (days === 1) return '¡Mañana!';
  if (days < 0) return `Hace ${Math.abs(days)} días`;
  return `En ${days} días`;
}

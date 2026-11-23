import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { resolveMediaUrl } from '../api';
import { FONTS, SHADOW, ThemeColors, useTheme } from '../theme';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={[styles.card, SHADOW, style]}>{children}</View>;
}

export function Avatar({
  emoji,
  color = '#FF821C',
  imageUrl,
  size = 44,
}: {
  emoji: string;
  color?: string;
  imageUrl?: string | null;
  size?: number;
}) {
  const resolved = resolveMediaUrl(imageUrl);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${color}22`,
        borderWidth: 2,
        borderColor: `${color}55`,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {resolved ? (
        <Image source={{ uri: resolved }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text style={{ fontSize: Math.round(size * 0.48) }}>{emoji || '🎉'}</Text>
      )}
    </View>
  );
}

export function Badge({
  label,
  color,
  bg,
}: {
  label: string;
  color?: string;
  bg?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.badge, { backgroundColor: bg ?? colors.primaryLight }]}>
      <Text style={[styles.badgeText, { color: color ?? colors.primary }]}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  small = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'success' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const palette = {
    primary: { bg: colors.primary, text: '#FFFFFF', border: colors.primary },
    // Azul marino (#0C1C31) solo como detalle en borde y texto — NO como fondo principal
    secondary: { bg: colors.surface, text: colors.secondary, border: colors.secondary },
    success: { bg: colors.tealLight, text: colors.secondary, border: colors.teal },
    danger: { bg: colors.danger, text: '#FFFFFF', border: colors.danger },
    outline: { bg: colors.surface, text: colors.secondary, border: colors.border },
    ghost: { bg: colors.surfaceMuted, text: colors.secondary, border: colors.border },
  }[variant];

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        small && styles.buttonSmall,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled || loading ? 0.55 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : (
        <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: palette.text }]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function Input({
  label,
  style,
  ...props
}: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textLight}
        style={[styles.input, props.multiline && { minHeight: 80, textAlignVertical: 'top' }, style]}
        {...props}
      />
    </View>
  );
}

export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function EmptyState({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 38, marginBottom: 8 }}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{description}</Text>
    </View>
  );
}

export function ModalSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.grabber} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textMuted }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11.5,
    fontFamily: FONTS.bold,
  },
  button: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: {
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  buttonText: {
    fontSize: 14.5,
    fontFamily: FONTS.bold,
    textAlign: 'center',
  },
  buttonTextSmall: {
    fontSize: 12.5,
  },
  inputLabel: {
    fontSize: 12.5,
    fontFamily: FONTS.bold,
    color: COLORS.secondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 46,
    fontSize: 16, // >=16px prevents iOS Safari auto-zoom on focus
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: FONTS.title,
    letterSpacing: 1,
    color: COLORS.secondary,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 18,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: FONTS.title,
    letterSpacing: 0.8,
    color: COLORS.secondary,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 28, 49, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  grabber: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: FONTS.title,
    letterSpacing: 1,
    color: COLORS.secondary,
    flex: 1,
    marginRight: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

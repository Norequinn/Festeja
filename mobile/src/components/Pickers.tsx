import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, resolveMediaUrl } from '../api';
import { FONTS, MONTHS_ES, ThemeColors, useTheme, WEEKDAYS_ES } from '../theme';
import { ModalSheet } from './UI';

// ==================== CALENDAR DATE PICKER FIELD ====================
interface DatePickerFieldProps {
  label?: string;
  value: string; // "YYYY-MM-DD" or ""
  onChange: (ymd: string) => void;
  placeholder?: string;
  mode?: 'birthday' | 'event';
  allowClear?: boolean;
}

function parseYMD(ymd: string): { year: number; month: number; day: number } | null {
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [year, month, day] = parts;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function toYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = 'Seleccionar fecha...',
  mode = 'event',
  allowClear = false,
}: DatePickerFieldProps) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const now = new Date();
  const parsed = parseYMD(value);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(
    parsed?.year ?? (mode === 'birthday' ? 1995 : now.getFullYear())
  );
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth() + 1);
  const [pickingYear, setPickingYear] = useState(false);

  function openPicker() {
    const p = parseYMD(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    } else {
      setViewYear(mode === 'birthday' ? 1995 : now.getFullYear());
      setViewMonth(now.getMonth() + 1);
    }
    setPickingYear(false);
    setOpen(true);
  }

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m > 12) {
      m = 1;
      y += 1;
    } else if (m < 1) {
      m = 12;
      y -= 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth - 1, 1);
    const totalDays = new Date(viewYear, viewMonth, 0).getDate();
    const blanks = (first.getDay() + 6) % 7;
    const arr: Array<number | null> = [];
    for (let i = 0; i < blanks; i++) arr.push(null);
    for (let d = 1; d <= totalDays; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [viewYear, viewMonth]);

  const years = useMemo(() => {
    const list: number[] = [];
    const start = mode === 'birthday' ? now.getFullYear() - 14 : now.getFullYear() + 4;
    const end = mode === 'birthday' ? 1945 : now.getFullYear() - 1;
    for (let y = start; y >= end; y--) list.push(y);
    return list;
  }, [mode]);

  const displayLabel = parsed
    ? `${parsed.day} de ${MONTHS_ES[parsed.month - 1]} de ${parsed.year}`
    : placeholder;

  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={openPicker}
        style={styles.dateButton}
      >
        <Text style={{ fontSize: 18, marginRight: 10 }}>📅</Text>
        <Text
          numberOfLines={1}
          style={[styles.dateButtonText, !parsed && { color: COLORS.textLight }]}
        >
          {displayLabel}
        </Text>
        {allowClear && value ? (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation?.();
              onChange('');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 14, color: COLORS.textMuted, fontWeight: '800' }}>✕</Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: '800' }}>Cambiar</Text>
        )}
      </TouchableOpacity>

      <ModalSheet
        visible={open}
        title={label || 'Seleccionar fecha'}
        onClose={() => setOpen(false)}
      >
        {/* Top bar: Month arrows + Year toggle */}
        <View style={styles.calHeader}>
          <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.arrowBtn}>
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPickingYear(!pickingYear)}
            style={styles.monthYearBtn}
          >
            <Text style={styles.monthYearText}>
              {MONTHS_ES[viewMonth - 1]} {viewYear} {pickingYear ? '▲' : '▼'}
            </Text>
            <Text style={styles.monthYearHint}>
              {pickingYear ? 'Toca un año' : 'Toca para cambiar año'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.arrowBtn}>
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
        </View>

        {pickingYear ? (
          <View style={styles.yearGrid}>
            {years.map((y) => {
              const active = y === viewYear;
              return (
                <TouchableOpacity
                  key={y}
                  onPress={() => {
                    setViewYear(y);
                    setPickingYear(false);
                  }}
                  style={[styles.yearCell, active && styles.yearCellActive]}
                >
                  <Text style={[styles.yearText, active && { color: '#FFFFFF' }]}>{y}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <>
            {/* Quick Month Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 10 }}
              contentContainerStyle={{ gap: 6 }}
            >
              {MONTHS_ES.map((mName, idx) => {
                const active = idx + 1 === viewMonth;
                return (
                  <TouchableOpacity
                    key={mName}
                    onPress={() => setViewMonth(idx + 1)}
                    style={[styles.monthChip, active && styles.monthChipActive]}
                  >
                    <Text style={[styles.monthChipText, active && { color: '#FFFFFF' }]}>
                      {mName.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Weekday headers */}
            <View style={styles.weekRow}>
              {WEEKDAYS_ES.map((w) => (
                <Text key={w} style={styles.weekLabel}>
                  {w}
                </Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={styles.dayGrid}>
              {cells.map((day, idx) => {
                if (day === null) return <View key={`b-${idx}`} style={styles.dayCell} />;
                const isSelected =
                  parsed?.year === viewYear &&
                  parsed?.month === viewMonth &&
                  parsed?.day === day;
                const isToday =
                  now.getFullYear() === viewYear &&
                  now.getMonth() + 1 === viewMonth &&
                  now.getDate() === day;

                return (
                  <TouchableOpacity
                    key={`d-${day}`}
                    onPress={() => {
                      onChange(toYMD(viewYear, viewMonth, day));
                      setOpen(false);
                    }}
                    style={[
                      styles.dayCell,
                      isToday && !isSelected && styles.dayToday,
                      isSelected && styles.daySelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        isToday && !isSelected && { color: COLORS.primaryDark, fontWeight: '900' },
                        isSelected && { color: '#FFFFFF', fontWeight: '900' },
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ModalSheet>
    </View>
  );
}

// ==================== IMAGE PICKER & UPLOAD FIELD ====================
interface ImagePickerFieldProps {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  shape?: 'square' | 'circle';
  compact?: boolean;
}

function compressWebImage(file: File, maxDim = 960, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Formato de imagen no soportado'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ImagePickerField({
  label,
  value,
  onChange,
  placeholder = 'Subir imagen desde galería',
  shape = 'square',
  compact = false,
}: ImagePickerFieldProps) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const webInputRef = useRef<HTMLInputElement | null>(null);

  const previewUri = resolveMediaUrl(value);

  async function uploadDataUrl(dataUrl: string) {
    setUploading(true);
    setErr('');
    try {
      const res = await api.uploadImage(dataUrl);
      onChange(res.url);
    } catch (e: any) {
      setErr(e.message || 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  }

  async function handlePick() {
    setErr('');
    if (Platform.OS === 'web') {
      webInputRef.current?.click();
      return;
    }

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setErr('Permite el acceso a tus fotos para subir imágenes.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: shape === 'circle',
        aspect: shape === 'circle' ? [1, 1] : undefined,
        quality: 0.65,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        const mime = result.assets[0].mimeType || 'image/jpeg';
        await uploadDataUrl(`data:${mime};base64,${result.assets[0].base64}`);
      }
    } catch (e: any) {
      setErr(e.message || 'Error abriendo la galería');
    }
  }

  async function handleWebFileChange(e: any) {
    const file: File | undefined = e.target?.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr('');
    try {
      const compressed = await compressWebImage(file);
      await uploadDataUrl(compressed);
    } catch (error: any) {
      setErr(error.message || 'No se pudo procesar la imagen');
      setUploading(false);
    } finally {
      if (e.target) e.target.value = '';
    }
  }

  return (
    <View style={{ marginBottom: compact ? 0 : 12 }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}

      {Platform.OS === 'web' ? (
        <input
          ref={(el) => {
            webInputRef.current = el;
          }}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleWebFileChange}
        />
      ) : null}

      {compact ? (
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={uploading}
          onPress={handlePick}
          style={styles.compactCamBtn}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={COLORS.secondary} />
          ) : (
            <Text style={{ fontSize: 20 }}>📷</Text>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.imgBox}>
          {previewUri ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Image
                source={{ uri: previewUri }}
                style={shape === 'circle' ? styles.previewCircle : styles.previewSquare}
                resizeMode="cover"
              />
              <View style={{ flex: 1, gap: 6 }}>
                <TouchableOpacity
                  onPress={handlePick}
                  disabled={uploading}
                  style={styles.imgActionBtn}
                >
                  <Text style={styles.imgActionText}>
                    {uploading ? 'Subiendo...' : '📷 Cambiar imagen'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onChange('')}
                  style={[styles.imgActionBtn, { backgroundColor: COLORS.dangerLight }]}
                >
                  <Text style={[styles.imgActionText, { color: COLORS.danger }]}>Quitar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={uploading}
              onPress={handlePick}
              style={styles.uploadDrop}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Text style={{ fontSize: 24 }}>📷</Text>
                  <Text style={styles.uploadDropText}>{placeholder}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {err ? <Text style={styles.errText}>⚠️ {err}</Text> : null}
    </View>
  );
}

// ==================== FULLSCREEN IMAGE LIGHTBOX ====================
export function ImageLightboxModal({
  uri,
  title,
  onClose,
}: {
  uri: string | null;
  title?: string;
  onClose: () => void;
}) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const resolved = resolveMediaUrl(uri);
  return (
    <Modal visible={Boolean(resolved)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.lightboxBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.lightboxHeader}>
          <Text style={styles.lightboxTitle} numberOfLines={1}>
            {title || 'Imagen'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.lightboxClose}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>✕</Text>
          </TouchableOpacity>
        </View>
        {resolved ? (
          <Image source={{ uri: resolved }} style={styles.lightboxImg} resizeMode="contain" />
        ) : null}
      </View>
    </Modal>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 6,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  arrowBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { fontSize: 22, fontWeight: '700', color: COLORS.secondary },
  monthYearBtn: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: COLORS.secondaryLight,
  },
  monthYearText: { fontSize: 15, fontWeight: '800', color: COLORS.secondary },
  monthYearHint: { fontSize: 10.5, color: COLORS.accent, fontWeight: '700', marginTop: 1 },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  yearCell: {
    width: '22%',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
  },
  yearCellActive: { backgroundColor: COLORS.primary },
  yearText: { fontSize: 14, fontWeight: '800', color: COLORS.secondary },
  monthChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceMuted,
  },
  monthChipActive: { backgroundColor: COLORS.primary },
  monthChipText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.secondary },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.285%',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  dayToday: { backgroundColor: COLORS.primaryLight },
  daySelected: { backgroundColor: COLORS.primary },
  dayNum: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  imgBox: {
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
  },
  uploadDrop: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  uploadDropText: { fontSize: 13, fontWeight: '700', color: COLORS.secondary },
  previewSquare: {
    width: 78,
    height: 78,
    borderRadius: 12,
    backgroundColor: COLORS.border,
  },
  previewCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: COLORS.border,
  },
  imgActionBtn: {
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  imgActionText: { fontSize: 12.5, fontWeight: '800', color: COLORS.secondary },
  compactCamBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errText: { fontSize: 12, color: COLORS.danger, fontWeight: '700', marginTop: 4 },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 20, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  lightboxHeader: {
    position: 'absolute',
    top: 44,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  lightboxTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', flex: 1, marginRight: 10 },
  lightboxClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImg: { width: '100%', height: '75%' },
});

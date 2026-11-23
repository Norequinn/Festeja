import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../api';
import { Badge, Card, EmptyState, SectionHeader } from '../components/UI';
import { FONTS, MONTHS_ES, ThemeColors, useTheme, WEEKDAYS_ES, formatCountdown, formatFriendlyDate } from '../theme';
import type { CalendarEntry } from '../types';

interface Props {
  onOpenMember: (memberId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onOpenPayment: (scheduleId: string) => void;
}

export function CalendarScreen({ onOpenMember, onOpenEvent, onOpenPayment }: Props) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const loadMonth = useCallback(async (y: number, m: number) => {
    try {
      const res = await api.getCalendar(y, m);
      setEntries(res.monthEntries);
    } catch (e) {
      console.warn('Error cargando calendario:', e);
    }
  }, []);

  useEffect(() => {
    setSelectedDay(null);
    loadMonth(year, month);
  }, [year, month, loadMonth]);

  function shiftMonth(delta: number) {
    let nextM = month + delta;
    let nextY = year;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    } else if (nextM < 1) {
      nextM = 12;
      nextY -= 1;
    }
    setYear(nextY);
    setMonth(nextM);
  }

  const entriesByDay = useMemo(() => {
    const map = new Map<number, CalendarEntry[]>();
    for (const e of entries) {
      const list = map.get(e.dayOfMonth) || [];
      list.push(e);
      map.set(e.dayOfMonth, list);
    }
    return map;
  }, [entries]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    // Monday-first index (0 = Mon ... 6 = Sun)
    const leadingBlanks = (firstDay.getDay() + 6) % 7;
    const cells: Array<number | null> = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const visibleEntries = selectedDay ? entriesByDay.get(selectedDay) || [] : entries;
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  function openEntry(entry: CalendarEntry) {
    if (entry.paymentScheduleId) onOpenPayment(entry.paymentScheduleId);
    else if (entry.eventId) onOpenEvent(entry.eventId);
    else if (entry.memberId) onOpenMember(entry.memberId);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Card>
        {/* Month switcher */}
        <View style={styles.monthBar}>
          <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.arrowBtn}>
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.monthTitle}>
              {MONTHS_ES[month - 1]} {year}
            </Text>
            <Text style={styles.monthSub}>
              {entries.length} {entries.length === 1 ? 'celebración' : 'celebraciones'} este mes
            </Text>
          </View>
          <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.arrowBtn}>
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Weekday headers */}
        <View style={styles.weekRow}>
          {WEEKDAYS_ES.map((w) => (
            <Text key={w} style={styles.weekLabel}>
              {w}
            </Text>
          ))}
        </View>

        {/* Days Grid */}
        <View style={styles.grid}>
          {calendarCells.map((day, idx) => {
            if (day === null) {
              return <View key={`blank-${idx}`} style={styles.dayCell} />;
            }
            const dayEntries = entriesByDay.get(day) || [];
            const isToday = isCurrentMonth && day === now.getDate();
            const isSelected = selectedDay === day;
            return (
              <TouchableOpacity
                key={`day-${day}`}
                onPress={() => setSelectedDay(isSelected ? null : day)}
                style={[
                  styles.dayCell,
                  isToday && styles.dayToday,
                  isSelected && styles.daySelected,
                ]}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    isToday && styles.dayNumberToday,
                    isSelected && styles.dayNumberSelected,
                  ]}
                >
                  {day}
                </Text>
                <View style={styles.dotsRow}>
                  {dayEntries.slice(0, 3).map((e) => (
                    <View
                      key={e.id}
                      style={[
                        styles.dot,
                        { backgroundColor: isSelected ? '#FFFFFF' : e.color },
                      ]}
                    />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
            <Text style={styles.legendText}>Cumpleaños</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: COLORS.secondary }]} />
            <Text style={styles.legendText}>Aniversario</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: COLORS.teal }]} />
            <Text style={styles.legendText}>Evento</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: COLORS.tealDark }]} />
            <Text style={styles.legendText}>Fecha de pago</Text>
          </View>
        </View>
      </Card>

      <SectionHeader
        title={
          selectedDay
            ? `Celebraciones del ${selectedDay} de ${MONTHS_ES[month - 1]}`
            : `Agenda de ${MONTHS_ES[month - 1]}`
        }
        right={
          selectedDay ? (
            <TouchableOpacity onPress={() => setSelectedDay(null)}>
              <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>
                Ver todo el mes
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {visibleEntries.length === 0 ? (
        <EmptyState
          emoji="🗓️"
          title="Día despejado"
          description="No hay cumpleaños ni eventos registrados en esta fecha."
        />
      ) : (
        <View style={{ gap: 10 }}>
          {visibleEntries.map((item) => (
            <TouchableOpacity key={item.id} activeOpacity={0.85} onPress={() => openEntry(item)}>
              <Card style={styles.entryCard}>
                <View style={[styles.entryIcon, { backgroundColor: `${item.color}1C` }]}>
                  <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryTitle}>{item.title}</Text>
                  <Text style={styles.entrySub}>
                    {formatFriendlyDate(item.date)} · {item.subtitle}
                  </Text>
                </View>
                <Badge
                  label={formatCountdown(item.daysUntil)}
                  color={item.color}
                  bg={`${item.color}1C`}
                />
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 28,
  },
  monthBar: {
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
  arrowText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  monthTitle: {
    fontSize: 17,
    fontFamily: FONTS.title,
    letterSpacing: 1,
    color: COLORS.secondary,
  },
  monthSub: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11.5,
    fontFamily: FONTS.bold,
    color: COLORS.textLight,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.285%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingVertical: 5,
  },
  dayToday: {
    backgroundColor: COLORS.tealLight,
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
  },
  daySelected: {
    backgroundColor: COLORS.primary,
  },
  dayNumber: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  dayNumberToday: {
    color: COLORS.secondary,
    fontFamily: FONTS.extrabold,
  },
  dayNumberSelected: {
    color: '#FFFFFF',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
    height: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  entryIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  entrySub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});

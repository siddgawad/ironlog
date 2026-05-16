import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import api from '../../api';

const C = {
  bg: '#07080A', surface: '#111318', elevated: '#171A21', border: '#252A33',
  orange: '#FF6A1A', green: '#22C55E', warning: '#F59E0B', text: '#F8FAFC',
  textSec: '#A8B0BD', textMuted: '#69717F',
};

type CheckIn = {
  _id: string;
  date: string;
  weightKg?: number;
  energyLevel?: number;
  adherence?: number;
  notes?: string;
};

export default function Progress() {
  const [logs, setLogs] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/progress/checkins');
      setLogs(res.data ?? []);
    } catch {
      // Fail silently — new users have no data yet
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={C.orange} size="large" /></View>;
  }

  const weightLogs = logs.filter((l) => l.weightKg != null);
  const latestWeight = weightLogs[0]?.weightKg;
  const earliestWeight = weightLogs[weightLogs.length - 1]?.weightKg;
  const weightDelta = latestWeight != null && earliestWeight != null && weightLogs.length > 1
    ? +(latestWeight - earliestWeight).toFixed(1)
    : null;

  const avgAdherence = logs.length
    ? Math.round(logs.filter((l) => l.adherence != null).reduce((a, l) => a + (l.adherence ?? 0), 0) / logs.filter((l) => l.adherence != null).length)
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange} />}
      >
        <Text style={styles.title}>My Progress</Text>

        {/* Summary cards */}
        {logs.length > 0 && (
          <View style={styles.summaryRow}>
            <SummaryCard
              label="Check-ins"
              value={`${logs.length}`}
              sub="total logged"
            />
            {latestWeight != null && (
              <SummaryCard
                label="Weight"
                value={`${latestWeight} kg`}
                sub={weightDelta != null ? (weightDelta <= 0 ? `${weightDelta} kg` : `+${weightDelta} kg`) : 'latest'}
                valueColor={weightDelta != null && weightDelta < 0 ? C.green : C.orange}
              />
            )}
            {avgAdherence != null && (
              <SummaryCard
                label="Adherence"
                value={`${avgAdherence}/5`}
                sub="avg rating"
                valueColor={avgAdherence >= 4 ? C.green : avgAdherence >= 3 ? C.warning : '#EF4444'}
              />
            )}
          </View>
        )}

        {/* Weight bar chart */}
        {weightLogs.length > 1 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartLabel}>WEIGHT TREND (kg)</Text>
            <WeightBars logs={weightLogs.slice(0, 10).reverse()} />
          </View>
        )}

        {/* Log list */}
        {logs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No check-ins yet</Text>
            <Text style={styles.emptyBody}>
              Once Ashwini sets up your plan, you'll check in here weekly with your
              weight, energy, and how well you followed the plan.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>CHECK-IN HISTORY</Text>
            {logs.map((log) => {
              const dateStr = new Date(log.date).toLocaleDateString('en-CA', {
                weekday: 'short', month: 'short', day: 'numeric',
              });
              return (
                <View key={log._id} style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <Text style={styles.logDate}>{dateStr}</Text>
                    {log.weightKg != null && (
                      <Text style={styles.logWeight}>{log.weightKg} kg</Text>
                    )}
                  </View>
                  <View style={styles.logMetrics}>
                    {log.energyLevel != null && (
                      <MetricPill label="Energy" value={`${log.energyLevel}/5`} color={energyColor(log.energyLevel)} />
                    )}
                    {log.adherence != null && (
                      <MetricPill label="Adherence" value={`${log.adherence}/5`} color={adherenceColor(log.adherence)} />
                    )}
                  </View>
                  {log.notes ? <Text style={styles.logNotes}>{log.notes}</Text> : null}
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({ label, value, sub, valueColor = C.text }: {
  label: string; value: string; sub: string; valueColor?: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.summarySub}>{sub}</Text>
    </View>
  );
}

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
    </View>
  );
}

function WeightBars({ logs }: { logs: CheckIn[] }) {
  const weights = logs.map((l) => l.weightKg!);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const BAR_MAX = 60;

  return (
    <View style={styles.barsContainer}>
      {logs.map((l, i) => {
        const height = BAR_MAX * 0.3 + BAR_MAX * 0.7 * ((l.weightKg! - min) / range);
        const isLatest = i === logs.length - 1;
        return (
          <View key={l._id} style={styles.barWrap}>
            <Text style={styles.barValue}>{l.weightKg}</Text>
            <View style={[styles.bar, { height, backgroundColor: isLatest ? C.orange : C.border }]} />
            <Text style={styles.barDate}>
              {new Date(l.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }).slice(0, 6)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function energyColor(v: number) {
  if (v >= 4) return C.green;
  if (v >= 3) return C.warning;
  return '#EF4444';
}

function adherenceColor(v: number) {
  if (v >= 4) return C.green;
  if (v >= 3) return C.warning;
  return '#EF4444';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 20 },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: {
    flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14,
  },
  summaryLabel: { fontSize: 10, color: C.textMuted, fontWeight: '600', letterSpacing: 1.2, marginBottom: 6 },
  summaryValue: { fontSize: 18, fontWeight: '800', color: C.text },
  summarySub: { fontSize: 10, color: C.textMuted, marginTop: 2 },

  chartCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14, marginBottom: 16,
  },
  chartLabel: { fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12 },
  barsContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 90 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barValue: { fontSize: 9, color: C.textMuted },
  bar: { width: '80%', borderRadius: 4, minHeight: 8 },
  barDate: { fontSize: 8, color: C.textMuted, textAlign: 'center' },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: C.textMuted,
    letterSpacing: 1.5, marginBottom: 10,
  },
  logCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  logDate: { fontSize: 14, fontWeight: '700', color: C.text },
  logWeight: { fontSize: 15, fontWeight: '800', color: C.orange },
  logMetrics: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  pillLabel: { fontSize: 11, color: C.textMuted },
  pillValue: { fontSize: 12, fontWeight: '700' },
  logNotes: { fontSize: 12, color: C.textMuted, lineHeight: 18, marginTop: 4 },

  emptyCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 8 },
  emptyBody: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
});

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-gifted-charts';
import api from '../../api';

type Log = {
  _id: string;
  date: string;
  sessionType: string;
  missedReason?: string;
  extractedData?: {
    bench?: { loadLb: number; setsCompleted: number; rpeReported?: number; estimatedOneRM?: number };
    squat?: { loadLb: number; headacheGrade?: number };
    deadlift?: { loadLb: number; rpeReported?: number };
    generalFeeling?: string;
    painFlags?: Record<string, boolean>;
    extraNotes?: string;
  };
  adaptationsTriggered?: string[];
};

const FEELING_COLORS: Record<string, string> = {
  good: '#86efac',
  neutral: '#a1a1aa',
  poor: '#fca5a5',
};

export default function History() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get('/logs').then((r) => { setLogs(r.data); setLoading(false); });
  }, []);

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const benchLogs = [...logs]
    .filter((l) => l.extractedData?.bench?.rpeReported != null)
    .reverse();

  const rpeData = benchLogs.map((l) => ({
    value: l.extractedData!.bench!.rpeReported!,
    dataPointText: `${l.extractedData!.bench!.rpeReported}`,
  }));
  const oneRMData = benchLogs
    .filter((l) => l.extractedData?.bench?.estimatedOneRM)
    .map((l) => ({ value: l.extractedData!.bench!.estimatedOneRM! }));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#f97316" size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Session History</Text>

        {/* RPE Chart */}
        {rpeData.length > 1 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartLabel}>BENCH RPE</Text>
            <LineChart
              data={rpeData}
              height={100}
              color="#f97316"
              thickness={2}
              dataPointsColor="#f97316"
              dataPointsRadius={4}
              backgroundColor="#18181b"
              xAxisColor="#3f3f46"
              yAxisColor="#3f3f46"
              yAxisTextStyle={{ color: '#71717a', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#71717a', fontSize: 9 }}
              hideRules
              curved
              maxValue={10}
              mostNegativeValue={6}
              noOfSections={4}
              areaChart
              startFillColor="rgba(249,115,22,0.15)"
              endFillColor="rgba(249,115,22,0)"
            />
          </View>
        )}

        {/* 1RM Chart */}
        {oneRMData.length > 1 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartLabel}>ESTIMATED 1RM (lb)</Text>
            <LineChart
              data={oneRMData}
              height={100}
              color="#f97316"
              thickness={2}
              dataPointsColor="#f97316"
              dataPointsRadius={4}
              backgroundColor="#18181b"
              xAxisColor="#3f3f46"
              yAxisColor="#3f3f46"
              yAxisTextStyle={{ color: '#71717a', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#71717a', fontSize: 9 }}
              hideRules
              curved
              areaChart
              startFillColor="rgba(249,115,22,0.15)"
              endFillColor="rgba(249,115,22,0)"
            />
          </View>
        )}

        {/* Log List */}
        {logs.length === 0 ? (
          <Text style={styles.empty}>No sessions logged yet.</Text>
        ) : (
          logs.map((log) => {
            const isExpanded = expanded[log._id];
            const isMissed = log.sessionType === 'missed';
            const feeling = log.extractedData?.generalFeeling;
            const dateStr = new Date(log.date).toLocaleDateString('en-CA', {
              weekday: 'short', month: 'short', day: 'numeric',
            });

            return (
              <View key={log._id} style={styles.logCard}>
                <TouchableOpacity
                  onPress={() => toggle(log._id)}
                  style={styles.logHeader}
                  activeOpacity={0.7}
                >
                  <View style={styles.logHeaderLeft}>
                    <Text style={styles.logDate}>{dateStr}</Text>
                    {isMissed
                      ? <View style={styles.missedBadge}><Text style={styles.missedText}>Missed</Text></View>
                      : feeling && (
                        <View style={[styles.feelingBadge, { borderColor: FEELING_COLORS[feeling] ?? '#71717a' }]}>
                          <Text style={[styles.feelingText, { color: FEELING_COLORS[feeling] ?? '#71717a' }]}>
                            {feeling}
                          </Text>
                        </View>
                      )}
                  </View>
                  <View style={styles.logHeaderRight}>
                    {log.extractedData?.bench?.loadLb && (
                      <Text style={styles.benchPill}>B {log.extractedData.bench.loadLb}lb</Text>
                    )}
                    <Text style={styles.chevron}>{isExpanded ? '∧' : '∨'}</Text>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.logBody}>
                    {isMissed ? (
                      <Text style={styles.bodyText}>Missed — {log.missedReason || 'no reason given'}</Text>
                    ) : (
                      <>
                        {log.extractedData?.bench?.loadLb && (
                          <DataBlock label="Bench">
                            <DataRow k="Sets" v={`${log.extractedData.bench.setsCompleted}`} />
                            <DataRow k="Load" v={`${log.extractedData.bench.loadLb}lb`} />
                            <DataRow k="RPE" v={`${log.extractedData.bench.rpeReported ?? '—'}`} />
                            {log.extractedData.bench.estimatedOneRM && (
                              <DataRow k="Est 1RM" v={`${log.extractedData.bench.estimatedOneRM}lb`} />
                            )}
                          </DataBlock>
                        )}
                        {log.extractedData?.squat?.loadLb && (
                          <DataBlock label="Squat">
                            <DataRow k="Load" v={`${log.extractedData.squat.loadLb}lb`} />
                            <DataRow k="Headache" v={`Grade ${log.extractedData.squat.headacheGrade ?? 0}`} />
                          </DataBlock>
                        )}
                        {log.extractedData?.deadlift?.loadLb && (
                          <DataBlock label="Deadlift">
                            <DataRow k="Load" v={`${log.extractedData.deadlift.loadLb}lb`} />
                            <DataRow k="RPE" v={`${log.extractedData.deadlift.rpeReported ?? '—'}`} />
                          </DataBlock>
                        )}
                        {log.extractedData?.painFlags &&
                          Object.values(log.extractedData.painFlags).some(Boolean) && (
                            <Text style={styles.painText}>
                              Pain: {Object.entries(log.extractedData.painFlags).filter(([, v]) => v).map(([k]) => k).join(', ')}
                            </Text>
                          )}
                      </>
                    )}
                    {log.adaptationsTriggered?.length ? (
                      <Text style={styles.adaptText}>
                        {log.adaptationsTriggered.join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DataBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 10, color: '#71717a', fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 }}>
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function DataRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
      <Text style={{ fontSize: 13, color: '#71717a' }}>{k}</Text>
      <Text style={{ fontSize: 13, color: '#e4e4e7' }}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090b' },
  center: { flex: 1, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: '#f4f4f5', marginBottom: 20 },
  chartCard: {
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a',
    borderRadius: 14, padding: 12, marginBottom: 14,
  },
  chartLabel: { fontSize: 10, color: '#71717a', fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  empty: { color: '#52525b', fontSize: 14, textAlign: 'center', paddingTop: 40 },
  logCard: {
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a',
    borderRadius: 14, marginBottom: 10, overflow: 'hidden',
  },
  logHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  logHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logDate: { fontSize: 14, fontWeight: '600', color: '#f4f4f5' },
  missedBadge: { backgroundColor: '#27272a', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  missedText: { fontSize: 11, color: '#71717a' },
  feelingBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  feelingText: { fontSize: 11, textTransform: 'capitalize' },
  logHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benchPill: { fontSize: 12, color: '#71717a' },
  chevron: { fontSize: 14, color: '#52525b' },
  logBody: {
    paddingHorizontal: 16, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: '#27272a',
    paddingTop: 12,
  },
  bodyText: { fontSize: 13, color: '#a1a1aa' },
  painText: { fontSize: 12, color: '#fca5a5', marginTop: 4 },
  adaptText: { fontSize: 11, color: '#fb923c', borderTopWidth: 1, borderTopColor: '#27272a', paddingTop: 8, marginTop: 8 },
});

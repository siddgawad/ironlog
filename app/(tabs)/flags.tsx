import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../api';
import { useAppStore } from '../../store/appStore';

type Adaptation = {
  _id: string;
  rule: string;
  trigger: string;
  action: string;
  timestamp: string;
};

const RULE_META: Record<string, { color: string; label: string }> = {
  RULE_1_MISSED: { color: '#60a5fa', label: 'Missed Session' },
  RULE_2_FAILED_BENCH: { color: '#fb923c', label: 'Bench Failure' },
  RULE_2_MC_BOUNDARY: { color: '#fb923c', label: 'MC Boundary — No Load Advance' },
  RULE_3_HEADACHE_GRADE1: { color: '#fb923c', label: 'Grade 1 Headache' },
  RULE_3_HEADACHE_GRADE1_REPEATED: { color: '#fb923c', label: 'Grade 1 Headache ×2' },
  RULE_4_HEADACHE_GRADE2: { color: '#f87171', label: 'Grade 2 Headache' },
  RULE_5_HEADACHE_GRADE3: { color: '#f87171', label: 'Grade 3 — Medical Stop' },
  RULE_6_RPE_OVER_CAP: { color: '#fb923c', label: 'RPE Cap Exceeded' },
  RULE_7_PAIN_FLAG: { color: '#fb923c', label: 'Pain Flag' },
};

export default function Flags() {
  const { programState, fetchProgramState } = useAppStore();
  const [adaptations, setAdaptations] = useState<Adaptation[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [resuming, setResuming] = useState(false);

  const medicalStop = programState?.flags?.medicalStop;

  useEffect(() => {
    api.get('/adaptations').then((r) => { setAdaptations(r.data); setLoading(false); });
  }, []);

  const handleResume = async () => {
    if (!resumeChecked) return;
    setResuming(true);
    try {
      await api.post('/medical-clearance');
      await fetchProgramState();
    } catch {}
    setResuming(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Adaptation Log</Text>

        {medicalStop && (
          <View style={styles.medicalCard}>
            <Text style={styles.medicalTitle}>TRAINING HALTED</Text>
            <Text style={styles.medicalBody}>
              Severe headache reported. Do not resume until you have received medical evaluation.
              Sudden explosive onset, visual disturbance, neck stiffness, or confusion require
              immediate evaluation.
            </Text>
            <TouchableOpacity
              onPress={() => setResumeChecked((v) => !v)}
              style={styles.checkRow}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, resumeChecked && styles.checkboxChecked]}>
                {resumeChecked && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>
                I have received medical clearance and am cleared to train
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.resumeBtn, (!resumeChecked || resuming) && styles.resumeBtnDisabled]}
              onPress={handleResume}
              disabled={!resumeChecked || resuming}
            >
              {resuming
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.resumeBtnText}>Resume Training</Text>}
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color="#f97316" style={{ marginTop: 40 }} />
        ) : adaptations.length === 0 ? (
          <Text style={styles.empty}>No adaptations triggered yet.</Text>
        ) : (
          adaptations.map((a) => {
            const meta = RULE_META[a.rule] ?? { color: '#60a5fa', label: a.rule };
            const ts = new Date(a.timestamp).toLocaleString('en-CA', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            return (
              <View key={a._id} style={[styles.card, { borderLeftColor: meta.color }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardRule, { color: meta.color }]}>{meta.label}</Text>
                  <Text style={styles.cardTs}>{ts}</Text>
                </View>
                <Text style={styles.cardTrigger}>{a.trigger}</Text>
                <Text style={styles.cardAction}>{a.action}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090b' },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: '#f4f4f5', marginBottom: 20 },
  medicalCard: {
    backgroundColor: '#1c0a0a', borderWidth: 1, borderColor: '#991b1b',
    borderRadius: 14, padding: 16, marginBottom: 20,
  },
  medicalTitle: { color: '#fca5a5', fontWeight: '800', fontSize: 14, marginBottom: 8 },
  medicalBody: { color: '#fca5a5', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#f87171',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#f97316', borderColor: '#f97316' },
  checkmark: { color: '#fff', fontWeight: '800', fontSize: 13 },
  checkLabel: { flex: 1, fontSize: 13, color: '#fca5a5', lineHeight: 20 },
  resumeBtn: {
    backgroundColor: '#f97316', borderRadius: 10, padding: 14, alignItems: 'center',
  },
  resumeBtnDisabled: { opacity: 0.4 },
  resumeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { color: '#52525b', fontSize: 14, textAlign: 'center', paddingTop: 40 },
  card: {
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a',
    borderLeftWidth: 3, borderRadius: 12, padding: 14, marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardRule: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  cardTs: { fontSize: 11, color: '#52525b' },
  cardTrigger: { fontSize: 13, color: '#a1a1aa', marginBottom: 2 },
  cardAction: { fontSize: 12, color: '#71717a' },
});

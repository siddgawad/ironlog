import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import api from '../api';
import { useAppStore } from '../store/appStore';

export default function Setup() {
  const router = useRouter();
  const fetchProgramState = useAppStore((s) => s.fetchProgramState);
  const [startDate, setStartDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStart = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/setup', { startDate: startDate.toISOString() });
      await fetchProgramState();
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Setup failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>IRONLOG</Text>
        <Text style={styles.subtitle}>Smolov Jr Bench Specialization</Text>
        <Text style={styles.desc}>
          24 sessions across 3 microcycles. Pick your start date and let the program run.
        </Text>

        <View style={styles.dateCard}>
          <Text style={styles.dateLabel}>Program Start Date</Text>
          <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.datePicker}>
            <Text style={styles.dateValue}>
              {startDate.toLocaleDateString('en-CA', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
            </Text>
          </TouchableOpacity>
        </View>

        {showPicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant="dark"
            onChange={(_, date) => {
              setShowPicker(false);
              if (date) setStartDate(date);
            }}
          />
        )}

        <View style={styles.infoBlock}>
          {[
            '3 microcycles × 8 sessions each',
            'Bench specialization with squat & deadlift',
            'AI coach logs every session via chat',
            'Auto-adjusts if you miss or struggle',
          ].map((t) => (
            <View key={t} style={styles.infoRow}>
              <Text style={styles.infoDot}>·</Text>
              <Text style={styles.infoText}>{t}</Text>
            </View>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.startButton, loading && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.startButtonText}>Start Program</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090b' },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 36, fontWeight: '900', color: '#f97316', letterSpacing: 5, marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#a1a1aa', marginBottom: 16 },
  desc: { fontSize: 14, color: '#71717a', lineHeight: 22, marginBottom: 32 },
  dateCard: {
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a',
    borderRadius: 14, padding: 16, marginBottom: 24,
  },
  dateLabel: { fontSize: 11, color: '#71717a', fontWeight: '600', letterSpacing: 1.2, marginBottom: 10 },
  datePicker: { paddingVertical: 4 },
  dateValue: { fontSize: 16, color: '#f97316', fontWeight: '600' },
  infoBlock: { marginBottom: 32 },
  infoRow: { flexDirection: 'row', marginBottom: 8 },
  infoDot: { color: '#f97316', marginRight: 8, fontSize: 16 },
  infoText: { color: '#a1a1aa', fontSize: 14, flex: 1 },
  error: { color: '#ef4444', fontSize: 13, marginBottom: 16, textAlign: 'center' },
  startButton: {
    backgroundColor: '#f97316', borderRadius: 14, padding: 18, alignItems: 'center',
  },
  startButtonDisabled: { opacity: 0.5 },
  startButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});

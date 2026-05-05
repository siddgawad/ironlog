import { useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';

export default function Today() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { programState, todayPlan, initialized, fetchProgramState } = useAppStore();

  useFocusEffect(useCallback(() => { fetchProgramState(); }, []));

  if (!initialized) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" size="large" />
      </View>
    );
  }

  if (!programState) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No program yet</Text>
          <Text style={styles.emptyBody}>
            Start a chat and ask the coach to set you up with a program based on your goals.
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => router.push('/setup')}
          >
            <Text style={styles.startBtnText}>Start with Smolov Jr Bench</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const flags = programState.flags;
  const isRest = todayPlan?.dayType === 'rest';
  const mainExercise = todayPlan?.exercises.find((e) => e.category === 'main');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={false} tintColor="#f97316" onRefresh={fetchProgramState} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.appTitle}>TODAY</Text>
          <Text style={styles.subtitle}>
            MC {programState.currentMicrocycle}/3 · Day {todayPlan?.dayNumber ?? '-'}/8
          </Text>
        </View>

        {flags.medicalStop && (
          <View style={styles.medicalBanner}>
            <Text style={styles.medicalTitle}>TRAINING HALTED</Text>
            <Text style={styles.medicalBody}>
              Severe headache reported. Resolve via Flags tab before continuing.
            </Text>
          </View>
        )}

        {todayPlan ? (
          <View style={styles.sessionCard}>
            <Text style={styles.sessionLabel}>
              {isRest ? 'Rest Day' : mainExercise?.name?.replace('Competition ', '') ?? 'Training'}
            </Text>
            <Text style={styles.sessionDate}>
              {new Date(todayPlan.scheduledDate).toLocaleDateString('en-CA', {
                weekday: 'long', month: 'long', day: 'numeric'
              })}
            </Text>

            {!isRest && todayPlan.exercises.map((ex, i) => (
              <View key={i} style={styles.exerciseRow}>
                <Text style={styles.exerciseName}>{ex.name}</Text>
                <Text style={styles.exerciseDetail}>
                  {ex.loadLb > 0 ? `${ex.sets}×${ex.reps} @ ${ex.loadLb}lb` : `${ex.sets}×${ex.reps}`}
                </Text>
                {ex.rpeTarget && <Text style={styles.rpeTag}>RPE ≤{ex.rpeTarget}</Text>}
              </View>
            ))}

            {isRest && (
              <Text style={styles.restNote}>Optional: planks only. Recover well.</Text>
            )}
          </View>
        ) : (
          <View style={styles.sessionCard}>
            <Text style={styles.restNote}>No session scheduled today.</Text>
          </View>
        )}

        {(flags.benchPaused || flags.activeRPEWarning || flags.elbowPainFlagged || flags.shoulderPainFlagged) && (
          <View style={styles.flagsCard}>
            <Text style={styles.flagsTitle}>ACTIVE FLAGS</Text>
            {flags.benchPaused && <FlagItem text="Bench paused — joint pain" color="#ef4444" />}
            {flags.activeRPEWarning && <FlagItem text="RPE cap exceeded last session" color="#f97316" />}
            {flags.elbowPainFlagged && <FlagItem text="Elbow pain — monitor" color="#f97316" />}
            {flags.shoulderPainFlagged && <FlagItem text="Shoulder pain — monitor" color="#f97316" />}
          </View>
        )}

        <View style={styles.userCard}>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FlagItem({ text, color }: { text: string; color: string }) {
  return (
    <View style={styles.flagItem}>
      <View style={[styles.flagDot, { backgroundColor: color }]} />
      <Text style={[styles.flagText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090b' },
  center: { flex: 1, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 20, color: '#f4f4f5', fontWeight: '700', marginBottom: 8 },
  emptyBody: { color: '#a1a1aa', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  startBtn: {
    backgroundColor: '#f97316', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14,
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  container: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 24 },
  appTitle: { fontSize: 26, fontWeight: '900', color: '#f97316', letterSpacing: 4 },
  subtitle: { fontSize: 13, color: '#71717a', marginTop: 2 },
  medicalBanner: {
    backgroundColor: '#450a0a', borderWidth: 1, borderColor: '#991b1b',
    borderRadius: 12, padding: 16, marginBottom: 16,
  },
  medicalTitle: { color: '#fca5a5', fontWeight: '800', fontSize: 14, marginBottom: 4 },
  medicalBody: { color: '#fca5a5', fontSize: 13, lineHeight: 20 },
  sessionCard: {
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a',
    borderRadius: 16, padding: 20, marginBottom: 16,
  },
  sessionLabel: { fontSize: 22, fontWeight: '800', color: '#f4f4f5', marginBottom: 4 },
  sessionDate: { fontSize: 13, color: '#71717a', marginBottom: 16 },
  exerciseRow: { marginBottom: 12 },
  exerciseName: { fontSize: 15, fontWeight: '600', color: '#e4e4e7' },
  exerciseDetail: { fontSize: 14, color: '#a1a1aa', marginTop: 2 },
  rpeTag: { fontSize: 11, color: '#f97316', marginTop: 2 },
  restNote: { fontSize: 14, color: '#71717a', fontStyle: 'italic' },
  flagsCard: {
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a',
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  flagsTitle: { fontSize: 11, fontWeight: '700', color: '#71717a', letterSpacing: 1.5, marginBottom: 10 },
  flagItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  flagDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  flagText: { fontSize: 13 },
  userCard: {
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a',
    borderRadius: 12, padding: 16, marginTop: 12,
  },
  userName: { color: '#f4f4f5', fontSize: 15, fontWeight: '600' },
  userEmail: { color: '#71717a', fontSize: 13, marginTop: 2 },
  logoutBtn: { marginTop: 14, alignSelf: 'flex-start' },
  logoutText: { color: '#f97316', fontSize: 13, fontWeight: '600' },
});

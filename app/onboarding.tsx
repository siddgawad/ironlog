import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import api from '../api';
import { useAuthStore } from '../store/authStore';

const GOALS = [
  { key: 'strength', label: 'Get stronger', sub: 'Lift heavier on big compounds' },
  { key: 'hypertrophy', label: 'Build muscle', sub: 'Body composition focus' },
  { key: 'powerlifting', label: 'Powerlifting', sub: 'Compete or train for max bench/squat/deadlift' },
  { key: 'weight_loss', label: 'Lose weight', sub: 'Cut fat while keeping strength' },
  { key: 'general_fitness', label: 'General fitness', sub: 'Look good, feel good, stay healthy' },
  { key: 'athletic_performance', label: 'Athletic performance', sub: 'Sport-specific conditioning' },
];

const EXP_LEVELS = [
  { key: 'beginner', label: 'Beginner', sub: 'Less than a year lifting' },
  { key: 'intermediate', label: 'Intermediate', sub: '1–3 years consistent' },
  { key: 'advanced', label: 'Advanced', sub: '3+ years, know your numbers' },
];

const EQUIPMENT = [
  { key: 'full_gym', label: 'Full gym', sub: 'Barbell, racks, machines' },
  { key: 'home_gym', label: 'Home gym', sub: 'Barbell + plates at home' },
  { key: 'dumbbells_only', label: 'Dumbbells only', sub: 'No barbell access' },
  { key: 'bodyweight', label: 'Bodyweight only', sub: 'No equipment' },
];

export default function Onboarding() {
  const router = useRouter();
  const { setOnboardingComplete } = useAuthStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [goal, setGoal] = useState<string | null>(null);
  const [exp, setExp] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [age, setAge] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [bench, setBench] = useState('');
  const [squat, setSquat] = useState('');
  const [deadlift, setDeadlift] = useState('');

  const totalSteps = 6;

  const next = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    setSaving(true);
    try {
      await api.patch('/auth/me', {
        primaryGoal: goal,
        experienceLevel: exp,
        equipment,
        daysPerWeek,
        age: age ? Number(age) : null,
        weightKg: weightKg ? Number(weightKg) : null,
        currentLifts: {
          bench: bench ? Number(bench) : undefined,
          squat: squat ? Number(squat) : undefined,
          deadlift: deadlift ? Number(deadlift) : undefined,
        },
      });
      await setOnboardingComplete();
      router.replace('/(tabs)');
    } catch {
      setSaving(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return !!goal;
      case 1: return !!exp;
      case 2: return !!equipment;
      case 3: return !!daysPerWeek;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.progress}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <Section title="What's your main goal?">
              {GOALS.map((g) => (
                <Choice
                  key={g.key}
                  label={g.label}
                  sub={g.sub}
                  selected={goal === g.key}
                  onPress={() => setGoal(g.key)}
                />
              ))}
            </Section>
          )}

          {step === 1 && (
            <Section title="How experienced are you?">
              {EXP_LEVELS.map((e) => (
                <Choice
                  key={e.key}
                  label={e.label}
                  sub={e.sub}
                  selected={exp === e.key}
                  onPress={() => setExp(e.key)}
                />
              ))}
            </Section>
          )}

          {step === 2 && (
            <Section title="What equipment do you have?">
              {EQUIPMENT.map((e) => (
                <Choice
                  key={e.key}
                  label={e.label}
                  sub={e.sub}
                  selected={equipment === e.key}
                  onPress={() => setEquipment(e.key)}
                />
              ))}
            </Section>
          )}

          {step === 3 && (
            <Section title="How many days per week can you train?">
              <View style={styles.dayGrid}>
                {[2, 3, 4, 5, 6].map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayBtn, daysPerWeek === d && styles.dayBtnActive]}
                    onPress={() => setDaysPerWeek(d)}
                  >
                    <Text style={[styles.dayBtnText, daysPerWeek === d && styles.dayBtnTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>
          )}

          {step === 4 && (
            <Section title="Tell us a bit about yourself" subtitle="Optional — helps tune your program">
              <NumField label="Age" value={age} onChange={setAge} suffix="years" />
              <NumField label="Body weight" value={weightKg} onChange={setWeightKg} suffix="kg" />
            </Section>
          )}

          {step === 5 && (
            <Section title="Your current best lifts" subtitle="Optional — skip if you don't track 1RMs">
              <NumField label="Bench press" value={bench} onChange={setBench} suffix="lb" />
              <NumField label="Squat" value={squat} onChange={setSquat} suffix="lb" />
              <NumField label="Deadlift" value={deadlift} onChange={setDeadlift} suffix="lb" />
            </Section>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 && (
            <TouchableOpacity onPress={back} style={styles.backBtn}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={step === totalSteps - 1 ? finish : next}
            disabled={!canProceed() || saving}
            style={[styles.nextBtn, (!canProceed() || saving) && styles.nextBtnDisabled]}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.nextBtnText}>
                  {step === totalSteps - 1 ? 'Build my program' : 'Continue'}
                </Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      <View style={{ marginTop: 16 }}>{children}</View>
    </View>
  );
}

function Choice({ label, sub, selected, onPress }: { label: string; sub: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceActive]}
      activeOpacity={0.7}
    >
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelActive]}>{label}</Text>
      <Text style={[styles.choiceSub, selected && styles.choiceSubActive]}>{sub}</Text>
    </TouchableOpacity>
  );
}

function NumField({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix: string }) {
  return (
    <View style={styles.numField}>
      <Text style={styles.numLabel}>{label}</Text>
      <View style={styles.numRow}>
        <TextInput
          style={styles.numInput}
          value={value}
          onChangeText={(v) => onChange(v.replace(/[^0-9.]/g, ''))}
          keyboardType="numeric"
          placeholder="—"
          placeholderTextColor="#52525b"
        />
        <Text style={styles.numSuffix}>{suffix}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090b' },
  progress: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  progressDot: { width: 28, height: 4, borderRadius: 2, backgroundColor: '#27272a' },
  progressDotActive: { backgroundColor: '#f97316' },
  scroll: { padding: 24, paddingBottom: 40 },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: '#f4f4f5' },
  sectionSubtitle: { fontSize: 13, color: '#71717a', marginTop: 6 },
  choice: {
    backgroundColor: '#18181b', borderWidth: 1.5, borderColor: '#27272a',
    borderRadius: 14, padding: 16, marginBottom: 10,
  },
  choiceActive: { borderColor: '#f97316', backgroundColor: '#1c0e07' },
  choiceLabel: { fontSize: 16, fontWeight: '700', color: '#e4e4e7' },
  choiceLabelActive: { color: '#fb923c' },
  choiceSub: { fontSize: 13, color: '#71717a', marginTop: 4 },
  choiceSubActive: { color: '#fdba74' },
  dayGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  dayBtn: {
    backgroundColor: '#18181b', borderWidth: 1.5, borderColor: '#27272a',
    width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  dayBtnActive: { borderColor: '#f97316', backgroundColor: '#1c0e07' },
  dayBtnText: { fontSize: 20, fontWeight: '800', color: '#71717a' },
  dayBtnTextActive: { color: '#fb923c' },
  numField: { marginBottom: 14 },
  numLabel: { fontSize: 11, color: '#71717a', fontWeight: '600', letterSpacing: 1.2, marginBottom: 6 },
  numRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a',
    borderRadius: 12, paddingHorizontal: 14,
  },
  numInput: { flex: 1, color: '#f4f4f5', fontSize: 16, paddingVertical: 14 },
  numSuffix: { color: '#71717a', fontSize: 13 },
  footer: {
    flexDirection: 'row', gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: '#18181b',
  },
  backBtn: {
    flex: 1, backgroundColor: '#18181b', borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  backBtnText: { color: '#a1a1aa', fontWeight: '700', fontSize: 15 },
  nextBtn: {
    flex: 2, backgroundColor: '#f97316', borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

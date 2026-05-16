import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import api from '../api';
import { useAuthStore } from '../store/authStore';

const C = {
  bg: '#07080A', surface: '#111318', border: '#252A33',
  orange: '#FF6A1A', text: '#F8FAFC', textSec: '#A8B0BD', textMuted: '#69717F',
};

const GOALS = [
  { key: 'diabetes', label: 'Diabetes & Metabolic Health', sub: 'Type 2 diabetes, pre-diabetes, fatty liver' },
  { key: 'pcos', label: 'PCOS & Hormonal Balance', sub: 'Hormonal regulation, fertility, weight' },
  { key: 'weight_loss', label: 'Weight Loss', sub: 'Medical-grade, sustainable, Indian food' },
  { key: 'weight_gain', label: 'Weight Gain', sub: 'Healthy mass gain, underweight recovery' },
  { key: 'elderly_care', label: 'Elderly & Family Care', sub: 'Nutrition protocols for ageing parents' },
  { key: 'general_wellness', label: 'General Wellness', sub: 'Balanced nutrition, energy, immunity' },
];

const GENDERS = [
  { key: 'female', label: 'Female' },
  { key: 'male', label: 'Male' },
  { key: 'other', label: 'Other / Prefer not to say' },
];

const CONSULT_MODES = [
  { key: 'online', label: 'Online', sub: 'Video / WhatsApp — available worldwide' },
  { key: 'in_person', label: 'In Person', sub: 'Mumbai clinic visit' },
  { key: 'either', label: 'Either works for me' , sub: 'Flexible — Ashwini will advise' },
];

const TOTAL_STEPS = 5;

export default function Onboarding() {
  const router = useRouter();
  const { setOnboardingComplete } = useAuthStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [goal, setGoal] = useState<string | null>(null);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [conditions, setConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [consultMode, setConsultMode] = useState<string | null>(null);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canProceed = () => {
    switch (step) {
      case 0: return !!goal;
      case 1: return true;
      case 2: return true;
      case 3: return true;
      case 4: return !!consultMode;
      default: return false;
    }
  };

  const finish = async () => {
    setSaving(true);
    setError('');
    try {
      await api.patch('/auth/me', {
        goal,
        age: age ? Number(age) : null,
        gender: gender ?? null,
        medicalConditions: conditions.trim() || null,
        medications: medications.trim() || null,
        consultMode,
      });
      await setOnboardingComplete();
      router.replace('/(tabs)');
    } catch {
      setError('Could not save your profile. Check your connection.');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Progress bar */}
        <View style={styles.progress}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[styles.progressSeg, i <= step && styles.progressSegActive]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {step === 0 && (
            <Section title="What's your main health goal?" subtitle="Ashwini will build your plan around this">
              {GOALS.map((g) => (
                <Choice key={g.key} label={g.label} sub={g.sub} selected={goal === g.key} onPress={() => setGoal(g.key)} />
              ))}
            </Section>
          )}

          {step === 1 && (
            <Section title="A bit about you" subtitle="Helps personalise your nutrition protocol">
              <NumField label="Age" value={age} onChange={setAge} suffix="years" />
              <Text style={styles.fieldLabel}>Gender</Text>
              <View style={styles.pillRow}>
                {GENDERS.map((g) => (
                  <TouchableOpacity
                    key={g.key}
                    style={[styles.pill, gender === g.key && styles.pillActive]}
                    onPress={() => setGender(g.key)}
                  >
                    <Text style={[styles.pillText, gender === g.key && styles.pillTextActive]}>{g.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>
          )}

          {step === 2 && (
            <Section title="Medical conditions" subtitle="Optional — helps Ashwini tailor the plan safely">
              <TextInput
                style={styles.textArea}
                value={conditions}
                onChangeText={setConditions}
                placeholder="e.g. Type 2 diabetes, PCOD, hypothyroidism, hypertension..."
                placeholderTextColor={C.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.hint}>Leave blank if none. This is kept confidential.</Text>
            </Section>
          )}

          {step === 3 && (
            <Section title="Current medications" subtitle="Optional — affects certain dietary recommendations">
              <TextInput
                style={styles.textArea}
                value={medications}
                onChangeText={setMedications}
                placeholder="e.g. Metformin 500mg, Thyroxine 50mcg..."
                placeholderTextColor={C.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.hint}>Leave blank if none. Never changes your prescription.</Text>
            </Section>
          )}

          {step === 4 && (
            <Section title="How would you like to consult?" subtitle="Ashwini offers both online and in-person sessions">
              {CONSULT_MODES.map((m) => (
                <Choice key={m.key} label={m.label} sub={m.sub} selected={consultMode === m.key} onPress={() => setConsultMode(m.key)} />
              ))}
            </Section>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 && (
            <TouchableOpacity onPress={back} style={styles.backBtn}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={step === TOTAL_STEPS - 1 ? finish : next}
            disabled={!canProceed() || saving}
            style={[styles.nextBtn, (!canProceed() || saving) && styles.nextBtnDisabled]}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.nextBtnText}>{step === TOTAL_STEPS - 1 ? 'Complete Setup' : 'Continue'}</Text>}
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
    <TouchableOpacity onPress={onPress} style={[styles.choice, selected && styles.choiceActive]} activeOpacity={0.7}>
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelActive]}>{label}</Text>
      <Text style={[styles.choiceSub, selected && styles.choiceSubActive]}>{sub}</Text>
    </TouchableOpacity>
  );
}

function NumField({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix: string }) {
  return (
    <View style={styles.numField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.numRow}>
        <TextInput
          style={styles.numInput}
          value={value}
          onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor={C.textMuted}
        />
        <Text style={styles.numSuffix}>{suffix}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingVertical: 16 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.border },
  progressSegActive: { backgroundColor: C.orange },
  scroll: { padding: 24, paddingBottom: 40 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: C.text },
  sectionSubtitle: { fontSize: 13, color: C.textMuted, marginTop: 6 },
  choice: {
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 14, padding: 16, marginBottom: 10,
  },
  choiceActive: { borderColor: C.orange, backgroundColor: '#130C06' },
  choiceLabel: { fontSize: 15, fontWeight: '700', color: C.text },
  choiceLabelActive: { color: C.orange },
  choiceSub: { fontSize: 12, color: C.textMuted, marginTop: 4 },
  choiceSubActive: { color: '#FFA05C' },
  fieldLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600', letterSpacing: 1.2, marginBottom: 8 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  pill: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
  },
  pillActive: { borderColor: C.orange, backgroundColor: '#130C06' },
  pillText: { fontSize: 14, color: C.textSec },
  pillTextActive: { color: C.orange, fontWeight: '700' },
  numField: { marginBottom: 16 },
  numRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14,
  },
  numInput: { flex: 1, color: C.text, fontSize: 16, paddingVertical: 14 },
  numSuffix: { color: C.textMuted, fontSize: 13 },
  textArea: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 14, color: C.text, fontSize: 14,
    lineHeight: 22, minHeight: 110,
  },
  hint: { fontSize: 11, color: C.textMuted, marginTop: 8 },
  errorText: { color: '#EF4444', fontSize: 13, marginTop: 12, textAlign: 'center' },
  footer: {
    flexDirection: 'row', gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: C.surface,
  },
  backBtn: {
    flex: 1, backgroundColor: C.surface, borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  backBtnText: { color: C.textMuted, fontWeight: '700', fontSize: 15 },
  nextBtn: {
    flex: 2, backgroundColor: C.orange, borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

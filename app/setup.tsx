import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const C = {
  bg: '#07080A', surface: '#111318', elevated: '#171A21', border: '#252A33',
  orange: '#FF6A1A', green: '#22C55E', text: '#F8FAFC', textSec: '#A8B0BD', textMuted: '#69717F',
};

const WHATSAPP_NUMBER = '+919820xxxxxx'; // Replace with Ashwini's real number

function openWhatsApp() {
  const msg = "Hi Ashwini! I've just set up my profile on the app. I'd love to book my first consultation!";
  const url = `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  Linking.openURL(url).catch(() => {});
}

export default function Setup() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.iconRow}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        </View>

        <Text style={styles.title}>You're all set!</Text>
        <Text style={styles.subtitle}>
          Your health profile is ready. Ashwini will personalise your nutrition plan
          based on your goals and medical history.
        </Text>

        {/* Next steps */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsHeader}>WHAT HAPPENS NEXT</Text>
          {[
            { n: '1', label: 'Book a free 15-min intro call via WhatsApp' },
            { n: '2', label: 'Ashwini reviews your profile before the call' },
            { n: '3', label: 'You receive a personalised 4-week food plan' },
            { n: '4', label: 'Track progress right here in the app' },
          ].map((s) => (
            <View key={s.n} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{s.n}</Text></View>
              <Text style={styles.stepLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.whatsappBtn} onPress={openWhatsApp} activeOpacity={0.85}>
          <Text style={styles.whatsappIcon}>💬</Text>
          <View>
            <Text style={styles.whatsappTitle}>Book Free Intro Call</Text>
            <Text style={styles.whatsappSub}>WhatsApp · Responds within 2 hours</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.skipText}>I'll book later</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  iconRow: { alignItems: 'center', marginBottom: 24 },
  checkCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.green, alignItems: 'center', justifyContent: 'center',
  },
  checkText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '900', color: C.text, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: C.textSec, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  stepsCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 20, marginBottom: 20,
  },
  stepsHeader: {
    fontSize: 10, color: C.textMuted, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 16,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { color: C.orange, fontWeight: '800', fontSize: 13 },
  stepLabel: { flex: 1, fontSize: 14, color: C.textSec, lineHeight: 20 },
  whatsappBtn: {
    backgroundColor: C.orange, borderRadius: 14, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12,
  },
  whatsappIcon: { fontSize: 22 },
  whatsappTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  whatsappSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipText: { color: C.textMuted, fontSize: 14 },
});

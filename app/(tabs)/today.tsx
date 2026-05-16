import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';

// ── Brand constants ───────────────────────────────────────────────────────────

const C = {
  bg: '#07080A',
  surface: '#111318',
  elevated: '#171A21',
  border: '#252A33',
  orange: '#FF6A1A',
  green: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  text: '#F8FAFC',
  textSec: '#A8B0BD',
  textMuted: '#69717F',
};

const WHATSAPP_NUMBER = '+919820xxxxxx'; // Replace with Ashwini's number

const SERVICES = [
  {
    id: 'diabetes',
    title: 'Diabetes & Metabolic Health',
    desc: 'Structured food plans for Type 2, pre-diabetes and fatty liver using everyday Indian meals.',
    icon: '🩺',
  },
  {
    id: 'pcos',
    title: 'PCOS & Hormonal Balance',
    desc: 'Evidence-based nutrition for hormonal regulation, weight management and fertility support.',
    icon: '⚖️',
  },
  {
    id: 'elderly',
    title: 'Elderly & Family Care',
    desc: '90-day concierge nutrition protocol for ageing parents — NRI families welcome.',
    icon: '🤝',
  },
  {
    id: 'weight',
    title: 'Weight Management',
    desc: 'Medical-grade programs without impossible menus. Real Indian food. Sustainable results.',
    icon: '📉',
  },
];

function openWhatsApp(message = '') {
  const url = `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
  Linking.openURL(url).catch(() => {});
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { clientProfile, fetchClientData } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchClientData();
  }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchClientData();
    setRefreshing(false);
  };

  const handleBookConsult = (service?: string) => {
    const msg = service
      ? `Hi Ashwini! I'm interested in your ${service} consultation. Can we schedule a call?`
      : `Hi Ashwini! I'd like to book a nutrition consultation. Can we schedule a call?`;
    openWhatsApp(msg);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {user?.name ? `Hello, ${user.name.split(' ')[0]}` : 'Welcome'}
            </Text>
            <Text style={styles.subGreeting}>Your nutrition journey starts here</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutPill}>
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* ── Ashwini profile card ─────────────────────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.profileLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>AG</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>Ashwini Gawad</Text>
              <Text style={styles.profileTitle}>Clinical Dietitian</Text>
              <Text style={styles.profileCred}>KEM Hospital · VLCC Area Head · 25+ yrs</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <Stat value="25+" label="Years" />
            <Stat value="1000+" label="Clients" />
            <Stat value="4.9★" label="Rated" />
          </View>
        </View>

        {/* ── Primary CTA ─────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => handleBookConsult()}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaIcon}>💬</Text>
          <View>
            <Text style={styles.ctaTitle}>Book a Free 15-Min Call</Text>
            <Text style={styles.ctaSubtitle}>WhatsApp · Respond within 2 hours</Text>
          </View>
        </TouchableOpacity>

        {/* ── Chat with AI coach ───────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.aiCard}
          onPress={() => router.push('/(tabs)')}
          activeOpacity={0.85}
        >
          <View style={styles.aiCardLeft}>
            <View style={styles.aiDot} />
            <View>
              <Text style={styles.aiTitle}>Ask the Nutrition Coach</Text>
              <Text style={styles.aiSub}>AI-powered · Ashwini's protocols · Always available</Text>
            </View>
          </View>
          <Text style={styles.aiArrow}>›</Text>
        </TouchableOpacity>

        {/* ── Services ────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>SERVICES</Text>

        {SERVICES.map((svc) => (
          <TouchableOpacity
            key={svc.id}
            style={styles.serviceCard}
            onPress={() => handleBookConsult(svc.title)}
            activeOpacity={0.8}
          >
            <Text style={styles.serviceIcon}>{svc.icon}</Text>
            <View style={styles.serviceBody}>
              <Text style={styles.serviceTitle}>{svc.title}</Text>
              <Text style={styles.serviceDesc}>{svc.desc}</Text>
            </View>
            <Text style={styles.serviceArrow}>›</Text>
          </TouchableOpacity>
        ))}

        {/* ── Trust signals ────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>WHY ASHWINI</Text>
        <View style={styles.trustCard}>
          {[
            'Trained at KEM Hospital — ICU & OPD nutrition',
            'Led 25+ VLCC centres across India',
            'Specialises in Indian food — no impossible menus',
            'Online consultations available worldwide',
            'MSME-certified New Product Development',
          ].map((t) => (
            <View key={t} style={styles.trustRow}>
              <Text style={styles.trustDot}>·</Text>
              <Text style={styles.trustText}>{t}</Text>
            </View>
          ))}
        </View>

        {/* ── Track my plan ────────────────────────────────────────────────── */}
        {clientProfile?.onboardingComplete && (
          <>
            <Text style={styles.sectionLabel}>MY PLAN</Text>
            <TouchableOpacity
              style={styles.planCard}
              onPress={() => router.push('/(tabs)/history')}
              activeOpacity={0.85}
            >
              <Text style={styles.planCardText}>Track your progress →</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: C.text },
  subGreeting: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  logoutPill: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  logoutText: { color: C.textMuted, fontSize: 12 },

  profileCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  profileLeft: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '800', color: C.text },
  profileTitle: { fontSize: 13, color: C.orange, fontWeight: '600', marginTop: 1 },
  profileCred: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 20 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 10, color: C.textMuted, marginTop: 1 },

  ctaButton: {
    backgroundColor: C.orange, borderRadius: 14, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginBottom: 10,
  },
  ctaIcon: { fontSize: 22 },
  ctaTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  ctaSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  aiCard: {
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
  },
  aiCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  aiDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: C.green,
  },
  aiTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  aiSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  aiArrow: { fontSize: 22, color: C.textMuted },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: C.textMuted,
    letterSpacing: 1.5, marginBottom: 10, marginTop: 4,
  },

  serviceCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14, flexDirection: 'row',
    alignItems: 'center', gap: 12, marginBottom: 10,
  },
  serviceIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  serviceBody: { flex: 1 },
  serviceTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  serviceDesc: { fontSize: 12, color: C.textSec, marginTop: 3, lineHeight: 17 },
  serviceArrow: { fontSize: 20, color: C.textMuted },

  trustCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  trustRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-start', gap: 8 },
  trustDot: { color: C.orange, fontSize: 16, lineHeight: 18 },
  trustText: { fontSize: 13, color: C.textSec, flex: 1, lineHeight: 18 },

  planCard: {
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10,
  },
  planCardText: { color: C.orange, fontWeight: '700', fontSize: 14 },
});

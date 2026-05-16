import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAppStore } from '../../store/appStore';

const C = {
  bg: '#07080A', surface: '#111318', elevated: '#171A21', border: '#252A33',
  orange: '#FF6A1A', green: '#22C55E', warning: '#F59E0B', text: '#F8FAFC',
  textSec: '#A8B0BD', textMuted: '#69717F',
};

const WHATSAPP_NUMBER = '+919820xxxxxx';

function openWhatsApp(msg = '') {
  const url = `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  Linking.openURL(url).catch(() => {});
}

export default function MyPlan() {
  const { todayDiet, fetchClientData } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { fetchClientData(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchClientData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange} />}
      >
        <Text style={styles.title}>My Plan</Text>

        {todayDiet ? (
          <>
            <Text style={styles.sectionLabel}>TODAY'S MEALS</Text>
            {todayDiet.meals.length === 0 ? (
              <Text style={styles.empty}>No meals scheduled for today.</Text>
            ) : (
              todayDiet.meals.map((meal, i) => (
                <View key={i} style={styles.mealCard}>
                  <View style={styles.mealTime}>
                    <Text style={styles.mealTimeText}>{meal.time}</Text>
                  </View>
                  <View style={styles.mealBody}>
                    <Text style={styles.mealDesc}>{meal.description}</Text>
                    {meal.notes ? <Text style={styles.mealNotes}>{meal.notes}</Text> : null}
                  </View>
                </View>
              ))
            )}

            {todayDiet.waterTargetMl > 0 && (
              <View style={styles.waterCard}>
                <Text style={styles.waterIcon}>💧</Text>
                <View>
                  <Text style={styles.waterTitle}>Water Target</Text>
                  <Text style={styles.waterValue}>{(todayDiet.waterTargetMl / 1000).toFixed(1)} litres today</Text>
                </View>
              </View>
            )}

            {todayDiet.notes ? (
              <>
                <Text style={styles.sectionLabel}>ASHWINI'S NOTES</Text>
                <View style={styles.notesCard}>
                  <Text style={styles.notesText}>{todayDiet.notes}</Text>
                </View>
              </>
            ) : null}
          </>
        ) : (
          <View style={styles.noplanCard}>
            <Text style={styles.noplanTitle}>Your plan isn't set up yet</Text>
            <Text style={styles.noplanBody}>
              Book a consultation with Ashwini and she'll create a personalised
              daily diet plan that appears here.
            </Text>
            <TouchableOpacity
              style={styles.bookBtn}
              onPress={() => openWhatsApp("Hi Ashwini! I'd like to book a consultation to get started with my diet plan.")}
              activeOpacity={0.85}
            >
              <Text style={styles.bookBtnText}>💬  Book Consultation</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Resources */}
        <Text style={styles.sectionLabel}>QUICK TIPS</Text>
        {[
          { icon: '🥗', title: 'Eat slowly', body: 'Put your fork down between bites. It takes 20 min for satiety signals to reach your brain.' },
          { icon: '🕐', title: 'Meal timing matters', body: 'Try to eat meals at consistent times daily to regulate blood sugar and hormones.' },
          { icon: '🚶', title: 'Post-meal walk', body: '10–15 min walk after meals significantly improves insulin sensitivity.' },
          { icon: '🚫', title: 'Avoid late-night eating', body: 'Stop eating 2–3 hours before bed. The liver repairs overnight and needs a break.' },
        ].map((tip) => (
          <View key={tip.title} style={styles.tipCard}>
            <Text style={styles.tipIcon}>{tip.icon}</Text>
            <View style={styles.tipBody}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipText}>{tip.body}</Text>
            </View>
          </View>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 20 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: C.textMuted,
    letterSpacing: 1.5, marginBottom: 10, marginTop: 4,
  },
  empty: { color: C.textMuted, fontSize: 14, marginBottom: 16 },

  mealCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14, flexDirection: 'row',
    alignItems: 'flex-start', gap: 14, marginBottom: 10,
  },
  mealTime: {
    backgroundColor: C.elevated, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, minWidth: 60, alignItems: 'center',
  },
  mealTimeText: { fontSize: 12, fontWeight: '700', color: C.orange },
  mealBody: { flex: 1 },
  mealDesc: { fontSize: 14, color: C.text, lineHeight: 20 },
  mealNotes: { fontSize: 12, color: C.textMuted, marginTop: 4, lineHeight: 18 },

  waterCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14, flexDirection: 'row',
    alignItems: 'center', gap: 14, marginBottom: 16,
  },
  waterIcon: { fontSize: 24 },
  waterTitle: { fontSize: 12, color: C.textMuted, marginBottom: 2 },
  waterValue: { fontSize: 16, fontWeight: '800', color: '#60A5FA' },

  notesCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  notesText: { fontSize: 14, color: C.textSec, lineHeight: 22 },

  noplanCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24,
  },
  noplanTitle: { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 8 },
  noplanBody: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  bookBtn: {
    backgroundColor: C.orange, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  bookBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  tipCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14, flexDirection: 'row',
    alignItems: 'flex-start', gap: 12, marginBottom: 10,
  },
  tipIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  tipBody: { flex: 1 },
  tipTitle: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 3 },
  tipText: { fontSize: 12, color: C.textMuted, lineHeight: 18 },
});

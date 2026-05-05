import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONSENT_KEY = 'ironlog_llm_consent_v1';

export async function hasLLMConsent(): Promise<boolean> {
  const v = await AsyncStorage.getItem(CONSENT_KEY);
  return v === 'granted';
}

export async function grantLLMConsent(): Promise<void> {
  await AsyncStorage.setItem(CONSENT_KEY, 'granted');
}

type Props = { onGranted: () => void; onDeclined: () => void };

export default function LLMConsentGate({ onGranted, onDeclined }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAccept = async () => {
    setSaving(true);
    await grantLLMConsent();
    setSaving(false);
    onGranted();
  };

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" visible>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Before You Chat with Your Coach</Text>
          <Text style={styles.subtitle}>Data & Privacy Disclosure</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>What gets sent</Text>
            <Text style={styles.cardBody}>
              When you message the AI coach, your workout descriptions and chat history are sent to
              Groq, Inc. (a US-based company) for processing. Groq's servers are located in the
              United States and are subject to US laws.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>What is NOT sent</Text>
            <Text style={styles.cardBody}>
              Your name, email, or any personally identifying information is never sent to Groq.
              Only the text you type in the chat is transmitted.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your rights (PIPEDA)</Text>
            <Text style={styles.cardBody}>
              Under Canada's Personal Information Protection and Electronic Documents Act (PIPEDA),
              you have the right to access and request deletion of your data at any time. Contact:
              siddhantgawad4@gmail.com
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => Linking.openURL('https://groq.com/privacy-policy')}
            style={styles.link}
          >
            <Text style={styles.linkText}>Groq Privacy Policy ↗</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAgreed((v) => !v)}
            style={styles.checkRow}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>
              I understand my workout descriptions will be sent to Groq in the US for AI processing,
              and I consent to this.
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.acceptBtn, (!agreed || saving) && styles.acceptBtnDisabled]}
            onPress={handleAccept}
            disabled={!agreed || saving}
          >
            <Text style={styles.acceptBtnText}>
              {saving ? 'Saving...' : 'Continue to Chat'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDeclined} style={styles.declineBtn}>
            <Text style={styles.declineBtnText}>No thanks — use manual logging</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090b' },
  container: { padding: 24, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#f4f4f5', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#71717a', marginBottom: 24 },
  card: {
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a',
    borderRadius: 12, padding: 16, marginBottom: 12,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#e4e4e7', marginBottom: 6 },
  cardBody: { fontSize: 13, color: '#a1a1aa', lineHeight: 20 },
  link: { marginBottom: 24 },
  linkText: { fontSize: 13, color: '#f97316', textDecorationLine: 'underline' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#52525b',
    alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: '#f97316', borderColor: '#f97316' },
  checkmark: { color: '#fff', fontWeight: '800', fontSize: 13 },
  checkLabel: { flex: 1, fontSize: 13, color: '#a1a1aa', lineHeight: 20 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#27272a', gap: 10 },
  acceptBtn: {
    backgroundColor: '#f97316', borderRadius: 12, padding: 16, alignItems: 'center',
  },
  acceptBtnDisabled: { opacity: 0.4 },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  declineBtn: { alignItems: 'center', paddingVertical: 8 },
  declineBtnText: { color: '#71717a', fontSize: 13 },
});

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email or password incorrect.',
  MISSING_FIELDS: 'Please fill in all fields.',
  LOGIN_FAILED: 'Could not log in. Check your connection.',
};

export default function Login() {
  const router = useRouter();
  const { login, loading, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    const ok = await login(email.trim(), password);
    if (ok) router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}><Text style={styles.avatarText}>AG</Text></View>
          </View>
          <Text style={styles.brand}>Ashwini Gawad</Text>
          <Text style={styles.subtitle}>Clinical Dietitian · Sign in to your account</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#52525b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#52525b"
              secureTextEntry
              autoComplete="password"
            />
          </View>

          {error && (
            <Text style={styles.error}>{ERROR_MESSAGES[error] ?? error}</Text>
          )}

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading || !email || !password}
            style={[styles.button, (loading || !email || !password) && styles.buttonDisabled]}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Log In</Text>}
          </TouchableOpacity>

          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity style={styles.linkRow}>
              <Text style={styles.linkText}>
                New here? <Text style={styles.linkTextBold}>Create an account</Text>
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07080A' },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  avatarRow: { alignItems: 'center', marginBottom: 16 },
  avatarCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#FF6A1A',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: 2 },
  brand: { fontSize: 24, fontWeight: '900', color: '#F8FAFC', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#69717F', marginBottom: 36, textAlign: 'center' },
  field: { marginBottom: 16 },
  label: { fontSize: 11, color: '#69717F', fontWeight: '600', letterSpacing: 1.2, marginBottom: 6 },
  input: {
    backgroundColor: '#111318', borderWidth: 1, borderColor: '#252A33',
    borderRadius: 12, padding: 14, color: '#F8FAFC', fontSize: 15,
  },
  error: { color: '#EF4444', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  button: {
    backgroundColor: '#FF6A1A', borderRadius: 12, padding: 16, alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  linkRow: { alignItems: 'center', marginTop: 20 },
  linkText: { color: '#69717F', fontSize: 14 },
  linkTextBold: { color: '#FF6A1A', fontWeight: '700' },
});

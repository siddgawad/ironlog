import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useKeepAlive } from '../hooks/useKeepAlive';

export default function RootLayout() {
  const fetchClientData = useAppStore((s) => s.fetchClientData);
  const { user, loading, hydrate } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useKeepAlive();

  useEffect(() => { hydrate(); }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && !user.onboardingComplete && !inOnboarding) {
      router.replace('/onboarding');
    } else if (user && user.onboardingComplete && (inAuthGroup || inOnboarding)) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  useEffect(() => {
    if (user?.onboardingComplete) fetchClientData();
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#f97316" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#09090b' }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#09090b' } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="setup" options={{ presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

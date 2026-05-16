import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';

const C = { orange: '#FF6A1A', muted: '#69717F', tabBg: '#07080A', border: '#111318' };

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 4 }}>
      <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.55 }}>{icon}</Text>
      <View style={{
        width: 4, height: 4, borderRadius: 2, marginTop: 3,
        backgroundColor: focused ? C.orange : 'transparent',
      }} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.tabBg,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: C.orange,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused }) => <TabIcon icon="💬" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Progress',
          tabBarIcon: ({ focused }) => <TabIcon icon="📈" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="flags"
        options={{
          title: 'My Plan',
          tabBarIcon: ({ focused }) => <TabIcon icon="🥗" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

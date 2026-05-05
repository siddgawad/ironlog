import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 4 }}>
      <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.6 }}>{icon}</Text>
      <View style={{
        width: 4, height: 4, borderRadius: 2, marginTop: 3,
        backgroundColor: focused ? '#f97316' : 'transparent',
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
          backgroundColor: '#0a0a0a',
          borderTopColor: '#18181b',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#f97316',
        tabBarInactiveTintColor: '#71717a',
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
          title: 'Today',
          tabBarIcon: ({ focused }) => <TabIcon icon="⚡" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => <TabIcon icon="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="flags"
        options={{
          title: 'Flags',
          tabBarIcon: ({ focused }) => <TabIcon icon="🚩" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

import React from 'react';
import { Text, View } from 'react-native';

export default function SmokeRoot() {
  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827' }}>
          Bootstrap OK
        </Text>
        <Text style={{ fontSize: 14, textAlign: 'center', color: '#4b5563' }}>
          If you can see this screen, the SharedArrayBuffer crash is happening in expo-router or app imports,
          not in the bare Expo runtime.
        </Text>
      </View>
    </View>
  );
}


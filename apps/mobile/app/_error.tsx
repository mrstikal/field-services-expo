import { View, Text, StyleSheet, Button } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ErrorBoundary() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.subtitle}>We apologize, but an unexpected error occurred</Text>
      <Button title="Back to home" onPress={() => router.push('/')} />
    </View>
  );
}

/* eslint-disable react-native/no-color-literals */
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  title: {
    color: '#1f2937',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
});
import { View, Text, Button, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>404 - Page Not Found</Text>
      <Text style={styles.message}>Sorry, the page you requested does not exist.</Text>
      <Button title="Back to Home" onPress={() => router.replace('/')} />
    </View>
  );
}

/* eslint-disable react-native/no-color-literals */
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  message: {
    color: '#6b7280',
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  title: {
    color: '#ef4444',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});
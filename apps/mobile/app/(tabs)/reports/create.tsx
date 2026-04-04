import { View, Text, StyleSheet } from 'react-native';

export default function CreateReportScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nový report</Text>
      <Text style={styles.subtitle}>Toto je formulář pro vytvoření nového reportu</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
  },
});
import { View, Text, StyleSheet } from 'react-native';

export default function CreateReportScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Report</Text>
      <Text style={styles.subtitle}>This is the form for creating a new report</Text>
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
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 16,
    marginTop: 8,
  },
  title: {
    color: '#1e40af',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
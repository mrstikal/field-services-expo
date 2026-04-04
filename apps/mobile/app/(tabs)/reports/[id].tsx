import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['report', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: id !== undefined,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading report...</Text>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.center}>
        <Text>Failed to load report.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Report #{report.id.slice(0, 8)}</Text>
      <Text>Status: {report.status}</Text>
      <Text>Created at: {new Date(report.created_at).toLocaleString()}</Text>
      <Text>Updated at: {new Date(report.updated_at).toLocaleString()}</Text>
      {/* Render photos, form data, signature as needed */}
      <Text>Task ID: {report.task_id}</Text>
      {/* Add more detailed fields here */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
});
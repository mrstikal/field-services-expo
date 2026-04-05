import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams();

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
      <View className="flex-1 items-center justify-center">
        <Text>Loading report...</Text>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Failed to load report.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <Text className="mb-3 text-xl font-semibold">Report #{report.id.slice(0, 8)}</Text>
      <Text>Status: {report.status}</Text>
      <Text>Created at: {new Date(report.created_at).toLocaleString()}</Text>
      <Text>Updated at: {new Date(report.updated_at).toLocaleString()}</Text>
      {/* Render photos, form data, signature as needed */}
      <Text>Task ID: {report.task_id}</Text>
      {/* Add more detailed fields here */}
    </ScrollView>
  );
}


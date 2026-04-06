 import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { paddingStyles } from '@/lib/styles';

interface Task {
  title: string;
}

interface Report {
  id: string;
  task_id: string;
  tasks: Task[];
  status: 'draft' | 'completed' | 'synced';
  created_at: string;
  updated_at: string;
}

const getStatusClassName = (status: string) => {
  switch (status) {
    case 'draft':
      return 'bg-orange-500';
    case 'completed':
      return 'bg-green-500';
    case 'synced':
      return 'bg-blue-800';
    default:
      return 'bg-gray-500';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'completed':
      return 'Completed';
    case 'synced':
      return 'Synced';
    default:
      return status;
  }
};

export default function ReportsListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const { data } = await supabase
        .from('reports')
        .select(`
          id,
          task_id,
          tasks!inner(title),
          status,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const renderReportCard = ({ item }: { item: Report }) => (
    <TouchableOpacity
      className="mb-3 rounded-lg border-l-4 border-l-blue-800 bg-white p-3"
      onPress={() => router.push(`/reports/${item.id}`)}
    >
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-800">Report #{item.id.slice(0, 8)}</Text>
          <Text className="mt-1 text-xs text-gray-500">
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View className={`ml-2 rounded px-2 py-1 ${getStatusClassName(item.status)}`}>
          <Text className="text-[10px] font-semibold text-white">{getStatusLabel(item.status)}</Text>
        </View>
      </View>
      <View className="flex-row items-center">
        <Ionicons color="#6b7280" name="document-text-outline" size={14} />
        <Text className="ml-1.5 text-[11px] text-gray-500">Task: {item.tasks[0]?.title || 'Unknown'}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-gray-200 bg-white px-4 py-4" style={{ paddingTop: insets.top + 16 }}>
        <Text className="text-xl font-semibold text-gray-800">My Reports</Text>
        <Text className="mt-1 text-sm text-gray-500">{reports.length} reports total</Text>
      </View>

      <View className="border-b border-gray-200 bg-white px-4 py-3">
        <TouchableOpacity
          className="flex-row items-center justify-center rounded-lg bg-blue-800 px-4 py-3"
          onPress={() => router.push('/reports/create')}
        >
          <Ionicons color="#ffffff" name="add-circle-outline" size={20} />
          <Text className="ml-2 text-sm font-semibold text-white">New Report</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text>Loading reports...</Text>
        </View>
      ) : reports.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons color="#d1d5db" name="document-outline" size={48} />
          <Text className="mt-3 text-base font-semibold text-gray-400">No reports yet</Text>
          <Text className="mt-1 text-sm text-gray-300">Create your first report to get started</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={paddingStyles.contentContainer}
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderReportCard}
          scrollEnabled
        />
      )}
    </View>
  );
}
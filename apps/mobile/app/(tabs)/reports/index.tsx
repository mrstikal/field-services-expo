import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

interface Report {
  id: string;
  task_id: string;
  status: 'draft' | 'completed' | 'synced';
  created_at: string;
  updated_at: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'draft':
      return '#f97316';
    case 'completed':
      return '#22c55e';
    case 'synced':
      return '#1e40af';
    default:
      return '#6b7280';
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
  const router = useRouter();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const { data } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const renderReportCard = ({ item }: { item: Report }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => router.push(`/reports/${item.id}`)}
    >
      <View style={styles.reportHeader}>
        <View style={styles.flexContainer}>
          <Text style={styles.reportTitle}>Report #{item.id.slice(0, 8)}</Text>
          <Text style={styles.reportDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>
      <View style={styles.reportFooter}>
        <Ionicons name="document-text-outline" size={14} color="#6b7280" />
        <Text style={styles.reportMeta}>Task: {item.task_id.slice(0, 8)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Reports</Text>
        <Text style={styles.headerSubtitle}>{reports.length} reports total</Text>
      </View>

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/reports/create')}
        >
          <Ionicons name="add-circle-outline" size={20} color="#ffffff" />
          <Text style={styles.createButtonText}>New Report</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text>Loading reports...</Text>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>No reports yet</Text>
          <Text style={styles.emptySubtext}>Create your first report to get started</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          renderItem={renderReportCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          scrollEnabled={true}
        />
      )}
    </View>
  );
}

/* eslint-disable react-native/no-color-literals */
const styles = StyleSheet.create({
  actionBar: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  container: {
    backgroundColor: '#f9fafb',
    flex: 1,
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: '#1e40af',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptySubtext: {
    color: '#d1d5db',
    fontSize: 14,
    marginTop: 4,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  flexContainer: {
    flex: 1,
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerSubtitle: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
  },
  headerTitle: {
    color: '#1f2937',
    fontSize: 20,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  reportCard: {
    backgroundColor: '#ffffff',
    borderLeftColor: '#1e40af',
    borderLeftWidth: 4,
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
  },
  reportDate: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
  },
  reportFooter: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  reportHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reportMeta: {
    color: '#6b7280',
    fontSize: 11,
    marginLeft: 6,
  },
  reportTitle: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    borderRadius: 4,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
});

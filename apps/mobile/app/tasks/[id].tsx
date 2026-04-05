/* eslint-disable react-native/no-color-literals, react-native/no-inline-styles */
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRealtimeTask } from '@/lib/hooks/use-realtime-tasks';

interface Task {
  id: string;
  title: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  status: 'assigned' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  due_date: string;
  customer_name: string;
  customer_phone: string;
  estimated_time: number;
  technician_id: string | null;
  created_at: string;
  updated_at: string;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return '#dc2626';
    case 'high':
      return '#f97316';
    case 'medium':
      return '#eab308';
    case 'low':
      return '#22c55e';
    default:
      return '#6b7280';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'assigned':
      return 'Assigned';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
};

const getCategoryLabel = (category: string) => {
  switch (category) {
    case 'repair':
      return 'Repair';
    case 'installation':
      return 'Installation';
    case 'maintenance':
      return 'Maintenance';
    case 'inspection':
      return 'Inspection';
    default:
      return category;
  }
};

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // Enable real-time updates for this specific task
  useRealtimeTask(id);

  const { data: task, isLoading, error } = useQuery({
    queryKey: ['task', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Task;
    },
    enabled: !!id,
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleNavigate = () => {
    if (task?.latitude && task?.longitude) {
      const url = `geo:${task.latitude},${task.longitude}?q=${encodeURIComponent(task.address)}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Maps are not available');
      });
    }
  };

  const handleCall = () => {
    if (task?.customer_phone) {
      Linking.openURL(`tel:${task.customer_phone}`).catch(() => {
        Alert.alert('Error', 'Calling is not available');
      });
    }
  };

  const queryClient = useQueryClient();

  const handleStartWork = async () => {
    if (!task) return;
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', task.id);
      
      if (error) {
        Alert.alert('Error', 'Failed to start task');
        return;
      }

      // Invalidate cache
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['task', id] });
      
      Alert.alert('Success', 'Task has been started');
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to start task');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['task', id] });
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#1e40af" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Task Detail</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </View>
    );
  }

  if (error || !task) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#1e40af" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Task Detail</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>Failed to load task</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1e40af" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task Detail</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Title and Status */}
        <View style={styles.section}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{task.title}</Text>
              <Text style={styles.category}>{getCategoryLabel(task.category)}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getPriorityColor(task.priority) },
              ]}
            >
              <Text style={styles.statusText}>{task.priority}</Text>
            </View>
          </View>
        </View>

        {/* Status */}
        <View style={styles.section}>
          <View style={styles.statusRow}>
            <Text style={styles.label}>Status:</Text>
            <View style={styles.statusIndicator}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      task.status === 'completed'
                        ? '#22c55e'
                        : task.status === 'in_progress'
                        ? '#f97316'
                        : '#3b82f6',
                  },
                ]}
              />
              <Text style={styles.statusValue}>{getStatusLabel(task.status)}</Text>
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Work Description</Text>
          <Text style={styles.description}>{task.description}</Text>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Contact</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={16} color="#6b7280" />
              <Text style={styles.infoText}>{task.customer_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={16} color="#6b7280" />
              <Text style={styles.infoText}>{task.customer_phone}</Text>
            </View>
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Work Location</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color="#6b7280" />
              <Text style={styles.infoText}>{task.address}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="navigate-outline" size={16} color="#6b7280" />
              <Text style={styles.infoText}>
                {task.latitude.toFixed(4)}, {task.longitude.toFixed(4)}
              </Text>
            </View>
          </View>
        </View>

        {/* Time and Priority */}
        <View style={styles.section}>
          <View style={styles.twoColumnRow}>
            <View style={styles.column}>
              <Text style={styles.label}>Estimated Time:</Text>
              <Text style={styles.value}>{task.estimated_time} minutes</Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Priority:</Text>
              <Text style={[styles.value, { color: getPriorityColor(task.priority) }]}>
                {task.priority.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Due Date */}
        <View style={styles.section}>
          <Text style={styles.label}>Due Date:</Text>
          <Text style={styles.value}>
            {new Date(task.due_date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.actionButton} onPress={handleNavigate}>
            <Ionicons name="navigate" size={20} color="#ffffff" />
            <Text style={styles.actionButtonText}>Navigate</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.callButton]} onPress={handleCall}>
            <Ionicons name="call" size={20} color="#ffffff" />
            <Text style={styles.actionButtonText}>Call</Text>
          </TouchableOpacity>

          {task.status !== 'completed' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={handleStartWork}
            >
              <Ionicons name="play" size={20} color="#ffffff" />
              <Text style={styles.actionButtonText}>
                {task.status === 'in_progress' ? 'In Progress' : 'Start Work'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#1e40af',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  callButton: {
    backgroundColor: '#059669',
  },
  category: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  column: {
    flex: 1,
  },
  container: {
    backgroundColor: '#f9fafb',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  description: {
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
  },
  errorContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: '#1f2937',
    fontSize: 18,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoText: {
    color: '#1f2937',
    flex: 1,
    fontSize: 14,
    marginLeft: 12,
  },
  label: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  startButton: {
    backgroundColor: '#f97316',
  },
  statusBadge: {
    borderRadius: 6,
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusDot: {
    borderRadius: 4,
    height: 8,
    marginRight: 8,
    width: 8,
  },
  statusIndicator: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusValue: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    color: '#1f2937',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  twoColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  value: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '600',
  },
});

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

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
      return 'Přiřazeno';
    case 'in_progress':
      return 'Rozpracováno';
    case 'completed':
      return 'Dokončeno';
    default:
      return status;
  }
};

const getCategoryLabel = (category: string) => {
  switch (category) {
    case 'repair':
      return 'Oprava';
    case 'installation':
      return 'Instalace';
    case 'maintenance':
      return 'Údržba';
    case 'inspection':
      return 'Kontrola';
    default:
      return category;
  }
};

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

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

  const handleNavigate = () => {
    if (task?.latitude && task?.longitude) {
      const url = `geo:${task.latitude},${task.longitude}?q=${encodeURIComponent(task.address)}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Chyba', 'Mapy nejsou dostupné');
      });
    }
  };

  const handleCall = () => {
    if (task?.customer_phone) {
      Linking.openURL(`tel:${task.customer_phone}`).catch(() => {
        Alert.alert('Chyba', 'Telefonování není dostupné');
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
      
      if (error) throw error;
      
      // Invalidovat cache
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['task', id] });
      
      Alert.alert('Úspěch', 'Úkol byl zahájen');
      router.back();
    } catch (err) {
      Alert.alert('Chyba', 'Nepodařilo se zahájit úkol');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#1e40af" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detail úkolu</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text>Načítání...</Text>
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
          <Text style={styles.headerTitle}>Detail úkolu</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>Úkol se nepodařilo načíst</Text>
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
        <Text style={styles.headerTitle}>Detail úkolu</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.label}>Stav:</Text>
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
          <Text style={styles.sectionTitle}>Popis práce</Text>
          <Text style={styles.description}>{task.description}</Text>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kontakt na zákazníka</Text>
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
          <Text style={styles.sectionTitle}>Místo práce</Text>
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
              <Text style={styles.label}>Odhadovaný čas:</Text>
              <Text style={styles.value}>{task.estimated_time} minut</Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Priorita:</Text>
              <Text style={[styles.value, { color: getPriorityColor(task.priority) }]}>
                {task.priority.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Due Date */}
        <View style={styles.section}>
          <Text style={styles.label}>Termín:</Text>
          <Text style={styles.value}>
            {new Date(task.due_date).toLocaleDateString('cs-CZ', {
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
            <Text style={styles.actionButtonText}>Navigovat</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.callButton]} onPress={handleCall}>
            <Ionicons name="call" size={20} color="#ffffff" />
            <Text style={styles.actionButtonText}>Zavolat</Text>
          </TouchableOpacity>

          {task.status !== 'completed' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={handleStartWork}
            >
              <Ionicons name="play" size={20} color="#ffffff" />
              <Text style={styles.actionButtonText}>
                {task.status === 'in_progress' ? 'Rozpracováno' : 'Zahájit práci'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#1f2937',
    marginLeft: 12,
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  twoColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e40af',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  callButton: {
    backgroundColor: '#059669',
  },
  startButton: {
    backgroundColor: '#f97316',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginTop: 12,
  },
});

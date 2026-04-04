import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { taskRepository } from '@/lib/db/task-repository';
import { useOfflineSync } from '@/lib/hooks/use-offline-sync';
import { useIsOnline } from '@/lib/hooks/use-network-status';

interface Task {
  id: string;
  title: string;
  status: 'assigned' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isOnline = useIsOnline();
  const { sync, isSyncing } = useOfflineSync();

  // Fetch from local database first (offline-first)
  useEffect(() => {
    const fetchLocalTasks = async () => {
      try {
        const tasks = await taskRepository.getAll();
        setLocalTasks(tasks);
        
        // Filter for today's assigned tasks
        const today = new Date().toISOString().split('T')[0];
        const filtered = tasks.filter(
          (t) => t.status === 'assigned' && t.due_date.startsWith(today)
        );
        setTodayTasks(filtered);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching local tasks:', error);
        setIsLoading(false);
      }
    };

    fetchLocalTasks();
  }, []);

  // Sync with server when online
  useEffect(() => {
    if (isOnline && !isSyncing) {
      sync();
    }
  }, [isOnline, isSyncing, sync]);

  // Fallback to server if local data is empty and online
  useEffect(() => {
    if (isOnline && localTasks.length === 0 && !isLoading) {
      const fetchServerTasks = async () => {
        try {
          const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('status', 'assigned')
            .order('created_at', { ascending: false });
          
          if (data && data.length > 0) {
            // Save to local database
            for (const task of data) {
              await taskRepository.create(task);
            }
            setLocalTasks(data);
            
            const today = new Date().toISOString().split('T')[0];
            const filtered = data.filter(
              (t) => t.status === 'assigned' && t.due_date.startsWith(today)
            );
            setTodayTasks(filtered);
          }
        } catch (error) {
          console.error('Error fetching server tasks:', error);
        }
      };

      fetchServerTasks();
    }
  }, [isOnline, localTasks.length, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={styles.loadingText}>Loading tasks...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Hello, Technician!</Text>
        <Text style={styles.subtitle}>You have {todayTasks.length} new tasks</Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{todayTasks.length}</Text>
          <Text style={styles.statLabel}>New Tasks</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {localTasks.filter((t) => t.status === 'completed').length}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {localTasks.filter((t) => new Date(t.due_date) < new Date() && t.status !== 'completed').length}
          </Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Tasks</Text>
        {todayTasks.length === 0 ? (
          <Text style={styles.emptyText}>No new tasks for today</Text>
        ) : (
          todayTasks.map((task) => (
            <View key={task.id} style={styles.taskCard}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={styles.taskStatus}>{task.status}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1e40af',
  },
  taskCard: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  taskStatus: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    color: '#6b7280',
  },
});
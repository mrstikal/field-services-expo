import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { taskRepository } from '@/lib/db/task-repository';
import { useOfflineSync } from '@/lib/hooks/use-offline-sync';
import { useIsOnline } from '@/lib/hooks/use-network-status';
import { useLocationTracking } from '@/lib/hooks/use-location-tracking';
import { useGeofencing } from '@/lib/hooks/use-geofencing';

interface Task {
  id: string;
  title: string;
  address?: string;
  latitude: number;
  longitude: number;
  status: 'assigned' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string;
}

export default function HomeScreen() {
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isOnline = useIsOnline();
  const { sync, isSyncing } = useOfflineSync();
  const { location, isTracking, requestPermissions, startTracking, stopTracking } = useLocationTracking();
  const { currentTask, isNearTask, updateLocation, setTrackedTasks, checkGeofence } = useGeofencing();

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

  // Start lightweight foreground location tracking for geofence checks.
  useEffect(() => {
    const bootstrapLocationTracking = async () => {
      const permission = await requestPermissions();
      if (permission.status === 'granted') {
        await startTracking();
      }
    };

    bootstrapLocationTracking();

    return () => {
      stopTracking();
    };
  }, [requestPermissions, startTracking, stopTracking]);

  useEffect(() => {
    if (location) {
      updateLocation(location);
    }
  }, [location, updateLocation]);

  useEffect(() => {
    const geofenceTasks = todayTasks
      .map(task => ({
        id: task.id,
        title: task.title,
        latitude: task.latitude,
        longitude: task.longitude,
        address: task.address ?? 'Unknown address',
      }));

    setTrackedTasks(geofenceTasks);
    checkGeofence(geofenceTasks);
  }, [todayTasks, setTrackedTasks, checkGeofence]);

  // Fallback to server if local data is empty and online
  useEffect(() => {
    if (isOnline && localTasks.length === 0 && !isLoading) {
      const fetchServerTasks = async () => {
        try {
          const { data } = await supabase
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
        <Text style={styles.trackingStatus}>
          Tracking: {isTracking ? 'active' : 'inactive'}
        </Text>
        {isNearTask && currentTask ? (
          <View style={styles.geofenceBanner}>
            <Text style={styles.geofenceBannerText}>You are near: {currentTask.title}</Text>
          </View>
        ) : null}
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
        <Text style={styles.sectionTitle}>Today&#39;s Tasks</Text>
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

/* eslint-disable react-native/no-color-literals */
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  emptyText: {
    color: '#6b7280',
    padding: 20,
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    padding: 20,
  },
  loadingText: {
    color: '#6b7280',
    marginTop: 16,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    color: '#1e40af',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
  },
  statNumber: {
    color: '#1e40af',
    fontSize: 20,
    fontWeight: 'bold',
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    padding: 16,
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 16,
    marginTop: 4,
  },
  taskCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    padding: 12,
  },
  taskStatus: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
  },
  taskTitle: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    color: '#1e40af',
    fontSize: 24,
    fontWeight: 'bold',
  },
  trackingStatus: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 8,
  },
  geofenceBanner: {
    backgroundColor: '#e0f2fe',
    borderColor: '#7dd3fc',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  geofenceBannerText: {
    color: '#0c4a6e',
    fontSize: 12,
    fontWeight: '600',
  },
});
/* eslint-enable react-native/no-color-literals */

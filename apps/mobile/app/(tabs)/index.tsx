import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
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
      <View className="flex-1 items-center justify-center bg-slate-100">
        <ActivityIndicator color="#1e40af" size="large" />
        <Text className="mt-4 text-gray-500">Loading tasks...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-100">
      <View className="border-b border-gray-200 bg-white p-5">
        <Text className="text-2xl font-bold text-blue-800">Hello, Technician!</Text>
        <Text className="mt-1 text-base text-gray-500">You have {todayTasks.length} new tasks</Text>
        <Text className="mt-2 text-xs text-gray-500">
          Tracking: {isTracking ? 'active' : 'inactive'}
        </Text>
        {isNearTask && currentTask ? (
          <View className="mt-2 rounded-lg border border-sky-300 bg-sky-100 px-2.5 py-2">
            <Text className="text-xs font-semibold text-sky-900">You are near: {currentTask.title}</Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row justify-between gap-2 p-4">
        <View className="flex-1 items-center rounded-lg border border-gray-200 bg-white p-3">
          <Text className="text-xl font-bold text-blue-800">{todayTasks.length}</Text>
          <Text className="mt-1 text-xs text-gray-500">New Tasks</Text>
        </View>
        <View className="flex-1 items-center rounded-lg border border-gray-200 bg-white p-3">
          <Text className="text-xl font-bold text-blue-800">
            {localTasks.filter((t) => t.status === 'completed').length}
          </Text>
          <Text className="mt-1 text-xs text-gray-500">Completed</Text>
        </View>
        <View className="flex-1 items-center rounded-lg border border-gray-200 bg-white p-3">
          <Text className="text-xl font-bold text-blue-800">
            {localTasks.filter((t) => new Date(t.due_date) < new Date() && t.status !== 'completed').length}
          </Text>
          <Text className="mt-1 text-xs text-gray-500">Overdue</Text>
        </View>
      </View>

      <View className="p-4">
        <Text className="mb-3 text-lg font-bold text-blue-800">Today&#39;s Tasks</Text>
        {todayTasks.length === 0 ? (
          <Text className="p-5 text-center text-gray-500">No new tasks for today</Text>
        ) : (
          todayTasks.map((task) => (
            <View className="mb-2 rounded-lg border border-gray-200 bg-white p-3" key={task.id}>
              <Text className="text-sm font-medium text-gray-800">{task.title}</Text>
              <Text className="mt-1 text-xs text-gray-500">{task.status}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}


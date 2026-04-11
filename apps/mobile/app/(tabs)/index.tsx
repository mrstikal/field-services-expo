import {
  View,
  Text,
  ScrollView,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { taskRepository } from '@/lib/db/task-repository';
import { useOfflineSync } from '@/lib/hooks/use-offline-sync';
import { useIsOnline } from '@/lib/hooks/use-network-status';
import { useLocationTracking } from '@/lib/hooks/use-location-tracking';
import { useGeofencing } from '@/lib/hooks/use-geofencing';
import { useAuth } from '@/lib/auth-context';
import type { Task as SharedTask } from '@field-service/shared-types';

type HomeTask = Pick<
  SharedTask,
  | 'id'
  | 'title'
  | 'address'
  | 'latitude'
  | 'longitude'
  | 'status'
  | 'priority'
  | 'due_date'
>;

function filterTodayAssignedTasks(tasks: HomeTask[]) {
  const today = new Date().toISOString().split('T')[0];
  return tasks.filter(
    task => task.status === 'assigned' && task.due_date.startsWith(today)
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [todayTasks, setTodayTasks] = useState<HomeTask[]>([]);
  const [localTasks, setLocalTasks] = useState<HomeTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isOnline = useIsOnline();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { sync, isSyncing } = useOfflineSync();
  const {
    location,
    isTracking,
    requestPermissions,
    startTracking,
    stopTracking,
  } = useLocationTracking();
  const { currentTask, isNearTask, updateLocation, setTrackedTasks } =
    useGeofencing();

  const loadTasksForCurrentUser = useCallback(async () => {
    if (!user) {
      return [];
    }

    if (user?.role === 'technician' && user.id) {
      return taskRepository.getByTechnician(user.id);
    }

    return taskRepository.getAll();
  }, [user?.id, user?.role]);

  const getTodayTaskKey = useCallback((item: HomeTask) => item.id, []);

  const renderTodayTask = useCallback(
    ({ item }: { readonly item: HomeTask }) => (
      <TouchableOpacity
        className="mb-2 rounded-lg border border-gray-200 bg-white p-3"
        onPress={() => router.push(`/tasks/${item.id}`)}
        accessibilityLabel={`Task: ${item.title}, Status: ${item.status}`}
        accessibilityRole="button"
      >
        <Text className="text-sm font-medium text-gray-800">{item.title}</Text>
        <Text className="mt-1 text-xs text-gray-500">{item.status}</Text>
      </TouchableOpacity>
    ),
    [router]
  );

  // Fetch from local database first (offline-first)
  useEffect(() => {
    const fetchLocalTasks = async () => {
      if (isAuthLoading) {
        return;
      }

      try {
        const tasks = await loadTasksForCurrentUser();
        setLocalTasks(tasks);
        setTodayTasks(filterTodayAssignedTasks(tasks));
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching local tasks:', error);
        setIsLoading(false);
      }
    };

    fetchLocalTasks();
  }, [isAuthLoading, loadTasksForCurrentUser]);

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
    const geofenceTasks = todayTasks.map(task => ({
      id: task.id,
      title: task.title,
      latitude: task.latitude ?? 0,
      longitude: task.longitude ?? 0,
      address: task.address ?? 'Unknown address',
    }));

    setTrackedTasks(geofenceTasks);
  }, [todayTasks, setTrackedTasks]);

  // Fallback sync if local data is empty and online
  useEffect(() => {
    if (isOnline && localTasks.length === 0 && !isLoading && !isAuthLoading) {
      const syncAndReloadLocalTasks = async () => {
        try {
          await sync();
          const tasks = await loadTasksForCurrentUser();
          setLocalTasks(tasks);
          setTodayTasks(filterTodayAssignedTasks(tasks));
        } catch (error) {
          console.error('Error syncing tasks fallback:', error);
        }
      };

      syncAndReloadLocalTasks();
    }
  }, [
    isOnline,
    localTasks.length,
    isLoading,
    isAuthLoading,
    loadTasksForCurrentUser,
    sync,
  ]);

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
      <View
        className="border-b border-gray-200 bg-white p-5"
        style={{ paddingTop: insets.top + 20 }}
      >
        <Text className="text-2xl font-bold text-blue-800">
          Hello, Technician!
        </Text>
        <Text className="mt-1 text-base text-gray-500">
          You have {todayTasks.length} new tasks
        </Text>
        <Text className="mt-2 text-xs text-gray-500">
          Tracking: {isTracking ? 'active' : 'inactive'}
        </Text>
        {isNearTask && currentTask ? (
          <View className="mt-2 rounded-lg border border-sky-300 bg-sky-100 px-2.5 py-2">
            <Text className="text-xs font-semibold text-sky-900">
              You are near: {currentTask.title}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row justify-between gap-2 p-4">
        <TouchableOpacity
          className="flex-1 items-center rounded-lg border border-gray-200 bg-white p-3"
          accessibilityLabel={`New Tasks: ${todayTasks.length}`}
          accessibilityRole="button"
        >
          <Text className="text-xl font-bold text-blue-800">
            {todayTasks.length}
          </Text>
          <Text className="mt-1 text-xs text-gray-500">New Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 items-center rounded-lg border border-gray-200 bg-white p-3"
          accessibilityLabel={`Completed Tasks: ${localTasks.filter(t => t.status === 'completed').length}`}
          accessibilityRole="button"
        >
          <Text className="text-xl font-bold text-blue-800">
            {localTasks.filter(t => t.status === 'completed').length}
          </Text>
          <Text className="mt-1 text-xs text-gray-500">Completed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 items-center rounded-lg border border-gray-200 bg-white p-3"
          accessibilityLabel={`Overdue Tasks: ${localTasks.filter(t => new Date(t.due_date) < new Date() && t.status !== 'completed').length}`}
          accessibilityRole="button"
        >
          <Text className="text-xl font-bold text-blue-800">
            {
              localTasks.filter(
                t =>
                  new Date(t.due_date) < new Date() && t.status !== 'completed'
              ).length
            }
          </Text>
          <Text className="mt-1 text-xs text-gray-500">Overdue</Text>
        </TouchableOpacity>
      </View>

      <View className="p-4">
        <Text
          className="mb-3 text-lg font-bold text-blue-800"
          accessibilityLabel="Today's Tasks"
        >
          Today&#39;s Tasks
        </Text>
        {todayTasks.length === 0 ? (
          <Text
            className="p-5 text-center text-gray-500"
            accessibilityLabel="No new tasks for today"
          >
            No new tasks for today
          </Text>
        ) : (
          <FlatList
            data={todayTasks}
            keyExtractor={getTodayTaskKey}
            renderItem={renderTodayTask}
            scrollEnabled={false}
          />
        )}
      </View>
    </ScrollView>
  );
}

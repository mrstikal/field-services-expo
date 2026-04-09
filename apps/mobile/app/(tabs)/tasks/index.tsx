import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import SwipeableTaskCard from '@/components/swipeable-task-card';
import SkeletonTaskList from '@/components/skeleton-task-list';
import TaskFilters from '@/components/task-filters';
import { useState, useCallback } from 'react';
import { Task } from '@field-service/shared-types';
import { useRealtimeTasks } from '@/lib/hooks/use-realtime-tasks';
import { paddingStyles } from '@/lib/styles';
import { useAuth } from '@/lib/auth-context';
import { taskRepository } from '@/lib/db/task-repository';

export default function TasksListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [isFiltersVisible, setIsFiltersVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    status: null as string | null,
    priority: null as string | null,
    dateRange: null as string | null,
  });

  // Enable real-time updates for tasks
  useRealtimeTasks();

  const {
    data: allTasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }

      const tasks =
        user.role === 'technician'
          ? await taskRepository.getByTechnician(user.id)
          : await taskRepository.getAll();

      return tasks;
    },
    enabled: !!user?.id,
    retry: false,
  });

  // Filter tasks based on selected filters
  const filteredTasks = allTasks.filter((task: Task) => {
    if (filters.status && task.status !== filters.status) return false;
    if (filters.priority && task.priority !== filters.priority) return false;

    // Add date filtering logic if needed
    if (filters.dateRange) {
      const taskDate = new Date(task.created_at);
      const today = new Date();
      const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      switch (filters.dateRange) {
        case 'today':
          return taskDate.toDateString() === today.toDateString();
        case 'this_week':
          return taskDate >= oneWeekAgo;
        case 'this_month':
          return taskDate >= oneMonthAgo;
        default:
          return true;
      }
    }
    return true;
  });

  const queryClient = useQueryClient();

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleResetFilters = () => {
    setFilters({
      status: null,
      priority: null,
      dateRange: null,
    });
  };

  const handleOpenFilters = useCallback(() => {
    setIsFiltersVisible(true);
  }, []);

  const handleFilterChange = useCallback(
    (filterType: string, value: string | null) => {
      setFilters(prev => ({
        ...prev,
        [filterType]: value,
      }));
    },
    []
  );

  const handleApplyFilters = useCallback(() => {
    setIsFiltersVisible(false);
  }, []);

  const handleTaskPress = useCallback(
    (taskId: string) => {
      router.push(`/tasks/${taskId}`);
    },
    [router]
  );

  const renderTaskCard = useCallback(
    ({ item }: { readonly item: Task }) => (
      <SwipeableTaskCard
        item={item}
        taskId={item.id}
        onPress={handleTaskPress}
      />
    ),
    [handleTaskPress]
  );

  const ITEM_HEIGHT = 120; // Estimated height

  const getItemLayout = useCallback(
    (data: ArrayLike<Task> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  return (
    <View className="flex-1 bg-slate-50">
      <View
        className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-4"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Text className="text-xl font-semibold text-gray-800">All Tasks</Text>
        <View className="flex-row items-center gap-3">
          <Text className="text-sm text-gray-500">
            {filteredTasks.length} tasks
          </Text>
          <TouchableOpacity
            className="p-1"
            onPress={handleOpenFilters}
            testID="tasks-filter-button"
          >
            <Ionicons color="#1e40af" name="filter" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <SkeletonTaskList />
      ) : error ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons color="#ef4444" name="alert-circle-outline" size={48} />
          <Text className="mt-3 text-base text-red-500">
            Error loading tasks: {error.message}
          </Text>
        </View>
      ) : filteredTasks.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <View className="mb-4 rounded-full bg-blue-50 p-6">
            <Ionicons color="#3b82f6" name="document-text-outline" size={64} />
          </View>
          <Text className="text-xl font-semibold text-gray-800">
            No tasks found
          </Text>
          <Text className="mt-2 text-center text-base text-gray-500">
            {filters.status || filters.priority || filters.dateRange
              ? 'Try adjusting your filters to see more tasks'
              : 'You have no tasks assigned to you'}
          </Text>
          {(filters.status || filters.priority || filters.dateRange) && (
            <TouchableOpacity
              className="mt-6 rounded-lg bg-blue-800 px-6 py-3"
              onPress={handleResetFilters}
            >
              <Text className="text-sm font-semibold text-white">
                Reset Filters
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          contentContainerStyle={paddingStyles.contentContainer}
          data={filteredTasks}
          getItemLayout={getItemLayout}
          keyExtractor={item => item.id}
          maxToRenderPerBatch={10}
          refreshControl={
            <RefreshControl onRefresh={onRefresh} refreshing={isRefreshing} />
          }
          renderItem={renderTaskCard}
          scrollEnabled
          updateCellsBatchingPeriod={50}
          windowSize={10}
        />
      )}

      <TaskFilters
        isVisible={isFiltersVisible}
        filters={filters}
        onFilterChange={handleFilterChange}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
      />
    </View>
  );
}

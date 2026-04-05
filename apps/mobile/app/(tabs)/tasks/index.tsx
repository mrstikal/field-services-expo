import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import SwipeableTaskCard from '@/components/swipeable-task-card';
import TaskFilters from '@/components/task-filters';
import SkeletonTaskList from '@/components/skeleton-task-list';
import { useRef, useState, useCallback } from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Task } from '@field-service/shared-types';
import { useRealtimeTasks } from '@/lib/hooks/use-realtime-tasks';

export default function TasksListScreen() {
  const router = useRouter();
  const [filters, setFilters] = useState({
    status: null as string | null,
    priority: null as string | null,
    dateRange: null as string | null,
  });
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  // Enable real-time updates for tasks
  useRealtimeTasks();

  const { data: allTasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
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
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const handleFilterChange = (filterType: string, value: string | null) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleApplyFilters = () => {
    bottomSheetRef.current?.dismiss();
  };

  const handleResetFilters = () => {
    setFilters({
      status: null,
      priority: null,
      dateRange: null,
    });
    bottomSheetRef.current?.dismiss();
  };

  const handleTaskPress = useCallback((taskId: string) => {
    router.push(`/tasks/${taskId}`);
  }, [router]);

  const renderTaskCard = useCallback(({ item }: { item: Task }) => (
    <SwipeableTaskCard 
      item={item} 
      onPress={() => handleTaskPress(item.id)} 
    />
  ), [handleTaskPress]);

  const ITEM_HEIGHT = 120; // Estimated height

  const getItemLayout = useCallback((data: ArrayLike<Task> | null | undefined, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Tasks</Text>
        <View style={styles.headerActions}>
          <Text style={styles.headerSubtitle}>{filteredTasks.length} tasks</Text>
          <TouchableOpacity 
            onPress={() => bottomSheetRef.current?.present()} 
            style={styles.filterButton}
          >
            <Ionicons name="filter" size={20} color="#1e40af" />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <SkeletonTaskList />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>Error loading tasks: {error.message}</Text>
        </View>
      ) : filteredTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>No tasks match the filters</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          renderItem={renderTaskCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          scrollEnabled={true}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={onRefresh} />
          }
          getItemLayout={getItemLayout}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={10}
        />
      )}

      <TaskFilters
        bottomSheetRef={bottomSheetRef}
        filters={filters}
        onFilterChange={handleFilterChange}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
      />
    </View>
  );
}

/* eslint-disable react-native/no-color-literals */
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f9fafb',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 12,
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
  filterButton: {
    padding: 4,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  headerSubtitle: {
    color: '#6b7280',
    fontSize: 14,
  },
  headerTitle: {
    color: '#1f2937',
    fontSize: 20,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
});

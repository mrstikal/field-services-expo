 
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRealtimeTask } from '@/lib/hooks/use-realtime-tasks';
import TaskDetailTransition from '@/components/task-detail-transition';

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


const getPriorityBadgeClass = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-600';
    case 'high':
      return 'bg-orange-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'low':
      return 'bg-green-500';
    default:
      return 'bg-gray-500';
  }
};

const getPriorityTextClass = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'text-red-600';
    case 'high':
      return 'text-orange-500';
    case 'medium':
      return 'text-yellow-500';
    case 'low':
      return 'text-green-500';
    default:
      return 'text-gray-500';
  }
};

const getStatusDotClass = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-500';
    case 'in_progress':
      return 'bg-orange-500';
    default:
      return 'bg-blue-500';
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
  const insets = useSafeAreaInsets();
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
      router.push('/(tabs)/tasks');
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
      <View className="flex-1 bg-slate-50">
        <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3" style={{ paddingTop: insets.top + 12 }}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/tasks')}>
            <Ionicons color="#1e40af" name="chevron-back" size={24} />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800">Task Detail</Text>
          <View className="w-6" />
        </View>
        <View className="flex-1 items-center justify-center">
          <Text>Loading...</Text>
        </View>
      </View>
    );
  }

  if (error || !task) {
    return (
      <View className="flex-1 bg-slate-50">
        <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3" style={{ paddingTop: insets.top + 12 }}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/tasks')}>
            <Ionicons color="#1e40af" name="chevron-back" size={24} />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800">Task Detail</Text>
          <View className="w-6" />
        </View>
        <View className="flex-1 items-center justify-center">
          <Ionicons color="#ef4444" name="alert-circle-outline" size={48} />
          <Text className="mt-3 text-base text-red-500">Failed to load task</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3" style={{ paddingTop: insets.top + 12 }}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/tasks')}>
          <Ionicons color="#1e40af" name="chevron-back" size={24} />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800">Task Detail</Text>
        <View className="w-6" />
      </View>

      <TaskDetailTransition isActive>
        <ScrollView
          className="flex-1 px-4"
          refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} />}
          showsVerticalScrollIndicator={false}
        >
        {/* Title and Status */}
        <View className="mb-5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="mb-1 text-2xl font-bold text-gray-800">{task.title}</Text>
              <Text className="text-sm font-medium text-gray-500">{getCategoryLabel(task.category)}</Text>
            </View>
            <View
              className={`ml-3 rounded-md px-3 py-1.5 ${getPriorityBadgeClass(task.priority)}`}
            >
              <Text className="text-xs font-semibold capitalize text-white">{task.priority}</Text>
            </View>
          </View>
        </View>

        {/* Status */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between">
            <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">Status:</Text>
            <View className="flex-row items-center">
              <View className={`mr-2 h-2 w-2 rounded ${getStatusDotClass(task.status)}`} />
              <Text className="text-sm font-semibold text-gray-800">{getStatusLabel(task.status)}</Text>
            </View>
          </View>
        </View>

        {/* Description */}
        <View className="mb-5">
          <Text className="mb-3 text-base font-semibold text-gray-800">Work Description</Text>
          <Text className="text-sm leading-5 text-gray-600">{task.description}</Text>
        </View>

        {/* Customer Info */}
        <View className="mb-5">
          <Text className="mb-3 text-base font-semibold text-gray-800">Customer Contact</Text>
          <View className="rounded-lg border border-gray-200 bg-white p-3">
            <View className="mb-3 flex-row items-center">
              <Ionicons color="#6b7280" name="person-outline" size={16} />
              <Text className="ml-3 flex-1 text-sm text-gray-800">{task.customer_name}</Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons color="#6b7280" name="call-outline" size={16} />
              <Text className="ml-3 flex-1 text-sm text-gray-800">{task.customer_phone}</Text>
            </View>
          </View>
        </View>

        {/* Location */}
        <View className="mb-5">
          <Text className="mb-3 text-base font-semibold text-gray-800">Work Location</Text>
          <View className="rounded-lg border border-gray-200 bg-white p-3">
            <View className="mb-3 flex-row items-center">
              <Ionicons color="#6b7280" name="location-outline" size={16} />
              <Text className="ml-3 flex-1 text-sm text-gray-800">{task.address}</Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons color="#6b7280" name="navigate-outline" size={16} />
              <Text className="ml-3 flex-1 text-sm text-gray-800">
                {task.latitude.toFixed(4)}, {task.longitude.toFixed(4)}
              </Text>
            </View>
          </View>
        </View>

        {/* Time and Priority */}
        <View className="mb-5">
          <View className="flex-row justify-between">
            <View className="flex-1">
              <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">Estimated Time:</Text>
              <Text className="text-base font-semibold text-gray-800">{task.estimated_time} minutes</Text>
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">Priority:</Text>
              <Text className={`text-base font-semibold ${getPriorityTextClass(task.priority)}`}>
                {task.priority.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Due Date */}
        <View className="mb-5">
          <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">Due Date:</Text>
          <Text className="text-base font-semibold text-gray-800">
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
        <View className="mb-5 pb-6">
          <TouchableOpacity className="mb-3 flex-row items-center justify-center rounded-lg bg-blue-800 px-4 py-3" onPress={handleNavigate}>
            <Ionicons color="#ffffff" name="navigate" size={20} />
            <Text className="ml-2 text-sm font-semibold text-white">Navigate</Text>
          </TouchableOpacity>

          <TouchableOpacity className="mb-3 flex-row items-center justify-center rounded-lg bg-emerald-600 px-4 py-3" onPress={handleCall}>
            <Ionicons color="#ffffff" name="call" size={20} />
            <Text className="ml-2 text-sm font-semibold text-white">Call</Text>
          </TouchableOpacity>

           {task.status === 'assigned' && (
             <TouchableOpacity
               className="mb-3 flex-row items-center justify-center rounded-lg bg-orange-500 px-4 py-3"
               onPress={handleStartWork}
             >
               <Ionicons color="#ffffff" name="play" size={20} />
               <Text className="ml-2 text-sm font-semibold text-white">Start Work</Text>
             </TouchableOpacity>
           )}
        </View>
        </ScrollView>
      </TaskDetailTransition>
    </View>
  );
}


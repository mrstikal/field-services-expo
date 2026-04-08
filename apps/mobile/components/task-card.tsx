import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Task } from '@field-service/shared-types';

interface TaskCardProps {
  readonly item: Task;
  readonly onPress: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ item, onPress }) => {
  // Accessibility label for screen readers
  const accessibilityLabel = `Task: ${item.title}, Priority: ${item.priority}, Status: ${item.status}`;
  const accessibilityRole = 'button';

  const getPriorityClassName = (priority: string) => {
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

  return (
    <TouchableOpacity
      className="mb-3 rounded-lg border-l-4 border-l-blue-800 bg-white p-3"
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
    >
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-800">
            {item.title}
          </Text>
          <View className="mt-1.5 flex-row items-center">
            <Ionicons color="#6b7280" name="location-outline" size={12} />
            <Text className="ml-1 flex-1 text-xs text-gray-500">
              {item.address}
            </Text>
          </View>
        </View>
        <View
          className={`ml-2 rounded px-2 py-1 ${getPriorityClassName(item.priority)}`}
        >
          <Text className="text-[10px] font-semibold capitalize text-white">
            {item.priority}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center justify-between">
        <View className="rounded bg-gray-100 px-2 py-1">
          <Text className="text-[11px] font-medium text-gray-500">
            {getStatusLabel(item.status)}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons color="#6b7280" name="time-outline" size={12} />
          <Text className="ml-1 text-[11px] text-gray-500">
            {item.estimated_time} min
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const MemoizedTaskCard = memo(TaskCard);
export default MemoizedTaskCard;

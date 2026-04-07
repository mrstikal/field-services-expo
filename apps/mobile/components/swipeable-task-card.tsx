import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Task } from '@field-service/shared-types';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

interface SwipeableTaskCardProps {
  readonly item: Task;
  readonly taskId: string;
  readonly onPress: (taskId: string) => void;
}

const SWIPE_LIMIT = 110;
const SWIPE_THRESHOLD = 70;

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

const SwipeableTaskCard: React.FC<SwipeableTaskCardProps> = ({ item, taskId, onPress }) => {
  // Accessibility label for screen readers
  const accessibilityLabel = `Task: ${item.title}, Priority: ${item.priority}, Status: ${item.status}`;
  const accessibilityRole = 'button';
  const translateX = React.useRef(new Animated.Value(0)).current;
  const queryClient = useQueryClient();

  const resetCard = React.useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 6,
      speed: 16,
    }).start();
  }, [translateX]);

  const completeTask = React.useCallback(async () => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) {
        console.error('Error completing task:', error.message);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error completing task:', err);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [taskId, queryClient]);

  const dismissTask = React.useCallback(async () => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'assigned', updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) {
        console.error('Error dismissing task:', error.message);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error dismissing task:', err);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [taskId, queryClient]);

  const runSwipeAction = React.useCallback(
    (toValue: number, action: () => Promise<void>) => {
      Animated.timing(translateX, {
        toValue,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        void action().finally(() => {
          resetCard();
        });
      });
    },
    [resetCard, translateX]
  );

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          const clamped = Math.max(-SWIPE_LIMIT, Math.min(SWIPE_LIMIT, gestureState.dx));
          translateX.setValue(clamped);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx >= SWIPE_THRESHOLD) {
            runSwipeAction(SWIPE_LIMIT, completeTask);
            return;
          }

          if (gestureState.dx <= -SWIPE_THRESHOLD) {
            runSwipeAction(-SWIPE_LIMIT, dismissTask);
            return;
          }

          resetCard();
        },
        onPanResponderTerminate: resetCard,
      }),
    [completeTask, dismissTask, resetCard, runSwipeAction, translateX]
  );

  return (
    <View className="mb-3 overflow-hidden rounded-lg">
      <View className="absolute bottom-0 left-0 right-0 top-0 flex-row">
        <View className="flex-1 items-start justify-center bg-green-500 px-4">
          <View className="items-center">
            <Ionicons color="#ffffff" name="checkmark" size={22} />
            <Text className="mt-1 text-xs font-bold text-white">Complete</Text>
          </View>
        </View>
        <View className="flex-1 items-end justify-center bg-red-500 px-4">
          <View className="items-center">
            <Ionicons color="#ffffff" name="close" size={22} />
            <Text className="mt-1 text-xs font-bold text-white">Dismiss</Text>
          </View>
        </View>
      </View>

        <Animated.View
          className="rounded-lg border-l-4 border-l-blue-600 bg-white"
          style={{ transform: [{ translateX }] }}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity
            className="p-3"
            onPress={() => onPress(taskId)}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole={accessibilityRole}
          >
          <View className="mb-2 flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-800">{item.title}</Text>
              <View className="mt-1.5 flex-row items-center">
                <Ionicons color="#6b7280" name="location-outline" size={12} />
                <Text className="ml-1 flex-1 text-xs text-gray-500">{item.address}</Text>
              </View>
            </View>
            <View className={`ml-2 rounded px-2 py-1 ${getPriorityClassName(item.priority)}`}>
              <Text className="text-[10px] font-semibold capitalize text-white">{item.priority}</Text>
            </View>
          </View>
          <View className="flex-row items-center justify-between">
            <View className="rounded bg-gray-100 px-2 py-1">
              <Text className="text-[11px] font-medium text-gray-500">{getStatusLabel(item.status)}</Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons color="#6b7280" name="time-outline" size={12} />
              <Text className="ml-1 text-[11px] text-gray-500">{item.estimated_time} min</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default SwipeableTaskCard;


import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Task } from '@field-service/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { taskRepository } from '@/lib/db/task-repository';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { getTaskSharedTransitionTag } from '@/lib/task-shared-transition';

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

const SwipeableTaskCard: React.FC<SwipeableTaskCardProps> = ({
  item,
  taskId,
  onPress,
}) => {
  // Accessibility label for screen readers
  const accessibilityLabel = `Task: ${item.title}, Priority: ${item.priority}, Status: ${item.status}`;
  const accessibilityRole = 'button';
  const translateX = useSharedValue(0);
  const queryClient = useQueryClient();

  const resetCard = React.useCallback(() => {
    translateX.value = withTiming(0, { duration: 180 });
  }, [translateX]);

  const animateSwipeFeedback = React.useCallback(
    (toValue: number) => {
      translateX.value = withTiming(toValue, { duration: 120 }, finished => {
        if (finished) {
          translateX.value = withTiming(0, { duration: 180 });
        }
      });
    },
    [translateX]
  );

  const setTaskCache = React.useCallback(
    (updatedTask: Task) => {
      queryClient.setQueriesData<Task[] | undefined>(
        { queryKey: ['tasks'] },
        tasks =>
          tasks?.map(task => (task.id === updatedTask.id ? updatedTask : task))
      );
      queryClient.setQueryData<Task | undefined>(
        ['task', taskId],
        currentTask => (currentTask ? updatedTask : currentTask)
      );
    },
    [queryClient, taskId]
  );

  const applyOptimisticStatus = React.useCallback(
    (nextStatus: Task['status']) => {
      const optimisticUpdatedAt = new Date().toISOString();
      const previousTaskLists = queryClient.getQueriesData<Task[] | undefined>({
        queryKey: ['tasks'],
      });
      const previousTaskDetail = queryClient.getQueryData<Task | undefined>([
        'task',
        taskId,
      ]);

      queryClient.setQueriesData<Task[] | undefined>(
        { queryKey: ['tasks'] },
        tasks =>
          tasks?.map(task =>
            task.id === taskId
              ? {
                  ...task,
                  status: nextStatus,
                  synced: 0,
                  updated_at: optimisticUpdatedAt,
                  version: task.version + 1,
                }
              : task
          )
      );
      queryClient.setQueryData<Task | undefined>(['task', taskId], currentTask =>
        currentTask
          ? {
              ...currentTask,
              status: nextStatus,
              synced: 0,
              updated_at: optimisticUpdatedAt,
              version: currentTask.version + 1,
            }
          : currentTask
      );

      return () => {
        previousTaskLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
        queryClient.setQueryData(['task', taskId], previousTaskDetail);
      };
    },
    [queryClient, taskId]
  );

  const handleStatusChange = React.useCallback(
    async (nextStatus: Task['status']) => {
      const rollback = applyOptimisticStatus(nextStatus);

      try {
        const updated = await taskRepository.updateStatus(taskId, nextStatus);
        if (!updated) {
          throw new Error('Task not found');
        }

        setTaskCache(updated);
        await queryClient.invalidateQueries({ queryKey: ['tasks'] });
        await queryClient.invalidateQueries({ queryKey: ['task', taskId] });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        rollback();
        console.error(`Error updating task status to ${nextStatus}:`, err);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [applyOptimisticStatus, queryClient, setTaskCache, taskId]
  );

  const completeTask = React.useCallback(() => {
    animateSwipeFeedback(SWIPE_LIMIT);
    void handleStatusChange('completed');
  }, [animateSwipeFeedback, handleStatusChange]);

  const dismissTask = React.useCallback(() => {
    animateSwipeFeedback(-SWIPE_LIMIT);
    void handleStatusChange('assigned');
  }, [animateSwipeFeedback, handleStatusChange]);

  const panGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .onUpdate(event => {
          const clamped = Math.max(
            -SWIPE_LIMIT,
            Math.min(SWIPE_LIMIT, event.translationX)
          );
          translateX.value = clamped;
        })
        .onEnd(event => {
          if (event.translationX >= SWIPE_THRESHOLD) {
            scheduleOnRN(completeTask);
            return;
          }

          if (event.translationX <= -SWIPE_THRESHOLD) {
            scheduleOnRN(dismissTask);
            return;
          }

          scheduleOnRN(resetCard);
        }),
    [completeTask, dismissTask, resetCard, translateX]
  );

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const sharedTransitionTag = getTaskSharedTransitionTag(taskId);

  return (
    <View className="mb-3 overflow-hidden rounded-lg">
      <View className="absolute bottom-0 left-0 right-0 top-0 flex-row">
        <TouchableOpacity
          className="flex-1 items-start justify-center bg-green-500 px-4"
          onPress={completeTask}
        >
          <View className="items-center">
            <Ionicons color="#ffffff" name="checkmark" size={22} />
            <Text className="mt-1 text-xs font-bold text-white">Complete</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 items-end justify-center bg-red-500 px-4"
          onPress={dismissTask}
        >
          <View className="items-center">
            <Ionicons color="#ffffff" name="close" size={22} />
            <Text className="mt-1 text-xs font-bold text-white">Incomplete</Text>
          </View>
        </TouchableOpacity>
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          className="rounded-lg border-l-4 border-l-blue-600 bg-white"
          // @ts-expect-error Reanimated supports sharedTransitionTag at runtime,
          // but the published types in this version do not expose the prop.
          sharedTransitionTag={sharedTransitionTag}
          style={animatedCardStyle}
        >
          <TouchableOpacity
            className="p-3"
            onPress={() => onPress(taskId)}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole={accessibilityRole}
            testID="task-card"
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
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export default SwipeableTaskCard;

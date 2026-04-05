import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity,
  Platform,
  UIManager
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
   
  runOnJS 
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Task } from '@field-service/shared-types';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

// Enable layout animation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

interface SwipeableTaskCardProps {
  readonly item: Task;
  readonly onPress?: () => void;
}


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

const SwipeableTaskCard: React.FC<SwipeableTaskCardProps> = ({ item, onPress }) => {
  const translateX = useSharedValue(0);
  const queryClient = useQueryClient();

  const completeTask = async () => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', item.id);
      
      if (error) {
        console.error('Error completing task:', error.message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      
  // Invalidate cache
  await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  await queryClient.invalidateQueries({ queryKey: ['task', item.id] });
  
  // Haptic feedback
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error completing task:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const dismissTask = async () => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'assigned', updated_at: new Date().toISOString() })
        .eq('id', item.id);
      
      if (error) {
        console.error('Error dismissing task:', error.message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      
  await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  await queryClient.invalidateQueries({ queryKey: ['task', item.id] });
  
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error dismissing task:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      translateX.value = withSpring(0);
    })
    .onUpdate((event) => {
      if (event.translationX > 0) {
        // Dismiss to left
        translateX.value = withSpring(Math.min(event.translationX / 2, 0));
      } else {
        // Complete to right
        translateX.value = withSpring(Math.max(event.translationX / 2, 0));
      }
    })
    .onEnd((event) => {
      if (event.translationX > 50) {
        // Dismiss to left
        translateX.value = withSpring(-100, {}, (finished) => {
          if (finished) {
            runOnJS(dismissTask)();
          }
        });
      } else if (event.translationX < -50) {
        // Complete to right
        translateX.value = withSpring(100, {}, (finished) => {
          if (finished) {
            runOnJS(completeTask)();
          }
        });
      } else {
        // Return to original position
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

   return (
     <GestureDetector gesture={panGesture}>
       <Animated.View
         className="bg-white border-l-4 border-l-blue-600 rounded-lg flex-row mb-3 overflow-hidden"
         style={animatedStyle}
       >
        {/* Main task card */}
        <TouchableOpacity
          className="flex-1 p-3"
          onPress={onPress}
        >
          <View className="mb-2 flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-800">{item.title}</Text>
              <View className="mt-1.5 flex-row items-center">
                <Ionicons color="#6b7280" name="location-outline" size={12} />
                <Text className="ml-1 flex-1 text-xs text-gray-500">{item.address}</Text>
              </View>
            </View>
            <View
              className={`ml-2 rounded px-2 py-1 ${getPriorityClassName(item.priority)}`}
            >
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

        {/* Right action (Complete) */}
        <View className="ml-auto w-20 items-center justify-center bg-green-500 p-3">
          <Ionicons color="#ffffff" name="checkmark" size={24} />
          <Text className="mt-1 text-xs font-bold text-white">Complete</Text>
        </View>

        {/* Left action (Dismiss) */}
        <View className="w-20 items-center justify-center bg-red-500 p-3">
          <Ionicons color="#ffffff" name="close" size={24} />
          <Text className="mt-1 text-xs font-bold text-white">Dismiss</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};


export default SwipeableTaskCard;
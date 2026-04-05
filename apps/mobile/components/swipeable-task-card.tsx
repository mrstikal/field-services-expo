import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
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
  item: Task;
  onPress?: () => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return '#dc2626';
    case 'high':
      return '#f97316';
    case 'medium':
      return '#eab308';
    case 'low':
      return '#22c55e';
    default:
      return '#6b7280';
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
      
      // Invalidate cache
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['task', item.id] });
      
      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (err) {
      console.error('Error dismissing task:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const panGesture = Gesture.Pan()
    .onChange((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      const shouldComplete = event.translationX > 100;
      const shouldDismiss = event.translationX < -100;

      if (shouldComplete) {
        // Complete task
        translateX.value = withSpring(300, {}, (finished) => {
          if (finished) {
            runOnJS(completeTask)();
          }
        });
      } else if (shouldDismiss) {
        // Dismiss task
        translateX.value = withSpring(-300, {}, (finished) => {
          if (finished) {
            runOnJS(dismissTask)();
          }
        });
      } else {
        // Return to original position
        translateX.value = withSpring(0);
      }
    })

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.taskCard, animatedStyle]}>
        {/* Main task card */}
        <TouchableOpacity
          style={styles.taskCardContent}
          onPress={onPress}
        >
          <View style={styles.taskHeader}>
            {/* eslint-disable-next-line react-native/no-inline-styles */}
            <View style={{ flex: 1 }}>
              <Text style={styles.taskTitle}>{item.title}</Text>
              <View style={styles.taskMeta}>
                <Ionicons name="location-outline" size={12} color="#6b7280" />
                <Text style={styles.taskAddress}>{item.address}</Text>
              </View>
            </View>
            <View
              style={[
                styles.priorityBadge,
                { backgroundColor: getPriorityColor(item.priority) },
              ]}
            >
              <Text style={styles.priorityText}>{item.priority}</Text>
            </View>
          </View>
          <View style={styles.taskFooter}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
            </View>
            <View style={styles.timeEstimate}>
              <Ionicons name="time-outline" size={12} color="#6b7280" />
              <Text style={styles.timeText}>{item.estimated_time} min</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Right action (Complete) */}
        <View style={[styles.actionButton, styles.completeAction]}>
          <Ionicons name="checkmark" size={24} color="#ffffff" />
          <Text style={styles.actionText}>Complete</Text>
        </View>

        {/* Left action (Dismiss) */}
        <View style={[styles.actionButton, styles.dismissAction]}>
          <Ionicons name="close" size={24} color="#ffffff" />
          <Text style={styles.actionText}>Dismiss</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

/* eslint-disable react-native/no-color-literals */
const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    width: 80,
    zIndex: 1,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
  completeAction: {
    backgroundColor: '#22c55e',
    marginLeft: 'auto',
  },
  dismissAction: {
    backgroundColor: '#ef4444',
  },
  priorityBadge: {
    borderRadius: 4,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priorityText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '500',
  },
  taskAddress: {
    color: '#6b7280',
    flex: 1,
    fontSize: 12,
    marginLeft: 4,
  },
  taskCard: {
    backgroundColor: '#ffffff',
    borderLeftColor: '#1e40af',
    borderLeftWidth: 4,
    borderRadius: 8,
    flexDirection: 'row',
    marginBottom: 12,
    overflow: 'hidden',
  },
  taskCardContent: {
    flex: 1,
    padding: 12,
    zIndex: 2,
  },
  taskFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taskHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  taskMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 6,
  },
  taskTitle: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
  timeEstimate: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  timeText: {
    color: '#6b7280',
    fontSize: 11,
    marginLeft: 4,
  },
});

export default SwipeableTaskCard;
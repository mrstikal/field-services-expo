import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming
} from 'react-native-reanimated';
import { colors } from '@/lib/colors';

interface TaskDetailTransitionProps {
  children: React.ReactNode;
  isActive: boolean;
  onComplete?: () => void;
}

const TaskDetailTransition: React.FC<TaskDetailTransitionProps> = ({
  children,
  isActive,
  onComplete
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const borderRadius = useSharedValue(8);

  useEffect(() => {
    if (isActive) {
      // Animate when transition is activated
      scale.value = withTiming(0.95, { duration: 300 });
      opacity.value = withTiming(0.8, { duration: 300 });
      borderRadius.value = withTiming(16, { duration: 300 });
    } else {
      // Animate back when transition is deactivated
      scale.value = withTiming(1, { duration: 300 }, (finished) => {
        if (finished && onComplete) {
          onComplete();
        }
      });
      opacity.value = withTiming(1, { duration: 300 });
      borderRadius.value = withTiming(8, { duration: 300 });
    }
  }, [isActive, scale, opacity, borderRadius, onComplete]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
      borderRadius: borderRadius.value,
    };
  });

  return (
    <Animated.View 
      style={[
        styles.container, 
        animatedStyle
      ]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.gray50,
    flex: 1,
    margin: 8,
    overflow: 'hidden',
  },
});

export default TaskDetailTransition;
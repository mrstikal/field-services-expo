import React from 'react';
import { Animated } from 'react-native';

interface TaskDetailTransitionProps {
  readonly children: React.ReactNode;
  readonly isActive: boolean;
  readonly onComplete?: () => void;
}

const TaskDetailTransition: React.FC<TaskDetailTransitionProps> = ({
  children,
  isActive,
  onComplete,
}) => {
  const opacity = React.useRef(new Animated.Value(isActive ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: isActive ? 1 : 0,
      duration: isActive ? 220 : 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && isActive && onComplete) {
        onComplete();
      }
    });
  }, [isActive, onComplete, opacity]);

  return (
    <Animated.View
      className="m-2 flex-1 overflow-hidden bg-gray-50"
      style={{ opacity }}
    >
      {children}
    </Animated.View>
  );
};

export default TaskDetailTransition;

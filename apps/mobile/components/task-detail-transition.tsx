import React from 'react';
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

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
  React.useEffect(() => {
    if (isActive && onComplete) {
      onComplete();
    }
  }, [isActive, onComplete]);

  const entering = isActive ? FadeIn.duration(180) : undefined;
  const exiting = FadeOut.duration(120);

  return (
    <Animated.View
      className="m-2 flex-1 overflow-hidden bg-gray-50"
      entering={entering}
      exiting={exiting}
    >
      {children}
    </Animated.View>
  );
};

export default TaskDetailTransition;

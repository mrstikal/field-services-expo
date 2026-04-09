import React from 'react';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
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
  const entering = React.useMemo(() => {
    if (!isActive) {
      return undefined;
    }

    const animation = FadeIn.duration(180);
    if (!onComplete) {
      return animation;
    }

    return animation.withCallback(finished => {
      'worklet';
      if (finished) {
        runOnJS(onComplete)();
      }
    });
  }, [isActive, onComplete]);
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

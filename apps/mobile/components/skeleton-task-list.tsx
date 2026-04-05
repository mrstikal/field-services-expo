import React from 'react';
import { View, Animated } from 'react-native';

const SkeletonTaskCard: React.FC = () => {
  // Animation for shimmer effect
  const opacity = new Animated.Value(0.4);

  Animated.loop(
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.4,
        duration: 600,
        useNativeDriver: true,
      }),
    ])
  ).start();

  return (
    <View className="mb-3 rounded-lg border-l-4 border-l-gray-200 bg-white p-3">
      <View className="mb-2 flex-row items-start justify-between">
        <View className="h-4 w-[70%] rounded bg-gray-200" />
        <View className="h-5 w-[60px] rounded bg-gray-200" />
      </View>
      <View className="flex-row items-center justify-between">
        <View className="h-4 w-[60px] rounded bg-gray-200" />
        <View className="h-4 w-[60px] rounded bg-gray-200" />
      </View>
    </View>
  );
};

const SkeletonTaskList: React.FC = () => {
  return (
    <View className="flex-1 p-4">
      {[...Array(5)].map((_, index) => (
        <SkeletonTaskCard key={index} />
      ))}
    </View>
  );
};


export default SkeletonTaskList;
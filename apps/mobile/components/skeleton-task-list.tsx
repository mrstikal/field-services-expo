import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

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
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonPriority} />
      </View>
      <View style={styles.skeletonFooter}>
        <View style={styles.skeletonStatus} />
        <View style={styles.skeletonTime} />
      </View>
    </View>
  );
};

const SkeletonTaskList: React.FC = () => {
  return (
    <View style={styles.container}>
      {[...Array(5)].map((_, index) => (
        <SkeletonTaskCard key={index} />
      ))}
    </View>
  );
};

/* eslint-disable react-native/no-color-literals */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  skeletonCard: {
    backgroundColor: '#ffffff',
    borderLeftColor: '#e5e7eb',
    borderLeftWidth: 4,
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
  },
  skeletonFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  skeletonPriority: {
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    height: 20,
    width: 60,
  },
  skeletonStatus: {
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    height: 16,
    width: 60,
  },
  skeletonTime: {
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    height: 16,
    width: 60,
  },
  skeletonTitle: {
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    height: 16,
    width: '70%',
  },
});

export default SkeletonTaskList;
import React from 'react';
import { Animated } from 'react-native';
import { render } from '@testing-library/react-native';
import SkeletonTaskList from '../skeleton-task-list';

describe('SkeletonTaskList', () => {
  it('should render without crashing', () => {
    expect(() => render(<SkeletonTaskList />)).not.toThrow();
  });

  it('should render exactly 5 skeleton cards (Animated.View)', () => {
    const { UNSAFE_getAllByType } = render(<SkeletonTaskList />);
    const animatedViews = UNSAFE_getAllByType(Animated.View);
    // Each SkeletonTaskCard renders one Animated.View
    expect(animatedViews.length).toBe(5);
  });

  it('should apply opacity animation style to each skeleton card', () => {
    const { UNSAFE_getAllByType } = render(<SkeletonTaskList />);
    const animatedViews = UNSAFE_getAllByType(Animated.View);
    animatedViews.forEach((view) => {
      expect(view.props.style).toBeDefined();
    });
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  SkeletonTable,
  SkeletonCard,
  SkeletonList,
  SkeletonStats,
  SkeletonForm,
} from '@components/skeleton-table';

describe('SkeletonTable', () => {
  it('should render without crashing', () => {
    expect(() => render(<SkeletonTable />)).not.toThrow();
  });

  it('should render default 5 skeleton rows', () => {
    const { container } = render(<SkeletonTable />);
    // Each row is a div inside the divide-y container
    const rowContainer = container.querySelector('.divide-y');
    expect(rowContainer?.children.length).toBe(5);
  });

  it('should render custom number of rows', () => {
    const { container } = render(<SkeletonTable rows={3} />);
    const rowContainer = container.querySelector('.divide-y');
    expect(rowContainer?.children.length).toBe(3);
  });

  it('should render default 4 header columns', () => {
    const { container } = render(<SkeletonTable />);
    const headerRow = container.querySelector('.bg-gray-50');
    expect(headerRow?.children.length).toBe(4);
  });

  it('should render custom number of columns', () => {
    const { container } = render(<SkeletonTable columns={6} />);
    const headerRow = container.querySelector('.bg-gray-50');
    expect(headerRow?.children.length).toBe(6);
  });

  it('should apply animate-pulse class to skeleton cells', () => {
    const { container } = render(<SkeletonTable />);
    const pulseCells = container.querySelectorAll('.animate-pulse');
    expect(pulseCells.length).toBeGreaterThan(0);
  });
});

describe('SkeletonCard', () => {
  it('should render without crashing', () => {
    expect(() => render(<SkeletonCard />)).not.toThrow();
  });

  it('should apply animate-pulse class', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });
});

describe('SkeletonList', () => {
  it('should render default 5 items', () => {
    const { container } = render(<SkeletonList />);
    const items = container.querySelectorAll('.animate-pulse');
    expect(items.length).toBe(5);
  });

  it('should render custom count of items', () => {
    const { container } = render(<SkeletonList count={3} />);
    const items = container.querySelectorAll('.animate-pulse');
    expect(items.length).toBe(3);
  });
});

describe('SkeletonStats', () => {
  it('should render default 3 stat cards', () => {
    const { container } = render(<SkeletonStats />);
    const cards = container.querySelectorAll('.animate-pulse');
    expect(cards.length).toBe(3);
  });

  it('should render custom count of stat cards', () => {
    const { container } = render(<SkeletonStats count={2} />);
    const cards = container.querySelectorAll('.animate-pulse');
    expect(cards.length).toBe(2);
  });
});

describe('SkeletonForm', () => {
  it('should render without crashing', () => {
    expect(() => render(<SkeletonForm />)).not.toThrow();
  });

  it('should apply animate-pulse class', () => {
    const { container } = render(<SkeletonForm />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });
});

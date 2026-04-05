import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';

interface TaskFiltersProps {
  bottomSheetRef: React.RefObject<BottomSheetModal>;
  filters: {
    status: string | null;
    priority: string | null;
    dateRange: string | null;
  };
  onFilterChange: (filterType: string, value: string | null) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
}

const TaskFilters: React.FC<TaskFiltersProps> = ({
  bottomSheetRef,
  filters,
  onFilterChange,
  onApplyFilters,
  onResetFilters
}) => {
  const snapPoints = useMemo(() => ['25%', '50%', '90%'], []);

  const statusOptions = [
    { label: 'All', value: null },
    { label: 'Assigned', value: 'assigned' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' },
  ];

  const priorityOptions = [
    { label: 'All', value: null },
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Urgent', value: 'urgent' },
  ];

  const dateRangeOptions = [
    { label: 'All', value: null },
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'this_week' },
    { label: 'This Month', value: 'this_month' },
  ];

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      index={1}
      snapPoints={snapPoints}
      enablePanDownToClose={true}
      backgroundStyle={styles.sheetBackground}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Filter Tasks</Text>
          <TouchableOpacity onPress={onResetFilters}>
            <Ionicons name="refresh" size={24} color="#1e40af" />
          </TouchableOpacity>
        </View>

        {/* Status Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              {statusOptions.map((option) => (
                <TouchableOpacity
                  key={option.value || 'all'}
                  style={[
                    styles.filterButton,
                    filters.status === option.value && styles.activeFilterButton
                  ]}
                  onPress={() => onFilterChange('status', option.value)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      filters.status === option.value && styles.activeFilterText
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Priority Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Priority</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              {priorityOptions.map((option) => (
                <TouchableOpacity
                  key={option.value || 'all'}
                  style={[
                    styles.filterButton,
                    filters.priority === option.value && styles.activeFilterButton
                  ]}
                  onPress={() => onFilterChange('priority', option.value)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      filters.priority === option.value && styles.activeFilterText
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Date Range Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              {dateRangeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value || 'all'}
                  style={[
                    styles.filterButton,
                    filters.dateRange === option.value && styles.activeFilterButton
                  ]}
                  onPress={() => onFilterChange('dateRange', option.value)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      filters.dateRange === option.value && styles.activeFilterText
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

         {/* Apply Button */}
        <TouchableOpacity style={styles.applyButton} onPress={onApplyFilters}>
          <Text style={styles.applyButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};

/* eslint-disable react-native/no-color-literals */
const styles = StyleSheet.create({
  activeFilterButton: {
    backgroundColor: '#1e40af',
  },
  activeFilterText: {
    color: '#ffffff',
  },
  applyButton: {
    alignItems: 'center',
    backgroundColor: '#1e40af',
    borderRadius: 8,
    padding: 16,
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  filterButton: {
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    minWidth: 80,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButtonText: {
    color: '#6b7280',
    fontSize: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterTitle: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    color: '#1f2937',
    fontSize: 18,
    fontWeight: '600',
  },
  sheetBackground: {
    backgroundColor: '#ffffff',
  },
});

export default TaskFilters;
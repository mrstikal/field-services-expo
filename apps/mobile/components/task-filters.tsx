import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { modalStyles } from '@/lib/styles';

interface TaskFiltersProps {
  readonly bottomSheetRef: React.RefObject<BottomSheetModal>;
  readonly filters: {
    status: string | null;
    priority: string | null;
    dateRange: string | null;
  };
  readonly onFilterChange: (filterType: string, value: string | null) => void;
  readonly onApplyFilters: () => void;
  readonly onResetFilters: () => void;
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
      backgroundStyle={modalStyles.bottomSheetBackground}
      enablePanDownToClose
      index={1}
      ref={bottomSheetRef}
      snapPoints={snapPoints}
    >
      <View className="flex-1 p-4">
        <View className="mb-5 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-gray-800">Filter Tasks</Text>
          <TouchableOpacity onPress={onResetFilters}>
            <Ionicons color="#1e40af" name="refresh" size={24} />
          </TouchableOpacity>
        </View>

        {/* Status Filter */}
        <View className="mb-5">
          <Text className="mb-2.5 text-sm font-semibold text-gray-800">Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {statusOptions.map((option) => (
                <TouchableOpacity
                  className={`min-w-20 items-center rounded-full px-3 py-2 ${
                    filters.status === option.value ? 'bg-blue-800' : 'bg-gray-100'
                  }`}
                  key={option.value || 'all'}
                  onPress={() => onFilterChange('status', option.value)}
                >
                  <Text className={`text-xs ${filters.status === option.value ? 'text-white' : 'text-gray-500'}`}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Priority Filter */}
        <View className="mb-5">
          <Text className="mb-2.5 text-sm font-semibold text-gray-800">Priority</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {priorityOptions.map((option) => (
                <TouchableOpacity
                  className={`min-w-20 items-center rounded-full px-3 py-2 ${
                    filters.priority === option.value ? 'bg-blue-800' : 'bg-gray-100'
                  }`}
                  key={option.value || 'all'}
                  onPress={() => onFilterChange('priority', option.value)}
                >
                  <Text className={`text-xs ${filters.priority === option.value ? 'text-white' : 'text-gray-500'}`}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Date Range Filter */}
        <View className="mb-5">
          <Text className="mb-2.5 text-sm font-semibold text-gray-800">Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {dateRangeOptions.map((option) => (
                <TouchableOpacity
                  className={`min-w-20 items-center rounded-full px-3 py-2 ${
                    filters.dateRange === option.value ? 'bg-blue-800' : 'bg-gray-100'
                  }`}
                  key={option.value || 'all'}
                  onPress={() => onFilterChange('dateRange', option.value)}
                >
                  <Text className={`text-xs ${filters.dateRange === option.value ? 'text-white' : 'text-gray-500'}`}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

         {/* Apply Button */}
        <TouchableOpacity className="items-center rounded-lg bg-blue-800 p-4" onPress={onApplyFilters}>
          <Text className="text-base font-semibold text-white">Close</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};


export default TaskFilters;
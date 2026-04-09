import React from 'react';
import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Task } from '@field-service/shared-types';
import { useAuth } from '@/lib/auth-context';
import RNPickerSelect from 'react-native-picker-select';
import { taskRepository } from '@/lib/db/task-repository';
import { reportRepository } from '@/lib/db/report-repository';
import { filterTasksWithoutReports } from './task-selector.utils';

interface TaskSelectorProps {
  readonly selectedTask: Task | null;
  readonly onSelectTask: (task: Task) => void;
}

export function TaskSelector({
  selectedTask,
  onSelectTask,
}: TaskSelectorProps) {
  const { user } = useAuth();

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'available-for-report', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }

      const [userTasks, existingReports] = await Promise.all([
        taskRepository.getByTechnician(user.id),
        reportRepository.getAll(),
      ]);

      const assignableTasks = userTasks
        .filter(task => task.status === 'assigned')
        .sort((a, b) => a.due_date.localeCompare(b.due_date));
      const taskIdsWithReports = new Set(
        existingReports.map(report => report.task_id)
      );

      return filterTasksWithoutReports(
        assignableTasks as Task[],
        taskIdsWithReports
      );
    },
    enabled: !!user?.id,
  });

  const handleTaskSelect = (task: Task) => {
    onSelectTask(task);
  };

  const pickerItems = tasks.map(task => ({
    label: `${task.title} - ${task.address}`,
    value: task.id,
    key: task.id,
    text: `${task.title}\nDue: ${new Date(task.due_date).toLocaleDateString()}`,
  }));

  return (
    <RNPickerSelect
      onValueChange={itemValue => {
        const task = tasks.find((t: Task) => t.id === itemValue);
        if (task) {
          handleTaskSelect(task);
        }
      }}
      items={pickerItems}
      placeholder={{
        label: 'Choose a task...',
        value: undefined,
        key: 'placeholder',
      }}
      pickerProps={{
        testID: 'reports-task-select-input',
      }}
      textInputProps={{
        testID: 'reports-task-select-input',
      }}
      touchableWrapperProps={{
        testID: 'reports-task-select-trigger',
      }}
      value={selectedTask?.id}
      useNativeAndroidPickerStyle={false}
      Icon={() => (
        <View className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <Text className="text-sm text-gray-400">▼</Text>
        </View>
      )}
      style={{
        iconContainer: {
          height: 0,
          width: 0,
        },
        inputIOS: {
          fontSize: 16,
          paddingVertical: 12,
          paddingHorizontal: 12,
          paddingRight: 30,
          borderWidth: 1,
          borderColor: '#e5e7eb',
          borderRadius: 8,
          color: '#1f2937',
          backgroundColor: '#ffffff',
        },
        inputAndroid: {
          fontSize: 16,
          paddingVertical: 12,
          paddingHorizontal: 12,
          paddingRight: 30,
          borderWidth: 1,
          borderColor: '#e5e7eb',
          borderRadius: 8,
          color: '#1f2937',
          backgroundColor: '#ffffff',
        },
      }}
    />
  );
}

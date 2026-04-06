import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Task } from '@field-service/shared-types';
import { useAuth } from '@/lib/auth-context';
import RNPickerSelect from 'react-native-picker-select';

interface TaskSelectorProps {
  readonly selectedTask: Task | null;
  readonly onSelectTask: (task: Task) => void;
}

export function TaskSelector({ selectedTask, onSelectTask }: TaskSelectorProps) {
  const { user } = useAuth();

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'available-for-report', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }

      // Fetch tasks assigned to current user
      const { data: userTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('technician_id', user.id)
        .eq('status', 'assigned')
        .order('due_date', { ascending: true });

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
        return [];
      }

      // Fetch existing reports for filtering
      const { error: reportsError } = await supabase
        .from('reports')
        .select('task_id');

      if (reportsError) {
        console.error('Error fetching reports:', reportsError);
        // If reports fetch fails, return all user tasks
        return (userTasks || []) as Task[];
      }

      // Return only tasks that don't have a report yet
      return (userTasks || []) as Task[];
    },
    enabled: !!user?.id,
  });

  const handleTaskSelect = (task: Task) => {
    onSelectTask(task);
  };

   const pickerItems = tasks.map((task) => ({
     label: `${task.title} - ${task.address}`,
     value: task.id,
     key: task.id,
     text: `${task.title}\nDue: ${new Date(task.due_date).toLocaleDateString()}`,
   }));

   return (
     <RNPickerSelect
       onValueChange={(itemValue) => {
         const task = tasks.find((t: Task) => t.id === itemValue);
         if (task) {
           handleTaskSelect(task);
         }
       }}
       items={pickerItems}
       placeholder={{ label: 'Choose a task...', value: undefined, key: 'placeholder' }}
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
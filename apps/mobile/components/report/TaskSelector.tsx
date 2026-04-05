import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Task } from '@field-service/shared-types';

interface TaskSelectorProps {
  readonly selectedTask: Task | null;
  readonly onSelectTask: (task: Task) => void;
}

export function TaskSelector({ selectedTask, onSelectTask }: TaskSelectorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', 'assigned'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'assigned')
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Error fetching tasks:', error);
        return [];
      }
      return data as Task[];
    },
  });

  const handleTaskSelect = (task: Task) => {
    onSelectTask(task);
    setIsModalOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        className="mb-4 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
        onPress={() => setIsModalOpen(true)}
      >
        <View className="flex-1">
          <Text className="mb-1 text-xs text-gray-500">
            {selectedTask ? 'Selected Task' : 'Select Task'}
          </Text>
          <Text className="text-sm font-semibold text-gray-800">
            {selectedTask ? selectedTask.title : 'Choose a task...'}
          </Text>
        </View>
        <Text className="text-xs text-gray-400">▼</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        onRequestClose={() => setIsModalOpen(false)}
        visible={isModalOpen}
      >
        <View className="flex-1 bg-slate-50">
          <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
            <Text className="text-lg font-semibold text-gray-800">Select Task</Text>
            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
              <Text className="text-2xl text-gray-500">✕</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View className="flex-1 items-center justify-center p-8">
              <Text>Loading tasks...</Text>
            </View>
          ) : (
            <FlatList
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center p-8">
                  <Text className="text-sm text-gray-400">No tasks available</Text>
                </View>
              }
              data={tasks}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="flex-row items-center justify-between border-b border-gray-200 bg-white p-4"
                  onPress={() => handleTaskSelect(item)}
                >
                  <View className="flex-1">
                    <Text className="mb-1 text-base font-semibold text-gray-800">{item.title}</Text>
                    <Text className="mb-0.5 text-xs text-gray-500">{item.address}</Text>
                    <Text className="text-[11px] text-gray-400">
                      Due: {new Date(item.due_date).toLocaleDateString()}
                    </Text>
                  </View>
                  <View className="ml-2 rounded bg-gray-100 px-2 py-1">
                    <Text className="text-[10px] font-semibold capitalize text-gray-500">{item.priority}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </>
  );
}


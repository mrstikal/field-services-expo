import React, { memo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Task } from '@field-service/shared-types';

interface TaskCardProps {
  item: Task;
  onPress: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ item, onPress }) => {

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return '#dc2626';
      case 'high':
        return '#f97316';
      case 'medium':
        return '#eab308';
      case 'low':
        return '#22c55e';
      default:
        return '#6b7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'Assigned';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  return (
    <TouchableOpacity
      style={styles.taskCard}
      onPress={onPress}
    >
      <View style={styles.taskHeader}>
        {/* eslint-disable-next-line react-native/no-inline-styles */}
        <View style={{ flex: 1 }}>
          <Text style={styles.taskTitle}>{item.title}</Text>
          <View style={styles.taskMeta}>
            <Ionicons name="location-outline" size={12} color="#6b7280" />
            <Text style={styles.taskAddress}>{item.address}</Text>
          </View>
        </View>
        <View
          style={[
            styles.priorityBadge,
            { backgroundColor: getPriorityColor(item.priority) },
          ]}
        >
          <Text style={styles.priorityText}>{item.priority}</Text>
        </View>
      </View>
      <View style={styles.taskFooter}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
        <View style={styles.timeEstimate}>
          <Ionicons name="time-outline" size={12} color="#6b7280" />
          <Text style={styles.timeText}>{item.estimated_time} min</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

/* eslint-disable react-native/no-color-literals */
const styles = StyleSheet.create({
  priorityBadge: {
    borderRadius: 4,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priorityText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '500',
  },
  taskAddress: {
    color: '#6b7280',
    flex: 1,
    fontSize: 12,
    marginLeft: 4,
  },
  taskCard: {
    backgroundColor: '#ffffff',
    borderLeftColor: '#1e40af',
    borderLeftWidth: 4,
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
  },
  taskFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taskHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  taskMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 6,
  },
  taskTitle: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
  timeEstimate: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  timeText: {
    color: '#6b7280',
    fontSize: 11,
    marginLeft: 4,
  },
});

const MemoizedTaskCard = memo(TaskCard);
export default MemoizedTaskCard;
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SyncEngine } from '../../sync/sync-engine';
import { TaskRepository } from '../task-repository';
import { ReportRepository } from '../report-repository';
import { getTestDatabase, closeDatabase } from '../local-database';
import { SQLiteDatabase } from 'expo-sqlite';

// Mock server for real integration testing
// In a real scenario, we might use a real mock server or MSW
import { vi } from 'vitest';

const describeNativeOnly = process.env.EXPO_NATIVE_TESTS === '1' ? describe : describe.skip;

describeNativeOnly('Mobile Database Integration', () => {
  let testDb: SQLiteDatabase;
  let taskRepository: TaskRepository;
  let reportRepository: ReportRepository;

  beforeEach(async () => {
    testDb = await getTestDatabase();
    taskRepository = new TaskRepository(testDb);
    reportRepository = new ReportRepository(testDb);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('should persist and retrieve a task correctly', async () => {
    const taskData = {
        title: 'Integration Test Task',
        description: 'Test integration',
        address: '123 Test St',
        latitude: 0,
        longitude: 0,
        status: 'assigned' as const,
        priority: 'low' as const,
        category: 'repair' as const,
        due_date: '2024-01-01',
        customer_name: 'Test Customer',
        customer_phone: '123456',
        estimated_time: 1,
        technician_id: 'tech-1'
    };

    const createdTask = await taskRepository.create(taskData as any);
    const retrievedTask = await taskRepository.getById(createdTask.id);

    expect(retrievedTask).toBeDefined();
    expect(retrievedTask?.title).toBe('Integration Test Task');
    expect(retrievedTask?.id).toBe(createdTask.id);
  });

  it('should update task status', async () => {
    const taskData = {
        title: 'Status Update Test',
        description: 'Test update',
        address: '123 Test St',
        latitude: 0,
        longitude: 0,
        status: 'assigned' as const,
        priority: 'low' as const,
        category: 'repair' as const,
        due_date: '2024-01-01',
        customer_name: 'Test Customer',
        customer_phone: '123456',
        estimated_time: 1,
        technician_id: 'tech-1'
    };
    const createdTask = await taskRepository.create(taskData as any);
    
    await taskRepository.update(createdTask.id, { status: 'in_progress' });
    const updatedTask = await taskRepository.getById(createdTask.id);
    
    expect(updatedTask?.status).toBe('in_progress');
  });
});

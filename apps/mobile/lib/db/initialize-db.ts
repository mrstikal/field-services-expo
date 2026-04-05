import { initDatabase } from './local-database';
import { taskRepository } from './task-repository';
import { reportRepository } from './report-repository';
import { supabase } from '@/lib/supabase';

/**
 * Initialize database with seed data from server
 * Called on app first launch
 */
export async function initializeDatabaseWithSeedData() {
  try {
    // Initialize local database
    await initDatabase();

    // Check if we already have data locally
    const hasTasks = await taskRepository.getAll();
    if (hasTasks.length > 0) {
      return; // Data already exists
    }

    // Fetch seed data from server
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .limit(50);

    if (tasksError) {
      console.error('Error fetching seed tasks:', tasksError);
      return;
    }

    // Insert tasks locally
    for (const task of tasks) {
      await taskRepository.create(task);
    }

    // Fetch seed reports from server
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .limit(50);

    if (reportsError) {
      console.error('Error fetching seed reports:', reportsError);
      return;
    }

    // Insert reports locally
    for (const report of reports) {
      await reportRepository.create(report);
    }

    console.log('Database initialized with seed data');
  } catch (error) {
    console.error('Error initializing database with seed data:', error);
  }
}

/**
 * Check if database is empty
 */
export async function isDatabaseEmpty(): Promise<boolean> {
  try {
    await initDatabase();
    const tasks = await taskRepository.getAll();
    return tasks.length === 0;
  } catch {
    return true;
  }
}
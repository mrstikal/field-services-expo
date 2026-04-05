import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { initDatabase, closeDatabase } from './local-database';
import { SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';

interface DatabaseContextType {
  db: SQLiteDatabase | null;
  isInitialized: boolean;
  error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export function DatabaseProvider({ children }: { readonly children: ReactNode }) {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const database = await initDatabase();
        if (isMounted) {
          setDb(database);
          setIsInitialized(true);
        }
      } catch (err) {
        console.error('Database initialization failed:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setIsInitialized(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeDatabase();
    };
  }, []);

  return (
    <DatabaseContext.Provider value={{ db, isInitialized, error }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}

// Helper hook for simple database access
export function useDatabaseQuery<T>(
  query: string,
  params: (string | number)[] = [],
  enabled: boolean = true
): {
  data: T[] | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { db, isInitialized, error: initError } = useDatabase();
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !isInitialized || initError || !db) {
      return;
    }

    setIsLoading(true);

    db.getAllAsync<T>(query, params)
      .then((result) => {
        setData(result);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Database query error:', err);
        setIsLoading(false);
      });
  }, [db, isInitialized, initError, enabled, query, params]);

  return { data, isLoading, error: initError };
}

  // Helper hook for database mutations
export function useDatabaseMutation() {
  const { db, isInitialized, error: initError } = useDatabase();

  const mutate = async (
    query: string,
    params: (string | number)[] = []
  ): Promise<SQLiteRunResult | null> => {
    if (!isInitialized || initError || !db) {
      throw new Error('Database not initialized');
    }

    return db.runAsync(query, params);
  };

  return { mutate, isInitialized, error: initError };
}

import { create } from 'zustand';
import { Report, ReportFormData } from '@field-service/shared-types';

interface ReportState {
  // Current report being created
  currentReport: {
    photos: string[];
    formData: ReportFormData;
    signature: string | null;
    selectedTaskId: string | null;
  };
  
  // Reports stored locally (offline)
  localReports: Report[];
  
  // Actions
  addPhoto: (uri: string) => void;
  removePhoto: (id: string) => void;
  setFormData: (data: ReportFormData) => void;
  setSignature: (signature: string | null) => void;
  setSelectedTask: (taskId: string | null) => void;
  
  // Local reports management
  addLocalReport: (report: Report) => void;
  updateLocalReport: (reportId: string, updates: Partial<Report>) => void;
  removeLocalReport: (reportId: string) => void;
  clearCurrentReport: () => void;
}

export const useReportStore = create<ReportState>((set) => ({
  currentReport: {
    photos: [],
    formData: {},
    signature: null,
    selectedTaskId: null,
  },
  
  localReports: [],
  
  addPhoto: (uri: string) => set((state) => ({
    currentReport: {
      ...state.currentReport,
      photos: [...state.currentReport.photos, uri],
    },
  })),
  
  removePhoto: (id: string) => set((state) => ({
    currentReport: {
      ...state.currentReport,
      photos: state.currentReport.photos.filter((_, index) => index !== parseInt(id)),
    },
  })),
  
  setFormData: (data: ReportFormData) => set((state) => ({
    currentReport: {
      ...state.currentReport,
      formData: { ...state.currentReport.formData, ...data },
    },
  })),
  
  setSignature: (signature: string | null) => set((state) => ({
    currentReport: {
      ...state.currentReport,
      signature,
    },
  })),
  
  setSelectedTask: (taskId: string | null) => set((state) => ({
    currentReport: {
      ...state.currentReport,
      selectedTaskId: taskId,
    },
  })),
  
  addLocalReport: (report: Report) => set((state) => ({
    localReports: [...state.localReports, report],
  })),
  
  updateLocalReport: (reportId: string, updates: Partial<Report>) => set((state) => ({
    localReports: state.localReports.map(report =>
      report.id === reportId ? { ...report, ...updates } : report
    ),
  })),
  
  removeLocalReport: (reportId: string) => set((state) => ({
    localReports: state.localReports.filter(report => report.id !== reportId),
  })),
  
  clearCurrentReport: () => set({
    currentReport: {
      photos: [],
      formData: {},
      signature: null,
      selectedTaskId: null,
    },
  }),
}));
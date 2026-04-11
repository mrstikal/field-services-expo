'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Download,
  Eye,
  Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ReportListItem {
  id: string;
  status: string;
  photos: string[] | null;
  created_at: string;
  pdf_url: string | null;
  tasks?: {
    title?: string | null;
    customer_name?: string | null;
  } | null;
}

export default function ReportsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'completed' | 'draft' | 'synced'>('all');

  const {
    data: reports = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['reports', filter],
    queryFn: async () => {
      let query = supabase
        .from('reports')
        .select(`
          *,
          tasks (
            title,
            customer_name,
            customer_phone,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) {
        if (error.message?.toLowerCase().includes('invalid api key')) {
          return [];
        }
        throw error;
      }
      return data || [];
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'synced':
        return <Badge className="bg-blue-100 text-blue-800">Synced</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-800">Draft</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">Service Reports</h1>
          <p className="text-gray-500 mt-2">Loading reports from database...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-center py-12 text-red-600">
          Error loading reports: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-600" />
            Service Reports
          </h1>
          <p className="text-gray-600 mt-1">All reports from field technicians ({reports.length})</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'draft' ? 'default' : 'outline'}
            onClick={() => setFilter('draft')}
          >
            Drafts
          </Button>
          <Button
            variant={filter === 'completed' ? 'default' : 'outline'}
            onClick={() => setFilter('completed')}
          >
            Completed
          </Button>
          <Button
            variant={filter === 'synced' ? 'default' : 'outline'}
            onClick={() => setFilter('synced')}
          >
            Synced
          </Button>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Reports List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Photos</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length > 0 ? (
                  reports.map((report: ReportListItem) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">
                        {report.tasks?.title || 'Unknown Task'}
                      </TableCell>
                      <TableCell>
                        {report.tasks?.customer_name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(report.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span>{report.photos?.length || 0}</span>
                          <FileText className="h-4 w-4 text-gray-400" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="mr-1 h-4 w-4" />
                          {new Date(report.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(report.pdf_url || '#', '_blank')}
                            disabled={!report.pdf_url}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/dashboard/reports/${report.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Detail
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                      No reports found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-gray-400 text-center mt-8">
        Reports are loaded directly from the database with joined task information. 
        Use filters above to narrow results.
      </div>
    </div>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Download, Image, User, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormDataDisplay } from '@/components/form-data-display';

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = (params?.id as string) || '';

      const { data: report, isLoading, error } = useQuery({
        queryKey: ['report', reportId],
        queryFn: async () => {
          const { data, error } = await supabase
            .from('reports')
            .select(`
              *,
              tasks (
                title,
                description,
                customer_name,
                customer_phone,
                address,
                status,
                priority,
                due_date,
                category
              )
            `)
            .eq('id', reportId)
            .single();

          if (error) {
            if (error.message?.toLowerCase().includes('invalid api key')) {
              return null;
            }
            throw error;
          }
          return data;
        },
      });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="space-y-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-red-600">Report not found</h1>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'synced':
        return <Badge className="bg-blue-100 text-blue-800">Synced to server</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-800">Draft</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Reports
      </Button>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="h-10 w-10 text-blue-600" />
            Service Report
          </h1>
          <p className="text-gray-500 mt-2">ID: {report.id}</p>
        </div>
        <div className="flex gap-3">
          {report.pdf_url && (
            <Button onClick={() => window.open(report.pdf_url, '_blank')}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          )}
          <Button variant="outline" onClick={() => router.back()}>
            Close
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Task Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-gray-500">Task Title</div>
                <div className="font-semibold text-lg">{report.tasks?.title}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Description</div>
                <div className="text-gray-700 whitespace-pre-wrap">{report.tasks?.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Customer</div>
                  <div>{report.tasks?.customer_name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Phone</div>
                  <div>{report.tasks?.customer_phone}</div>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Address</div>
                <div className="text-gray-700">{report.tasks?.address}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Form Data</CardTitle>
            </CardHeader>
            <CardContent>
              <FormDataDisplay data={report.form_data} category={report.tasks?.category} />
            </CardContent>
          </Card>

          {report.signature && (
            <Card>
              <CardHeader>
                <CardTitle>Customer Signature</CardTitle>
              </CardHeader>
              <CardContent>
                <img 
                  src={report.signature} 
                  alt="Signature" 
                  className="border border-gray-200 max-w-md"
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Report Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Status</span>
                {getStatusBadge(report.status)}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Created</span>
                <span className="text-sm">
                  {new Date(report.created_at).toLocaleString('cs-CZ')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Last Updated</span>
                <span className="text-sm">
                  {new Date(report.updated_at).toLocaleString('cs-CZ')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Photos</span>
                <span className="font-medium">{report.photos?.length || 0}</span>
              </div>
            </CardContent>
          </Card>

          {report.photos && report.photos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Attached Photos ({report.photos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {report.photos.map((photo: string, index: number) => (
                    <div key={index} className="relative aspect-square bg-gray-100 rounded overflow-hidden border">
                      <img 
                        src={photo} 
                        alt={`Photo ${index + 1}`}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/300x300?text=Photo+Not+Found';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {report.pdf_url && (
            <Card>
              <CardContent className="pt-6">
                <Button className="w-full" onClick={() => window.open(report.pdf_url!, '_blank')}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Generated PDF
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

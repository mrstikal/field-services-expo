'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Technician {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_online: boolean;
  last_location_lat: number | null;
  last_location_lng: number | null;
  created_at: string;
}

export default function TechniciansPage() {
  const { data: technicians = [], isLoading } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'technician')
        .order('name', { ascending: true });
      return data || [];
    },
  });

  const filteredTechnicians = technicians as Technician[];
  const onlineTechnicians = filteredTechnicians.filter(t => t.is_online).length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Technicians</h1>
        <p className="text-gray-600 mt-2">Manage your field service team</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Technicians
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {filteredTechnicians.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Online Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {onlineTechnicians}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Offline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-600">
              {filteredTechnicians.length - onlineTechnicians}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Technicians Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              Loading technicians...
            </div>
          ) : filteredTechnicians.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No technicians found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Phone
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Location
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTechnicians.map(tech => (
                    <tr
                      className="border-b border-gray-100 hover:bg-gray-50"
                      key={tech.id}
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{tech.name}</p>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {tech.email}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {tech.phone}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              tech.is_online ? 'bg-green-600' : 'bg-gray-400'
                            }`}
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {tech.is_online ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {tech.last_location_lat && tech.last_location_lng
                          ? `${parseFloat(tech.last_location_lat.toString()).toFixed(4)}, ${parseFloat(tech.last_location_lng.toString()).toFixed(4)}`
                          : 'No location'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(tech.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

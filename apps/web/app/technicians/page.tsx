import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, MapPin, Phone, Mail } from 'lucide-react';

export default function TechniciansPage() {
  const technicians = [
    {
      id: 'technik1',
      name: 'Peter Johnson',
      email: 'technik1@demo.cz',
      phone: '+420 777 111 222',
      status: 'online',
      location: 'Prague 1',
    },
    {
      id: 'technik2',
      name: 'Anna Williams',
      email: 'technik2@demo.cz',
      phone: '+420 777 111 223',
      status: 'online',
      location: 'Brno',
    },
    {
      id: 'technik3',
      name: 'Thomas Brown',
      email: 'technik3@demo.cz',
      phone: '+420 777 111 224',
      status: 'offline',
      location: 'Prague 7',
    },
    {
      id: 'technik4',
      name: 'Michael Davis',
      email: 'technik4@demo.cz',
      phone: '+420 777 111 225',
      status: 'online',
      location: 'Brno',
    },
    {
      id: 'technik5',
      name: 'David Miller',
      email: 'technik5@demo.cz',
      phone: '+420 777 111 226',
      status: 'offline',
      location: 'Prague 2',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Technicians</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add technician
        </Button>
      </div>

      <div className="grid gap-4">
        {technicians.map((tech) => (
          <Card key={tech.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{tech.name}</h3>
                    <Badge variant={tech.status === 'online' ? 'default' : 'secondary'}>
                      {tech.status}
                    </Badge>
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <Mail className="mr-2 h-4 w-4" />
                    {tech.email}
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <Phone className="mr-2 h-4 w-4" />
                    {tech.phone}
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <MapPin className="mr-2 h-4 w-4" />
                    {tech.location}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Details
                  </Button>
                  <Button variant="outline" size="sm">
                    Map
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
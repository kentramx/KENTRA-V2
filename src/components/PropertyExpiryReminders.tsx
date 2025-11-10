import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Bell, CheckCircle, AlertTriangle, Clock, TrendingUp, Timer, BarChart3 } from 'lucide-react';
import { format, differenceInHours, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface ExpiryReminder {
  id: string;
  property_id: string;
  days_before: number;
  sent_at: string;
  property: {
    title: string;
    status: string;
    expires_at: string;
    last_renewed_at: string;
  };
}

interface PropertyExpiryRemindersProps {
  agentId: string;
}

interface ReminderStats {
  totalReminders: number;
  renewedAfterReminder: number;
  renewalRate: number;
  averageResponseTimeHours: number;
  averageResponseTimeDays: number;
  remindersBy7Days: number;
  remindersBy3Days: number;
  remindersBy1Day: number;
}

export const PropertyExpiryReminders = ({ agentId }: PropertyExpiryRemindersProps) => {
  const [reminders, setReminders] = useState<ExpiryReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReminderStats | null>(null);

  useEffect(() => {
    fetchReminders();
  }, [agentId]);

  const fetchReminders = async () => {
    try {
      const { data, error } = await supabase
        .from('property_expiry_reminders')
        .select(`
          id,
          property_id,
          days_before,
          sent_at,
          properties:property_id (
            title,
            status,
            expires_at,
            last_renewed_at
          )
        `)
        .eq('agent_id', agentId)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      // Formatear datos para acceso más fácil
      const formattedData = data?.map((reminder: any) => ({
        ...reminder,
        property: Array.isArray(reminder.properties) ? reminder.properties[0] : reminder.properties,
      })) || [];

      setReminders(formattedData);
      calculateStats(formattedData);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (remindersData: ExpiryReminder[]) => {
    if (remindersData.length === 0) {
      setStats(null);
      return;
    }

    let renewedCount = 0;
    let totalResponseTimeHours = 0;
    let responsesCount = 0;
    let reminders7Days = 0;
    let reminders3Days = 0;
    let reminders1Day = 0;

    remindersData.forEach((reminder) => {
      // Contar por urgencia
      if (reminder.days_before === 7) reminders7Days++;
      if (reminder.days_before === 3) reminders3Days++;
      if (reminder.days_before === 1) reminders1Day++;

      const sentDate = new Date(reminder.sent_at);
      const lastRenewedDate = reminder.property?.last_renewed_at 
        ? new Date(reminder.property.last_renewed_at) 
        : null;

      // Si se renovó después del recordatorio
      if (lastRenewedDate && lastRenewedDate > sentDate) {
        renewedCount++;
        
        // Calcular tiempo de respuesta
        const responseTimeHours = differenceInHours(lastRenewedDate, sentDate);
        totalResponseTimeHours += responseTimeHours;
        responsesCount++;
      }
    });

    const renewalRate = (renewedCount / remindersData.length) * 100;
    const averageResponseTimeHours = responsesCount > 0 
      ? totalResponseTimeHours / responsesCount 
      : 0;
    const averageResponseTimeDays = averageResponseTimeHours / 24;

    setStats({
      totalReminders: remindersData.length,
      renewedAfterReminder: renewedCount,
      renewalRate,
      averageResponseTimeHours,
      averageResponseTimeDays,
      remindersBy7Days: reminders7Days,
      remindersBy3Days: reminders3Days,
      remindersBy1Day: reminders1Day,
    });
  };

  const getReminderBadge = (daysB: number) => {
    switch (daysB) {
      case 7:
        return <Badge variant="secondary">📅 7 días antes</Badge>;
      case 3:
        return <Badge variant="default" className="bg-yellow-500 text-white">⏰ 3 días antes</Badge>;
      case 1:
        return <Badge variant="destructive">🚨 1 día antes</Badge>;
      default:
        return <Badge variant="outline">{daysB} días antes</Badge>;
    }
  };

  const getRenewalStatus = (reminder: ExpiryReminder) => {
    const { property } = reminder;
    const sentDate = new Date(reminder.sent_at);
    const lastRenewedDate = property.last_renewed_at ? new Date(property.last_renewed_at) : null;

    // Si se renovó después de enviar el recordatorio
    if (lastRenewedDate && lastRenewedDate > sentDate) {
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm">Renovada después del recordatorio</span>
        </div>
      );
    }

    // Verificar estado actual
    if (property.status === 'activa') {
      const expiresAt = new Date(property.expires_at);
      const now = new Date();
      const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft > 0) {
        return (
          <div className="flex items-center gap-2 text-blue-600">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Activa - expira en {daysLeft} días</span>
          </div>
        );
      } else {
        return (
          <div className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Requiere renovación</span>
          </div>
        );
      }
    }

    if (property.status === 'pausada') {
      return (
        <div className="flex items-center gap-2 text-gray-500">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">Pausada por expiración</span>
        </div>
      );
    }

    if (property.status === 'vendida' || property.status === 'rentada') {
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm capitalize">{property.status}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-gray-500">
        <span className="text-sm capitalize">{property.status}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (reminders.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Sin recordatorios
          </h3>
          <p className="text-muted-foreground">
            No has recibido recordatorios de expiración aún. Te notificaremos cuando tus propiedades estén próximas a expirar.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 text-primary" />
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Historial de Recordatorios
          </h3>
          <p className="text-sm text-muted-foreground">
            Recordatorios automáticos enviados sobre propiedades próximas a expirar
          </p>
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tasa de Renovación */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Tasa de Renovación
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stats.renewalRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.renewedAfterReminder} de {stats.totalReminders} renovadas después del recordatorio
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <Badge variant="secondary" className="text-xs">
                  📅 7d: {stats.remindersBy7Days}
                </Badge>
                <Badge variant="default" className="text-xs bg-yellow-500">
                  ⏰ 3d: {stats.remindersBy3Days}
                </Badge>
                <Badge variant="destructive" className="text-xs">
                  🚨 1d: {stats.remindersBy1Day}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Tiempo Promedio de Respuesta */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Tiempo Promedio de Respuesta
              </CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stats.averageResponseTimeDays < 1 
                  ? `${stats.averageResponseTimeHours.toFixed(1)}h`
                  : `${stats.averageResponseTimeDays.toFixed(1)}d`
                }
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Desde el recordatorio hasta la renovación
              </p>
              {stats.renewedAfterReminder > 0 && (
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    {stats.averageResponseTimeHours < 24 ? (
                      <Badge variant="default" className="bg-green-500 text-white text-xs">
                        ⚡ Respuesta rápida
                      </Badge>
                    ) : stats.averageResponseTimeDays < 3 ? (
                      <Badge variant="secondary" className="text-xs">
                        ✓ Respuesta buena
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Respuesta tardía
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Efectividad por Urgencia */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Efectividad por Urgencia
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.remindersBy7Days > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">7 días antes:</span>
                    <span className="font-semibold">
                      {((reminders.filter(r => r.days_before === 7 && 
                        r.property?.last_renewed_at && 
                        new Date(r.property.last_renewed_at) > new Date(r.sent_at)).length / 
                        stats.remindersBy7Days) * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
                {stats.remindersBy3Days > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">3 días antes:</span>
                    <span className="font-semibold">
                      {((reminders.filter(r => r.days_before === 3 && 
                        r.property?.last_renewed_at && 
                        new Date(r.property.last_renewed_at) > new Date(r.sent_at)).length / 
                        stats.remindersBy3Days) * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
                {stats.remindersBy1Day > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">1 día antes:</span>
                    <span className="font-semibold">
                      {((reminders.filter(r => r.days_before === 1 && 
                        r.property?.last_renewed_at && 
                        new Date(r.property.last_renewed_at) > new Date(r.sent_at)).length / 
                        stats.remindersBy1Day) * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                % de renovaciones por tipo de recordatorio
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Propiedad</TableHead>
              <TableHead>Urgencia</TableHead>
              <TableHead>Fecha de Envío</TableHead>
              <TableHead>Estado de Renovación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reminders.map((reminder) => (
              <TableRow key={reminder.id}>
                <TableCell className="font-medium">
                  {reminder.property?.title || 'Propiedad eliminada'}
                </TableCell>
                <TableCell>
                  {getReminderBadge(reminder.days_before)}
                </TableCell>
                <TableCell>
                  {format(new Date(reminder.sent_at), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                </TableCell>
                <TableCell>
                  {reminder.property ? getRenewalStatus(reminder) : (
                    <span className="text-sm text-muted-foreground">N/A</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="bg-muted/30 border border-border rounded-lg p-4 mt-6">
        <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Sobre los recordatorios
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Recibirás recordatorios automáticos <strong>7, 3 y 1 día</strong> antes de que expire cada propiedad</li>
          <li>• Los recordatorios se envían por email a las <strong>9:00 AM</strong> hora de México</li>
          <li>• Si no renuevas, la propiedad se <strong>pausa automáticamente</strong> a los 30 días</li>
          <li>• Puedes reactivar propiedades pausadas con un clic desde "Mis Propiedades"</li>
        </ul>
      </div>
    </div>
  );
};

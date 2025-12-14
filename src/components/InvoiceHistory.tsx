import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Download, ExternalLink, Loader2, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Invoice {
  id: string;
  number: string | null;
  date: number;
  amount: number;
  currency: string;
  status: string;
  description: string;
  pdfUrl: string | null;
  hostedInvoiceUrl: string | null;
  periodStart: number;
  periodEnd: number;
}

interface InvoiceHistoryProps {
  userId: string;
}

export const InvoiceHistory = ({ userId }: InvoiceHistoryProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, [userId]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: invoiceError } = await supabase.functions.invoke('get-invoices');
      
      if (invoiceError) {
        throw invoiceError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setInvoices(data?.invoices || []);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Error al cargar las facturas');
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las facturas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-600">Pagada</Badge>;
      case 'open':
        return <Badge variant="secondary">Pendiente</Badge>;
      case 'draft':
        return <Badge variant="outline">Borrador</Badge>;
      case 'void':
        return <Badge variant="destructive">Anulada</Badge>;
      case 'uncollectible':
        return <Badge variant="destructive">Incobrable</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || 'MXN',
    }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error al cargar facturas</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchInvoices} variant="outline">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin facturas</h3>
            <p className="text-muted-foreground">
              Aún no tienes facturas. Aparecerán aquí después de tu primer pago.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Historial de Facturas
          </CardTitle>
          <CardDescription>
            Todas tus facturas de suscripción
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.number || '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(invoice.date * 1000), "d MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate block cursor-help">
                            {invoice.description}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[300px]">
                          <p>{invoice.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(invoice.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {invoice.pdfUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(invoice.pdfUrl!, '_blank')}
                            className="gap-1"
                          >
                            <Download className="h-4 w-4" />
                            PDF
                          </Button>
                        )}
                        {invoice.hostedInvoiceUrl && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(invoice.hostedInvoiceUrl!, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Ver factura en línea</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

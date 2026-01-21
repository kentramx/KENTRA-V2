import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

interface PropertyData {
  id: string;
  title: string;
  price: number;
  description?: string;
  type?: string;
  listing_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  sqft?: number;
  lot_size?: number;
  municipality?: string;
  state?: string;
  images?: (string | { url: string })[];
}

interface AgentData {
  name?: string;
  phone?: string;
  whatsapp_number?: string;
}

interface PropertyExportPDFProps {
  property: PropertyData;
  agent: AgentData;
}

export const PropertyExportPDF = ({ property, agent }: PropertyExportPDFProps) => {
  const [isExporting, setIsExporting] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const generateQRCode = async (text: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(text, {
        width: 150,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
      throw error;
    }
  };

  const getAbsoluteImageUrl = (url: string): string => {
    // Si es una URL de Supabase storage, retornarla directamente
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Si es una ruta relativa de assets, convertir a URL absoluta
    if (url.startsWith('/src/')) {
      // Remover /src/ y construir URL desde public
      const assetPath = url.replace('/src/', '/');
      return `${window.location.origin}${assetPath}`;
    }
    // Si ya tiene formato correcto, retornar
    return url.startsWith('/') ? `${window.location.origin}${url}` : url;
  };

  const loadImageAsBase64 = async (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
          } else {
            reject(new Error("Could not get canvas context"));
          }
        } catch (error) {
          console.error("Error converting image to base64:", error);
          reject(error);
        }
      };
      
      img.onerror = (error) => {
        console.error("Error loading image:", url, error);
        reject(new Error(`Could not load image: ${url}`));
      };
      
      const absoluteUrl = getAbsoluteImageUrl(url);
      img.src = absoluteUrl;
    });
  };

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Header
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Ficha de Propiedad", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 15;

      // Property Title
      doc.setFontSize(16);
      doc.text(property.title, 20, yPosition);
      yPosition += 10;

      // Price
      doc.setFontSize(14);
      doc.setTextColor(0, 100, 200);
      doc.text(formatPrice(property.price), 20, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 10;

      // Location
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${property.address}, ${property.municipality}, ${property.state}`,
        20,
        yPosition
      );
      yPosition += 15;

      // Images Section
      if (property.images && property.images.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Imágenes", 20, yPosition);
        yPosition += 7;

        // Load and add up to 4 images
        const imageUrls = property.images.map((img: string | { url: string }) =>
          typeof img === 'string' ? img : img.url
        ).slice(0, 4);

        for (let i = 0; i < imageUrls.length; i++) {
          try {
            const imageUrl = imageUrls[i];
            const base64Image = await loadImageAsBase64(imageUrl);
            
            const imgWidth = pageWidth - 40;
            const imgHeight = 60;

            // Check if we need a new page
            if (yPosition + imgHeight > pageHeight - 30) {
              doc.addPage();
              yPosition = 20;
            }

            doc.addImage(base64Image, "JPEG", 20, yPosition, imgWidth, imgHeight);
            yPosition += imgHeight + 10;
          } catch (error) {
            console.error(`Error loading image ${i + 1}:`, error);
            // Continue with next image even if one fails
          }
        }
      }

      // Check if we need a new page for details table
      if (yPosition + 50 > pageHeight - 30) {
        doc.addPage();
        yPosition = 20;
      }

      // Property Details Table
      const detailsData = [
        ["Tipo", property.type],
        ["Operación", property.listing_type === "venta" ? "Venta" : "Renta"],
        ...(property.bedrooms ? [["Recámaras", property.bedrooms.toString()]] : []),
        ...(property.bathrooms ? [["Baños", property.bathrooms.toString()]] : []),
        ...(property.parking ? [["Estacionamientos", property.parking.toString()]] : []),
        ...(property.sqft ? [["m² Construidos", property.sqft.toString()]] : []),
        ...(property.lot_size ? [["m² Terreno", property.lot_size.toString()]] : []),
      ];

      autoTable(doc, {
        startY: yPosition,
        head: [["Característica", "Valor"]],
        body: detailsData,
        theme: "grid",
        headStyles: { fillColor: [0, 100, 200] },
      });

      yPosition = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

      // Description
      if (property.description) {
        // Check if we need a new page
        if (yPosition + 30 > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Descripción", 20, yPosition);
        yPosition += 7;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const splitDescription = doc.splitTextToSize(
          property.description,
          pageWidth - 40
        );
        doc.text(splitDescription, 20, yPosition);
        yPosition += splitDescription.length * 5 + 10;
      }

      // Agent Info
      if (agent) {
        // Check if we need a new page
        if (yPosition + 30 > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Información del Agente", 20, yPosition);
        yPosition += 7;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Nombre: ${agent.name}`, 20, yPosition);
        yPosition += 6;

        if (agent.phone) {
          doc.text(`Teléfono: ${agent.phone}`, 20, yPosition);
          yPosition += 6;
        }

        if (agent.email) {
          doc.text(`Email: ${agent.email}`, 20, yPosition);
          yPosition += 6;
        }
      }

      // QR Code with property URL
      try {
        // Check if we need a new page for QR
        if (yPosition + 60 > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }

        const propertyUrl = `${window.location.origin}/propiedad/${property.id}`;
        const qrCodeDataUrl = await generateQRCode(propertyUrl);

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Escanea para ver más detalles", 20, yPosition);
        yPosition += 7;

        // Add QR code (40x40mm square)
        doc.addImage(qrCodeDataUrl, "PNG", 20, yPosition, 40, 40);
        
        // Add URL text below QR
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        const urlText = doc.splitTextToSize(propertyUrl, 80);
        doc.text(urlText, 20, yPosition + 45);
      } catch (error) {
        console.error("Error generating QR code:", error);
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Generado el ${new Date().toLocaleDateString("es-MX")}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }

      // Save PDF
      doc.save(`propiedad-${property.id}.pdf`);
      toast.success("PDF generado exitosamente");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error al generar el PDF");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={exportToPDF}
      disabled={isExporting}
    >
      {isExporting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generando...
        </>
      ) : (
        <>
          <FileDown className="mr-2 h-4 w-4" />
          Exportar PDF
        </>
      )}
    </Button>
  );
};

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ChurchInfo {
  church_name: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  cnpj?: string;
}

interface PDFHeaderOptions {
  documentTitle: string;
  churchInfo: ChurchInfo;
  period?: string;
  pageNumber?: number;
}

export const addPDFHeader = (doc: jsPDF, options: PDFHeaderOptions) => {
  const { documentTitle, churchInfo, period, pageNumber } = options;
  
  const pageWidth = doc.internal.pageSize.width;
  let yPosition = 15;

  // Título do documento
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(documentTitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Nome da igreja
  doc.setFontSize(12);
  doc.text(churchInfo.church_name, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 7;

  // Endereço e CNPJ
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  const fullAddress = [
    churchInfo.address,
    churchInfo.city,
    churchInfo.state,
    churchInfo.postal_code
  ].filter(Boolean).join(', ');
  
  if (fullAddress) {
    doc.text(fullAddress, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
  }

  if (churchInfo.cnpj) {
    doc.text(`CNPJ: ${churchInfo.cnpj}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
  }

  // Período
  if (period) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Período: ${period}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
  }

  // Data e hora de emissão
  doc.setFont('helvetica', 'normal');
  const now = new Date();
  const emissionDate = `Emitido em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`;
  doc.text(emissionDate, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 5;

  // Número da página
  if (pageNumber !== undefined) {
    doc.text(`Página: ${pageNumber}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
  }

  // Linha separadora
  doc.setLineWidth(0.5);
  doc.line(10, yPosition + 2, pageWidth - 10, yPosition + 2);

  return yPosition + 7;
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('pt-BR');
};

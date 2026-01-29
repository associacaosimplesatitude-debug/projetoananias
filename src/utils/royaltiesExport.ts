import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExportOptions {
  tipoRelatorio: "vendas" | "comissoes" | "pagamentos";
  dataInicio: string;
  dataFim: string;
  dados: any[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const getTituloRelatorio = (tipo: string) => {
  switch (tipo) {
    case "vendas":
      return "Relatório de Vendas";
    case "comissoes":
      return "Relatório de Comissões";
    case "pagamentos":
      return "Relatório de Pagamentos";
    default:
      return "Relatório";
  }
};

export const exportToPDF = ({ tipoRelatorio, dataInicio, dataFim, dados }: ExportOptions) => {
  const doc = new jsPDF();
  const titulo = getTituloRelatorio(tipoRelatorio);
  const periodoFormatado = `${format(new Date(dataInicio), "dd/MM/yyyy")} a ${format(new Date(dataFim), "dd/MM/yyyy")}`;

  // Header
  doc.setFontSize(18);
  doc.text(titulo, 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Período: ${periodoFormatado}`, 14, 28);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 34);

  // Table data
  let tableData: any[] = [];
  let tableHeaders: string[] = [];

  if (tipoRelatorio === "pagamentos") {
    tableHeaders = ["Autor", "Data Prevista", "Data Efetivação", "Valor", "Status"];
    tableData = dados.map((item) => [
      item.royalties_autores?.nome_completo || "-",
      format(new Date(item.data_prevista), "dd/MM/yyyy"),
      item.data_efetivacao ? format(new Date(item.data_efetivacao), "dd/MM/yyyy") : "-",
      formatCurrency(item.valor_total),
      item.status === "pago" ? "Pago" : item.status === "cancelado" ? "Cancelado" : "Pendente",
    ]);
  } else {
    tableHeaders = tipoRelatorio === "comissoes" 
      ? ["Data", "Livro", "Autor", "Qtd", "Comissão", "Status"]
      : ["Data", "Livro", "Autor", "Qtd", "Comissão"];
    
    tableData = dados.map((item) => {
      const row = [
        format(new Date(item.data_venda), "dd/MM/yyyy"),
        item.royalties_livros?.titulo || "-",
        item.royalties_livros?.royalties_autores?.nome_completo || "-",
        item.quantidade.toString(),
        formatCurrency(item.valor_comissao_total),
      ];
      
      if (tipoRelatorio === "comissoes") {
        row.push(item.pagamento_id ? "Pago" : "Pendente");
      }
      
      return row;
    });
  }

  // Add table
  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: 42,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  // Summary
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(0);

  if (tipoRelatorio === "pagamentos") {
    const totalPago = dados.filter(p => p.status === "pago").reduce((acc, p) => acc + Number(p.valor_total || 0), 0);
    const totalPendente = dados.filter(p => p.status === "pendente").reduce((acc, p) => acc + Number(p.valor_total || 0), 0);
    
    doc.text(`Total Pago: ${formatCurrency(totalPago)}`, 14, finalY);
    doc.text(`Total Pendente: ${formatCurrency(totalPendente)}`, 14, finalY + 6);
  } else {
    const totalQtd = dados.reduce((acc, v) => acc + (v.quantidade || 0), 0);
    const totalComissao = dados.reduce((acc, v) => acc + Number(v.valor_comissao_total || 0), 0);
    
    doc.text(`Total de Unidades: ${totalQtd}`, 14, finalY);
    doc.text(`Total de Comissões: ${formatCurrency(totalComissao)}`, 14, finalY + 6);
  }

  // Save
  const fileName = `royalties-${tipoRelatorio}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
};

export const exportToExcel = ({ tipoRelatorio, dataInicio, dataFim, dados }: ExportOptions) => {
  let worksheetData: any[] = [];

  if (tipoRelatorio === "pagamentos") {
    worksheetData = dados.map((item) => ({
      "Autor": item.royalties_autores?.nome_completo || "-",
      "Data Prevista": format(new Date(item.data_prevista), "dd/MM/yyyy"),
      "Data Efetivação": item.data_efetivacao ? format(new Date(item.data_efetivacao), "dd/MM/yyyy") : "-",
      "Valor": Number(item.valor_total || 0),
      "Status": item.status === "pago" ? "Pago" : item.status === "cancelado" ? "Cancelado" : "Pendente",
    }));
  } else {
    worksheetData = dados.map((item) => {
      const row: any = {
        "Data": format(new Date(item.data_venda), "dd/MM/yyyy"),
        "Livro": item.royalties_livros?.titulo || "-",
        "Autor": item.royalties_livros?.royalties_autores?.nome_completo || "-",
        "Quantidade": item.quantidade,
        "Comissão": Number(item.valor_comissao_total || 0),
      };
      
      if (tipoRelatorio === "comissoes") {
        row["Status"] = item.pagamento_id ? "Pago" : "Pendente";
      }
      
      return row;
    });
  }

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(worksheetData);

  // Add summary row
  const summaryRowIndex = worksheetData.length + 2;
  
  if (tipoRelatorio === "pagamentos") {
    const totalPago = dados.filter(p => p.status === "pago").reduce((acc, p) => acc + Number(p.valor_total || 0), 0);
    const totalPendente = dados.filter(p => p.status === "pendente").reduce((acc, p) => acc + Number(p.valor_total || 0), 0);
    
    XLSX.utils.sheet_add_aoa(ws, [
      [],
      ["Total Pago:", totalPago],
      ["Total Pendente:", totalPendente],
    ], { origin: `A${summaryRowIndex}` });
  } else {
    const totalQtd = dados.reduce((acc, v) => acc + (v.quantidade || 0), 0);
    const totalComissao = dados.reduce((acc, v) => acc + Number(v.valor_comissao_total || 0), 0);
    
    XLSX.utils.sheet_add_aoa(ws, [
      [],
      ["Total Unidades:", totalQtd],
      ["Total Comissões:", totalComissao],
    ], { origin: `A${summaryRowIndex}` });
  }

  // Set column widths
  ws["!cols"] = [
    { wch: 25 },
    { wch: 30 },
    { wch: 25 },
    { wch: 12 },
    { wch: 15 },
    { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, getTituloRelatorio(tipoRelatorio));

  // Save
  const fileName = `royalties-${tipoRelatorio}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

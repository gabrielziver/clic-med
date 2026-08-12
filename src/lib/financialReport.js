import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function localDate(value) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function localDateTime(value) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const sessionLabels = {
  presente: "Atendido",
  faltou_assinou: "Falta com reembolso",
  nao_compareceu: "Nao compareceu",
  reagendado: "Reagendado",
};

export function buildFinancialReport({ appointments, patients, professional, periodLabel }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const navy = [23, 32, 51];
  const blue = [37, 99, 235];
  const muted = [95, 112, 140];
  const line = [221, 230, 239];
  const billable = appointments.filter((item) => item.payment_status !== "Cancelado");
  const received = billable.filter((item) => item.payment_status === "Pago").reduce((sum, item) => sum + Number(item.amount), 0);
  const pending = billable.filter((item) => item.payment_status === "Pendente").reduce((sum, item) => sum + Number(item.amount), 0);
  const cancelled = appointments.filter((item) => item.payment_status === "Cancelado").length;
  const absences = appointments.filter((item) => item.status === "faltou_assinou" || item.status === "nao_compareceu").length;
  const reportCode = `CM-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(appointments.length).padStart(3, "0")}`;

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Clic", 14, 17);
  doc.setTextColor(...blue);
  doc.text("Med", 22.5, 17);
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(22);
  doc.text("Demonstrativo financeiro", 14, 30);
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text(periodLabel, 14, 37);
  doc.setFont("helvetica", "bold");
  doc.text("DOCUMENTO", pageWidth - 14, 16, { align: "right" });
  doc.setTextColor(...navy);
  doc.text(reportCode, pageWidth - 14, 23, { align: "right" });
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.6);
  doc.line(14, 44, pageWidth - 14, 44);

  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text("PROFISSIONAL", 14, 53);
  doc.text("PERIODO", 111, 53);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text(professional.name || "Profissional", 14, 61);
  doc.text(periodLabel, 111, 61);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(professional.email || "", 14, 68);

  const metrics = [
    ["ATENDIMENTOS", String(appointments.length)],
    ["FALTAS", String(absences)],
    ["CANCELAMENTOS", String(cancelled)],
    ["VALOR BRUTO", money.format(received + pending)],
  ];
  const metricWidth = (pageWidth - 28) / metrics.length;
  doc.setDrawColor(...line);
  doc.line(14, 76, pageWidth - 14, 76);
  metrics.forEach(([label, value], index) => {
    const x = 14 + metricWidth * index;
    if (index) doc.line(x, 81, x, 99);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(label, x + 4, 85);
    doc.setFontSize(index === 3 ? 13 : 15);
    doc.setTextColor(...(index === 3 ? [5, 125, 105] : navy));
    doc.text(value, x + 4, 95);
  });
  doc.line(14, 104, pageWidth - 14, 104);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(...navy);
  doc.text("Resumo financeiro", 14, 116);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...line);
  doc.roundedRect(14, 122, pageWidth - 28, 35, 2, 2, "FD");
  const summary = [
    ["Recebido", money.format(received)],
    ["Pendente", money.format(pending)],
    ["Total cobrável", money.format(received + pending)],
  ];
  summary.forEach(([label, value], index) => {
    const x = 22 + index * 57;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(label, x, 134);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(index === 2 ? 15 : 11);
    doc.setTextColor(...(index === 2 ? [5, 125, 105] : navy));
    doc.text(value, x, 146);
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(...navy);
  doc.text("Lancamentos", 14, 170);

  const rows = appointments.map((appointment) => {
    const patient = patients.find((item) => item.id === appointment.patient_id);
    return [
      localDateTime(appointment.starts_at),
      patient?.full_name || "Paciente",
      appointment.procedure || "-",
      patient?.insurance || "-",
      sessionLabels[appointment.status] || appointment.status,
      appointment.payment_status,
      money.format(Number(appointment.amount)),
    ];
  });

  autoTable(doc, {
    startY: 176,
    head: [["Data", "Paciente", "Procedimento", "Convenio", "Status", "Pagamento", "Valor"]],
    body: rows.length ? rows : [["-", "Nenhum lancamento no periodo", "-", "-", "-", "-", money.format(0)]],
    theme: "plain",
    margin: { left: 14, right: 14, bottom: 18 },
    styles: { font: "helvetica", fontSize: 7.2, textColor: navy, cellPadding: 2.4, lineColor: line, lineWidth: { bottom: 0.15 } },
    rowPageBreak: "avoid",
    headStyles: { fillColor: [248, 250, 252], textColor: muted, fontStyle: "bold", fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 28 },
      2: { cellWidth: 39 },
      3: { cellWidth: 22 },
      4: { cellWidth: 25 },
      5: { cellWidth: 22 },
      6: { cellWidth: 22, halign: "right", fontStyle: "bold" },
    },
  });

  const pages = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const y = doc.internal.pageSize.getHeight() - 8;
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(`Gerado em ${localDate(new Date())}`, 14, y);
    doc.text(`${reportCode} | pagina ${page} de ${pages}`, pageWidth - 14, y, { align: "right" });
  }
  return doc;
}

export function generateFinancialReport(options) {
  const doc = buildFinancialReport(options);
  const { fileLabel } = options;
  doc.save(`clic-med-relatorio-${fileLabel}.pdf`);
}

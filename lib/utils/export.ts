import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import type { PayrollResult } from "@/types";
import { formatRupiah } from "@/lib/utils";

/**
 * Export Payroll Results to Excel (.xlsx) file
 */
export async function exportPayrollToExcel(
  results: PayrollResult[],
  periodStart: string,
  periodEnd: string
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Laporan Payroll");

  // Title Row
  worksheet.mergeCells("A1:G1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `AnnoTracker — Laporan Payroll Periode ${periodStart} s/d ${periodEnd}`;
  titleCell.font = { name: "Arial", size: 14, bold: true };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.addRow([]);

  // Table Headers
  const headerRow = worksheet.addRow([
    "No",
    "Nama Karyawan",
    "Total Jam Kerja",
    "Tier Rate",
    "Gaji Pokok",
    "Bonus Mingguan",
    "Total Gaji (Payout)",
    "Status Bayar",
  ]);

  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0D9488 font: white" }, // Teal background
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Table Data
  results.forEach((item, index) => {
    const row = worksheet.addRow([
      index + 1,
      item.user.full_name,
      `${item.total_hours} jam`,
      item.applied_tier ? formatRupiah(item.applied_tier.rate_per_hour) + "/jam" : "-",
      item.base_pay,
      item.bonus_pay,
      item.total_pay,
      item.payment_status === "paid" ? "Dibayar" : "Belum Dibayar",
    ]);

    // Format currency columns
    row.getCell(5).numFmt = '"Rp"#,##0';
    row.getCell(6).numFmt = '"Rp"#,##0';
    row.getCell(7).numFmt = '"Rp"#,##0';
  });

  // Auto-fit column widths
  worksheet.columns.forEach((column) => {
    column.width = 18;
  });

  // Generate buffer and download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AnnoTracker_Payroll_${periodStart}_sd_${periodEnd}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export Payroll Results to PDF (.pdf) file
 */
export function exportPayrollToPDF(
  results: PayrollResult[],
  periodStart: string,
  periodEnd: string
) {
  const doc = new jsPDF();

  // Document Title
  doc.setFontSize(16);
  doc.text("AnnoTracker — Laporan Payroll Tim Anotasi", 14, 20);

  doc.setFontSize(10);
  doc.text(`Periode: ${periodStart} s/d ${periodEnd}`, 14, 28);
  doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`, 14, 34);

  let yPos = 46;

  // Header Table
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Nama Karyawan", 14, yPos);
  doc.text("Total Jam", 70, yPos);
  doc.text("Gaji Pokok", 100, yPos);
  doc.text("Bonus", 135, yPos);
  doc.text("Total Payout", 165, yPos);

  doc.line(14, yPos + 2, 195, yPos + 2);
  yPos += 10;

  // Data Rows
  doc.setFont("helvetica", "normal");
  results.forEach((item) => {
    doc.text(item.user.full_name, 14, yPos);
    doc.text(`${item.total_hours} jam`, 70, yPos);
    doc.text(formatRupiah(item.base_pay), 100, yPos);
    doc.text(formatRupiah(item.bonus_pay), 135, yPos);
    doc.text(formatRupiah(item.total_pay), 165, yPos);

    yPos += 8;
  });

  // Footer Total
  doc.line(14, yPos, 195, yPos);
  yPos += 8;

  const totalPeriodPay = results.reduce((acc, curr) => acc + curr.total_pay, 0);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL KESELURUHAN PAYROLL:", 14, yPos);
  doc.text(formatRupiah(totalPeriodPay), 165, yPos);

  // Save PDF
  doc.save(`AnnoTracker_Payroll_${periodStart}_sd_${periodEnd}.pdf`);
}

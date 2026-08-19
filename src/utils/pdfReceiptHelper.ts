import jsPDF from 'jspdf';
import { CustomerAccount } from '../types';

export interface PDFReceiptOptions {
  receiptNo?: string;
  generatedBy?: string;
  previousPhone?: string;
  previousEmail?: string;
  notes?: string;
}

/**
 * Generate and download an official Profile Summary Receipt in PDF format.
 */
export function generateProfileSummaryPDF(
  account: CustomerAccount,
  options: PDFReceiptOptions = {}
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const receiptNo =
    options.receiptNo ||
    `REC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(
      new Date().getDate()
    ).padStart(2, '0')}-${account.noAkaun.replace(/[^a-zA-Z0-9]/g, '')}`;

  const printTimestamp = new Date().toLocaleString('ms-MY', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // 1. Header Dark Banner
  doc.setFillColor(26, 26, 26); // #1A1A1A
  doc.rect(0, 0, pageWidth, 32, 'F');

  // Header Gold/Emerald Accent Line
  doc.setFillColor(16, 185, 129); // #10B981 emerald
  doc.rect(0, 32, pageWidth, 2.5, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('eKemaskini: SLIP RESIT RASMI PROFIL PELANGGAN', margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text('PORTAL eKemaskini - PENGURUSAN DATA & PROFIL PELANGGAN', margin, 21);
  doc.text('Pengesahan Penyelarasan Data Maklumat Perhubungan', margin, 26);

  // Status Badge in Header
  doc.setFillColor(5, 150, 105); // #059669
  doc.roundedRect(pageWidth - margin - 42, 10, 42, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('STATUS: DIKEMASKINI', pageWidth - margin - 39, 17.5);

  let y = 44;

  // 2. Receipt Meta Box (No Resit, Tarikh, Masa)
  doc.setFillColor(250, 249, 246); // #FAF9F6
  doc.setDrawColor(215, 215, 210);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text('NO. RUJUKAN RESIT:', margin + 4, y + 6);
  doc.text('TARIKH CETAKAN:', margin + (contentWidth / 2) + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(20, 20, 20);
  doc.text(receiptNo, margin + 4, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(printTimestamp, margin + (contentWidth / 2) + 4, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Kemaskini Terakhir: ${account.lastUpdated} | Dikemaskini Oleh: ${account.kemaskiniOleh || options.generatedBy || 'Pelanggan'}`,
    margin + 4,
    y + 18
  );

  y += 28;

  // 3. Section: Maklumat Rasmi Pelanggan (Read-Only)
  doc.setFillColor(245, 245, 242);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text('1. MAKLUMAT RASMI PEMILIK AKAUN (TERKUNCI / READ-ONLY)', margin + 3, y + 5);

  y += 10;

  const drawRow = (label: string, value: string, currentY: number, isLocked = false) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    doc.text(label, margin + 3, currentY);

    doc.setFont('helvetica', isLocked ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    
    // Split text if it's long (e.g. Address)
    const splitValue = doc.splitTextToSize(value || '-', contentWidth - 65);
    doc.text(splitValue, margin + 65, currentY);

    if (isLocked) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(140, 140, 140);
      doc.text('[Terkunci]', pageWidth - margin - 16, currentY);
    }

    const rowHeight = Math.max(7, splitValue.length * 4.5 + 2);
    doc.setDrawColor(230, 230, 225);
    doc.setLineWidth(0.2);
    doc.line(margin, currentY + rowHeight - 2.5, pageWidth - margin, currentY + rowHeight - 2.5);

    return currentY + rowHeight;
  };

  y = drawRow('Nombor Akaun:', account.noAkaun, y, true);
  y = drawRow('Nama Penuh Pemilik:', account.nama, y, true);
  y = drawRow('No. Kad Pengenalan (IC):', account.kadPengenalan || 'Tiada Rekod', y, true);
  y = drawRow('Kategori Akaun:', account.kategoriAkaun || 'Kediaman', y, true);
  y = drawRow('Status Akaun:', account.status || 'Aktif', y, true);

  y += 4;

  // 4. Section: Maklumat Perhubungan Terkini (Updated Fields Highlighted)
  doc.setFillColor(236, 253, 245); // Emerald-50
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, contentWidth, 7, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(6, 78, 59); // Emerald-900
  doc.text('2. MAKLUMAT PERHUBUNGAN TERKINI (DISAHKAN & DIKEMASKINI)', margin + 3, y + 5);

  y += 10;

  // Highlight Box for updated phone & email
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(167, 243, 208);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(6, 78, 59);
  doc.text('NO. TELEFON / HANDPHONE TERKINI:', margin + 5, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(account.noTel || 'Belum Ditetapkan', margin + 5, y + 15);

  if (options.previousPhone && options.previousPhone !== account.noTel) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`(Terdahulu: ${options.previousPhone})`, margin + 65, y + 15);
  }

  doc.setDrawColor(220, 252, 231);
  doc.line(margin + 5, y + 18, pageWidth - margin - 5, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(6, 78, 59);
  doc.text('ALAMAT EMEL PEMILIK/WAKIL TERKINI:', margin + 5, y + 23);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(17, 24, 39);
  doc.text(account.email || 'Belum Ditetapkan', margin + 5, y + 29);

  if (options.previousEmail && options.previousEmail !== account.email) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`(Terdahulu: ${options.previousEmail})`, margin + 75, y + 29);
  }

  y += 38;

  // 4b. Section: Penghargaan & Baucar Hadiah (1x Sahaja)
  const isRewardEligibleOrClaimed = account.rewardStatus === 'Layak (Belum Dituntut)' || account.rewardStatus === 'Telah Dituntut' || account.telahDikemaskini;
  if (isRewardEligibleOrClaimed) {
    doc.setFillColor(254, 243, 199); // Amber-100
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(146, 64, 14); // Amber-900
    doc.text('3. PROGRAM PENGHARGAAN KEMASKINI PROFIL (1X PENEBUSAN SAHAJA)', margin + 4, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    const rewardCodeStr = account.rewardCode || `GIFT-${account.noAkaun}`;
    doc.text(`KOD BAUCAR HADIAH: ${rewardCodeStr}`, margin + 4, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 53, 15);
    const statusText = account.rewardStatus === 'Telah Dituntut' ? 'STATUS: TELAH DISERAHKAN / DITUNTUT' : 'STATUS: LAYAK DITUNTUT (KALI PERTAMA)';
    doc.text(`${statusText} | Hadiah diberikan sekali sahaja untuk setiap pelanggan yang berjaya mengemaskini profil.`, margin + 4, y + 17);

    y += 26;
  }

  // 5. Verification & Digital Seal Box
  doc.setFillColor(250, 249, 246);
  doc.setDrawColor(220, 220, 215);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text('PERAKUAN & PENGESAHAN DIGITAL:', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  const disclaimer =
    'Maklumat perhubungan di atas telah berjaya dikemaskini dalam pangkalan data rasmi. Dokumen ini adalah cetakan komputer yang sah sebagai bukti transaksi kemaskini profil tanpa memerlukan tandatangan fizikal.';
  const splitDisclaimer = doc.splitTextToSize(disclaimer, contentWidth - 45);
  doc.text(splitDisclaimer, margin + 4, y + 11);

  // Digital Stamp Box
  doc.setDrawColor(5, 150, 105);
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(pageWidth - margin - 38, y + 4, 34, 16, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(5, 150, 105);
  doc.text('DISAHKAN DIGITAL', pageWidth - margin - 36, y + 9);
  doc.setFontSize(6.5);
  doc.setTextColor(30, 30, 30);
  doc.text('SISTEM PANGKALAN DATA', pageWidth - margin - 36, y + 13);
  doc.text('INTEGRITI TERJAMIN', pageWidth - margin - 36, y + 17);

  // 6. Page Footer
  const footerY = pageHeight - 12;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Resit Ringkasan Profil Pelanggan | Dokumen Rasmi Simpanan Pelanggan',
    margin,
    footerY
  );
  doc.text(
    `Mukasurat 1 / 1`,
    pageWidth - margin - 20,
    footerY
  );

  // Save the PDF file
  const fileName = `Resit_Kemaskini_Profil_${account.noAkaun.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(fileName);
}

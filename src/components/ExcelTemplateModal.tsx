import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Copy, 
  Check, 
  X, 
  HelpCircle, 
  UploadCloud, 
  CheckCircle2, 
  FileText,
  Table,
  Info,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { downloadExcelTemplate, STANDARD_TEMPLATE_SAMPLE_DATA } from '../utils/excelHelper';
import { useToast } from '../context/ToastContext';

interface ExcelTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportFile?: (file: File) => void;
}

const TEMPLATE_COLUMNS_INFO = [
  {
    name: 'No Akaun',
    required: true,
    desc: 'Pengenalan unik bagi setiap akaun (cth: ACC-100234, 161100234123). Digunakan sebagai kunci carian portal & nyahduplikasi.',
    example: 'ACC-100234',
  },
  {
    name: 'Nama Pemilik',
    required: true,
    desc: 'Nama penuh pemilik akaun atau nama syarikat berdaftar.',
    example: 'Ahmad bin Abdullah',
  },
  {
    name: 'No Kad Pengenalan',
    required: false,
    desc: 'No. KP 12 digit (dengan atau tanpa tanda sempang).',
    example: '880112-14-5543',
  },
  {
    name: 'No Handphone',
    required: false,
    desc: 'Nombor telefon terkini untuk kemas kini data & notifikasi SMS/WhatsApp.',
    example: '012-3456789',
  },
  {
    name: 'Emel Pemilik/Wakil',
    required: false,
    desc: 'Alamat emel rasmi untuk penghantaran resit PDF & bil digital.',
    example: 'ahmad.abdullah@email.com',
  },
  {
    name: 'Kategori Akaun',
    required: false,
    desc: 'Kategori seperti Kediaman, Komersial, Perniagaan, atau Industri.',
    example: 'Kediaman',
  },
  {
    name: 'Status',
    required: false,
    desc: 'Status akaun terkini seperti Aktif, Tertunggak, atau Tidak Aktif.',
    example: 'Aktif',
  },
];

export const ExcelTemplateModal: React.FC<ExcelTemplateModalProps> = ({
  isOpen,
  onClose,
  onImportFile,
}) => {
  const { showSuccess, showInfo } = useToast();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'columns'>('preview');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownload = (format: 'xlsx' | 'csv') => {
    downloadExcelTemplate(format);
    showSuccess(
      'Templat Dimuat Turun',
      `Templat data pelanggan (.${format}) berjaya dimuat turun ke peranti anda.`
    );
  };

  const handleCopyHeaders = () => {
    const headers = TEMPLATE_COLUMNS_INFO.map((c) => c.name).join('\t');
    navigator.clipboard.writeText(headers);
    setCopied(true);
    showSuccess('Header Disalin', 'Susunan lajur templat telah disalin ke papan keratan (clipboard).');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportFile) {
      onImportFile(file);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <div 
          className="fixed inset-0" 
          onClick={onClose} 
          aria-hidden="true" 
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          className="relative bg-white border border-stone-300 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden z-10 my-6 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="bg-[#FAF9F6] border-b border-stone-200 p-5 flex items-start justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-2xs shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                    Format Piawai (.xlsx / .csv)
                  </span>
                  <span className="text-xs text-stone-500 font-serif hidden sm:inline">
                    Mudah, Tepat & Sedia Digunakan
                  </span>
                </div>
                <h3 className="text-lg font-bold text-stone-900 font-serif-heading mt-0.5">
                  Templat Import Data Excel Pelanggan
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action Banner */}
          <div className="bg-emerald-900 text-white p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <Download className="w-5 h-5 text-emerald-300 shrink-0" />
              <div className="text-xs">
                <p className="font-semibold font-serif text-white">
                  Muat turun fail templat sedia ada untuk mula mengisi data:
                </p>
                <p className="text-emerald-200 text-[11px]">
                  Dilengkapi dengan contoh data sebenar & format lajur yang telah diselaraskan.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleDownload('xlsx')}
                className="px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-950 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Muat Turun .XLSX</span>
              </button>

              <button
                onClick={() => handleDownload('csv')}
                className="px-3 py-2 bg-emerald-800/80 hover:bg-emerald-800 text-emerald-100 hover:text-white rounded-xl text-xs font-semibold border border-emerald-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Muat Turun .CSV</span>
              </button>

              <button
                onClick={handleCopyHeaders}
                className="px-3 py-2 bg-emerald-800/80 hover:bg-emerald-800 text-emerald-100 hover:text-white rounded-xl text-xs font-semibold border border-emerald-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Salin lajur untuk dipaparkan di Google Sheets / Excel"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">{copied ? 'Disalin' : 'Salin Header'}</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-stone-200 bg-[#FAF9F6] px-6 flex items-center gap-4 text-xs shrink-0">
            <button
              onClick={() => setActiveTab('preview')}
              className={`py-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'preview'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>Pratonton Kandungan Templat</span>
            </button>
            <button
              onClick={() => setActiveTab('columns')}
              className={`py-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'columns'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Panduan Struktur & Peraturan Lajur</span>
            </button>
          </div>

          {/* Body Content (Scrollable) */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
            {activeTab === 'preview' ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl flex items-start gap-2.5 text-xs text-stone-700 font-serif">
                  <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                  <div>
                    Jadual di bawah menunjukkan contoh baris data yang disertakan di dalam fail templat <strong>Templat_Data_Pelanggan_eKemaskini.xlsx</strong>. Anda boleh memadam contoh ini dan menggantikannya dengan rekod akaun pelanggan anda yang sebenar.
                  </div>
                </div>

                {/* Table Sample */}
                <div className="border border-stone-300 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#1A1A1A] text-white font-serif-heading">
                          <th className="py-2.5 px-3 font-bold">No Akaun <span className="text-red-400">*</span></th>
                          <th className="py-2.5 px-3 font-bold">Nama Pemilik <span className="text-red-400">*</span></th>
                          <th className="py-2.5 px-3 font-bold">No Kad Pengenalan</th>
                          <th className="py-2.5 px-3 font-bold">No Handphone</th>
                          <th className="py-2.5 px-3 font-bold">Emel Pemilik/Wakil</th>
                          <th className="py-2.5 px-3 font-bold">Kategori Akaun</th>
                          <th className="py-2.5 px-3 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 bg-white font-mono text-[11px]">
                        {STANDARD_TEMPLATE_SAMPLE_DATA.map((row, idx) => (
                          <tr key={`sample_row_${idx}`} className="hover:bg-stone-50 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-stone-900 whitespace-nowrap bg-stone-50/70">
                              {row['No Akaun']}
                            </td>
                            <td className="py-2.5 px-3 font-sans font-semibold text-stone-900 whitespace-nowrap">
                              {row['Nama Pemilik']}
                            </td>
                            <td className="py-2.5 px-3 text-stone-600 whitespace-nowrap">
                              {row['No Kad Pengenalan']}
                            </td>
                            <td className="py-2.5 px-3 text-emerald-700 font-semibold whitespace-nowrap">
                              {row['No Handphone']}
                            </td>
                            <td className="py-2.5 px-3 text-emerald-700 whitespace-nowrap">
                              {row['Emel Pemilik/Wakil']}
                            </td>
                            <td className="py-2.5 px-3 text-stone-600 whitespace-nowrap font-sans">
                              {row['Kategori Akaun']}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-sans font-medium">
                                {row['Status']}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-stone-500 font-serif pt-1">
                  <span>* Ruangan bertanda merah adalah lajur wajib bagi membolehkan padanan akaun tepat.</span>
                  <span>Disokong: Microsoft Excel, WPS Office, LibreOffice & Google Sheets</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {TEMPLATE_COLUMNS_INFO.map((col, idx) => (
                    <div key={`col_info_${idx}`} className="p-3.5 bg-[#FAF9F6] border border-stone-200 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-stone-900 flex items-center gap-1.5">
                          <span>{col.name}</span>
                          {col.required && (
                            <span className="text-[10px] bg-red-100 text-red-800 border border-red-200 px-1.5 py-0.2 rounded font-sans font-semibold">
                              Wajib
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] font-mono text-stone-500 bg-white border border-stone-200 px-2 py-0.5 rounded">
                          Cth: {col.example}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 font-serif leading-relaxed">
                        {col.desc}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-950 font-serif">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Pengecaman Fleksibel:</strong> Sistem menyokong pelbagai variasi nama lajur secara pintar (contohnya: <em>"No Akaun" / "Account No" / "No Telefon" / "Phone Number" / "Hp" / "Email" / "Emel"</em>).
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="bg-[#FAF9F6] border-t border-stone-200 p-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            {onImportFile ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <UploadCloud className="w-4 h-4 text-stone-600" />
                  <span>Ada Fail Sudah Siap? Muat Naik Terus</span>
                </button>
              </div>
            ) : <div />}

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => handleDownload('xlsx')}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1A1A1A] hover:bg-black rounded-xl transition-colors flex items-center gap-2 shadow-2xs cursor-pointer border border-stone-800"
              >
                <Download className="w-4 h-4" />
                <span>Muat Turun Templat (.xlsx)</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  Eye, 
  CheckCircle2, 
  Clock, 
  X, 
  User, 
  Gift, 
  Layers, 
  RotateCcw,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { BigQueryRedemptionRecord } from '../../types/bigQueryTypes';
import { fetchBigQueryRedemptionsApi } from '../../services/bigQueryApiClient';

interface GiftRedemptionHistoryViewProps {
  localRedemptions?: BigQueryRedemptionRecord[];
}

export const GiftRedemptionHistoryView: React.FC<GiftRedemptionHistoryViewProps> = ({
  localRedemptions = []
}) => {
  const [redemptions, setRedemptions] = useState<BigQueryRedemptionRecord[]>(localRedemptions);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedRecord, setSelectedRecord] = useState<BigQueryRedemptionRecord | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch real-time redemptions from BigQuery API on mount
  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const records = await fetchBigQueryRedemptionsApi();
      if (records && records.length > 0) {
        setRedemptions(records);
      }
    } catch (e) {
      console.warn('BigQuery history fallback:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Filtered List
  const filteredRecords = useMemo(() => {
    return redemptions.filter(r => {
      const matchSearch = 
        r.nama_pelanggan.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.no_akaun.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.nama_hadiah.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.transaction_id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus = filterStatus === 'ALL' || r.status === filterStatus;

      return matchSearch && matchStatus;
    });
  }, [redemptions, searchTerm, filterStatus]);

  // Paginated records
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage]);

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredRecords.length === 0) return;
    const headers = ['ID Transaksi', 'Tarikh', 'No Akaun', 'Nama Pelanggan', 'Hadiah', 'Kuantiti', 'Status', 'Pegawai', 'Catatan'];
    const rows = filteredRecords.map(r => [
      `"${r.transaction_id}"`,
      `"${r.created_at}"`,
      `"${r.no_akaun}"`,
      `"${r.nama_pelanggan}"`,
      `"${r.nama_hadiah}"`,
      r.kuantiti,
      `"${r.status}"`,
      `"${r.operator || '-'}"`,
      `"${r.catatan || '-'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sejarah_penebusan_hadiah_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* 🔍 Top Bar: Search, Filters & Export */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari transaksi mengikut Nama, No Akaun, atau ID..."
              className="w-full pl-9.5 pr-4 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Status */}
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="BERJAYA">🟢 Berjaya</option>
            <option value="BATAL">🔴 Batal</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={loadHistory}
            disabled={isLoading}
            className="p-2 text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-300 rounded-xl cursor-pointer"
            title="Muat Semula Rekod Ledger"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Export CSV Button */}
        <button
          onClick={handleExportCsv}
          disabled={filteredRecords.length === 0}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-40"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Eksport CSV</span>
        </button>
      </div>

      {/* 📜 Ledger Table View */}
      <div className="bg-white border border-stone-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-stone-50/90 border-b border-stone-200 text-stone-600 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3.5 px-4 font-semibold">Tarikh & Masa</th>
                <th className="py-3.5 px-4 font-semibold">Pelanggan (Akaun)</th>
                <th className="py-3.5 px-4 font-semibold">Hadiah Ditebus</th>
                <th className="py-3.5 px-4 font-semibold text-center">Kuantiti</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold">Pegawai / Operator</th>
                <th className="py-3.5 px-4 font-semibold text-center">Butiran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400 text-xs">
                    <span className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin inline-block mr-2" />
                    Memuat rekod ledger sejarah penebusan...
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400 text-xs">
                    📜 Tiada sejarah penebusan dijumpai.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r) => {
                  return (
                    <tr key={r.transaction_id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-stone-500 font-mono text-[11px]">
                        {new Date(r.created_at).toLocaleString('ms-MY')}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-stone-900">{r.nama_pelanggan}</div>
                        <div className="text-[11px] text-stone-500 font-mono">No. Akaun: {r.no_akaun}</div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-stone-800">
                        {r.nama_hadiah}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-stone-900">
                        {r.kuantiti} unit
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          r.status === 'BERJAYA' 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {r.status === 'BERJAYA' ? '🟢 BERJAYA' : '🔴 BATAL'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-stone-600 text-xs">
                        {r.operator || 'Admin'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedRecord(r)}
                          className="p-1.5 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer transition-colors"
                          title="Lihat Butiran Penebusan"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-xs">
            <span className="text-stone-500">
              Menunjukkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredRecords.length)} daripada {filteredRecords.length} rekod
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-stone-300 bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-stone-800">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-stone-300 bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 🔍 Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-300 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-700" />
                <h3 className="font-serif-heading font-bold text-stone-900">Butiran Transaksi Penebusan</h3>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-xs sm:text-sm">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 font-mono text-xs">
                <span className="text-stone-500 block text-[10px]">ID Transaksi:</span>
                <strong className="text-stone-900">{selectedRecord.transaction_id}</strong>
              </div>

              <div className="space-y-2 text-stone-700">
                <div className="flex justify-between border-b border-stone-100 pb-2">
                  <span className="text-stone-500">Nama Pelanggan:</span>
                  <strong>{selectedRecord.nama_pelanggan}</strong>
                </div>
                <div className="flex justify-between border-b border-stone-100 pb-2">
                  <span className="text-stone-500">No. Akaun:</span>
                  <strong className="font-mono">{selectedRecord.no_akaun}</strong>
                </div>
                {selectedRecord.kad_pengenalan && (
                  <div className="flex justify-between border-b border-stone-100 pb-2">
                    <span className="text-stone-500">No. K/P:</span>
                    <strong className="font-mono">{selectedRecord.kad_pengenalan}</strong>
                  </div>
                )}
                <div className="flex justify-between border-b border-stone-100 pb-2">
                  <span className="text-stone-500">Hadiah:</span>
                  <strong>{selectedRecord.nama_hadiah}</strong>
                </div>
                <div className="flex justify-between border-b border-stone-100 pb-2">
                  <span className="text-stone-500">Kuantiti Ditebus:</span>
                  <strong className="text-emerald-700 font-mono">{selectedRecord.kuantiti} Unit</strong>
                </div>
                <div className="flex justify-between border-b border-stone-100 pb-2">
                  <span className="text-stone-500">Baki Stok Selepas:</span>
                  <strong className="font-mono">{selectedRecord.baki_selepas || '-'} Unit</strong>
                </div>
                <div className="flex justify-between border-b border-stone-100 pb-2">
                  <span className="text-stone-500">Status:</span>
                  <strong className="text-emerald-700">{selectedRecord.status}</strong>
                </div>
                <div className="flex justify-between border-b border-stone-100 pb-2">
                  <span className="text-stone-500">Pegawai:</span>
                  <strong>{selectedRecord.operator || 'Admin'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Tarikh:</span>
                  <span className="font-mono">{new Date(selectedRecord.created_at).toLocaleString('ms-MY')}</span>
                </div>
                {selectedRecord.catatan && (
                  <div className="pt-2 border-t border-stone-200">
                    <span className="text-stone-500 block text-[10px]">Catatan:</span>
                    <p className="text-stone-800 text-xs italic">{selectedRecord.catatan}</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-stone-200 flex justify-end">
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

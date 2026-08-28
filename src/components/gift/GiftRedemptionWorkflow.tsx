import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, 
  User, 
  Gift, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  ArrowRight, 
  Check, 
  X, 
  Printer, 
  RotateCcw,
  Sparkles,
  CreditCard,
  Phone,
  Layers,
  Flame,
  AlertCircle
} from 'lucide-react';
import { GiftItem, AccountData } from '../../types';
import { searchBigQueryCustomersApi, executeBigQueryGiftRedemptionApi } from '../../services/bigQueryApiClient';
import { useToast } from '../../context/ToastContext';

interface GiftRedemptionWorkflowProps {
  gifts: GiftItem[];
  operatorName: string;
  onRedemptionComplete: () => void;
  localAccounts?: AccountData[];
}

export const GiftRedemptionWorkflow: React.FC<GiftRedemptionWorkflowProps> = ({
  gifts,
  operatorName,
  onRedemptionComplete,
  localAccounts = []
}) => {
  const { showSuccess, showError, showWarning } = useToast();

  // Search & Selected Customer State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AccountData[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<AccountData | null>(null);

  // Selected Gift & Quantity State
  const [selectedGiftId, setSelectedGiftId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [redemptionNotes, setRedemptionNotes] = useState<string>('');

  // Confirmation Modal & Processing State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Completed Transaction Receipt State
  const [completedReceipt, setCompletedReceipt] = useState<{
    transactionId: string;
    noAkaun: string;
    namaPelanggan: string;
    namaHadiah: string;
    kuantiti: number;
    bakiSelepas: number;
    timestamp: string;
    operator: string;
  } | null>(null);

  // Debounced Customer Search (BigQuery + Local fallback)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Query server-side BigQuery
        const bqResults = await searchBigQueryCustomersApi(trimmed);
        if (bqResults && bqResults.length > 0) {
          setSearchResults(bqResults);
        } else {
          // Fallback to local accounts matching
          const lower = trimmed.toLowerCase();
          const matched = localAccounts.filter(acc => 
            acc.noAkaun.toLowerCase().includes(lower) ||
            acc.nama.toLowerCase().includes(lower) ||
            (acc.kadPengenalan && acc.kadPengenalan.includes(trimmed)) ||
            (acc.telefon && acc.telefon.includes(trimmed))
          ).slice(0, 15);
          setSearchResults(matched);
        }
      } catch (err) {
        // Fallback filter
        const lower = trimmed.toLowerCase();
        const matched = localAccounts.filter(acc => 
          acc.noAkaun.toLowerCase().includes(lower) ||
          acc.nama.toLowerCase().includes(lower) ||
          (acc.kadPengenalan && acc.kadPengenalan.includes(trimmed))
        ).slice(0, 15);
        setSearchResults(matched);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, localAccounts]);

  // Selected Gift Details
  const activeGift = useMemo(() => {
    return gifts.find(g => g.id === selectedGiftId) || null;
  }, [gifts, selectedGiftId]);

  // Stock calculation for selected gift
  const currentStock = useMemo(() => {
    if (!activeGift) return 0;
    const initial = Number(activeGift.kuantitiAsal) || Number(activeGift.kuantiti) || 0;
    return activeGift.bakiSemasa !== undefined ? Number(activeGift.bakiSemasa) : initial;
  }, [activeGift]);

  const stockAfterRedemption = Math.max(0, currentStock - quantity);
  const isStockInsufficient = activeGift ? quantity > currentStock : false;
  const isOutOfStock = currentStock <= 0;

  // Trigger Confirmation Modal with validation
  const handleOpenConfirm = () => {
    if (!selectedCustomer) {
      showWarning('Pilih Pelanggan', 'Sila cari dan pilih akaun pelanggan terlebih dahulu.');
      return;
    }
    if (!activeGift) {
      showWarning('Pilih Hadiah', 'Sila pilih jenis hadiah yang ingin ditebus.');
      return;
    }
    if (quantity <= 0) {
      showWarning('Kuantiti Tidak Sah', 'Kuantiti penebusan mestilah sekurang-kurangnya 1 unit.');
      return;
    }
    if (isStockInsufficient) {
      showError('Stok Tidak Mencukupi', `Baki semasa untuk ${activeGift.namaHadiah} hanya ${currentStock} unit.`);
      return;
    }

    setIsConfirmModalOpen(true);
  };

  // Execute Safe Redemption (Server-side Atomic BigQuery Mutation + Idempotency)
  const handleExecuteRedemption = async () => {
    if (!selectedCustomer || !activeGift || isSubmitting) return;

    setIsSubmitting(true);
    const uniqueTxId = `TX-GIFT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    try {
      const result = await executeBigQueryGiftRedemptionApi({
        no_akaun: selectedCustomer.noAkaun,
        nama_pelanggan: selectedCustomer.nama,
        kad_pengenalan: selectedCustomer.kadPengenalan || '',
        gift_id: activeGift.id,
        nama_hadiah: activeGift.namaHadiah,
        kuantiti: quantity,
        operator: operatorName || 'Admin eKemaskini',
        catatan: redemptionNotes.trim() || undefined,
        transaction_id: uniqueTxId,
      });

      if (result.success) {
        showSuccess(
          'Penebusan Hadiah Berjaya!',
          `${quantity} unit ${activeGift.namaHadiah} telah berjaya disahkan untuk ${selectedCustomer.nama}.`
        );

        setCompletedReceipt({
          transactionId: result.transaction_id || uniqueTxId,
          noAkaun: selectedCustomer.noAkaun,
          namaPelanggan: selectedCustomer.nama,
          namaHadiah: activeGift.namaHadiah,
          kuantiti: quantity,
          bakiSelepas: result.baki_selepas !== undefined ? result.baki_selepas : stockAfterRedemption,
          timestamp: new Date().toLocaleString('ms-MY'),
          operator: operatorName || 'Admin eKemaskini',
        });

        setIsConfirmModalOpen(false);
        onRedemptionComplete();
      } else {
        showError('Penebusan Gagal', result.message || 'Ralat semasa memproses transaksi penebusan.');
      }
    } catch (err: any) {
      showError('Ralat Transaksi', err.message || 'Gagal menyambung ke server BigQuery.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset Workflow for Next Customer
  const handleResetWorkflow = () => {
    setSelectedCustomer(null);
    setSelectedGiftId('');
    setQuantity(1);
    setSearchQuery('');
    setSearchResults([]);
    setRedemptionNotes('');
    setCompletedReceipt(null);
  };

  return (
    <div className="space-y-6">
      {/* 🧾 State 4: Resit / Slip Pengesahan Penebusan Selepas Berjaya */}
      {completedReceipt ? (
        <div className="bg-white border border-emerald-200 rounded-2xl p-6 sm:p-8 shadow-sm max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in-95">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-serif-heading font-bold text-stone-900">
              Penebusan Hadiah Berjaya Disahkan!
            </h3>
            <p className="text-xs text-stone-500 font-mono">
              ID Transaksi BigQuery: <strong className="text-stone-900">{completedReceipt.transactionId}</strong>
            </p>
          </div>

          {/* Slip Details Box */}
          <div className="p-5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-3.5 text-xs sm:text-sm">
            <div className="flex justify-between border-b border-stone-200 pb-2.5">
              <span className="text-stone-500">Nama Pelanggan:</span>
              <strong className="text-stone-900">{completedReceipt.namaPelanggan}</strong>
            </div>
            <div className="flex justify-between border-b border-stone-200 pb-2.5">
              <span className="text-stone-500">No. Akaun:</span>
              <strong className="text-stone-900 font-mono">{completedReceipt.noAkaun}</strong>
            </div>
            <div className="flex justify-between border-b border-stone-200 pb-2.5">
              <span className="text-stone-500">Item Hadiah:</span>
              <strong className="text-stone-900">{completedReceipt.namaHadiah}</strong>
            </div>
            <div className="flex justify-between border-b border-stone-200 pb-2.5">
              <span className="text-stone-500">Kuantiti Ditebus:</span>
              <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {completedReceipt.kuantiti} Unit
              </span>
            </div>
            <div className="flex justify-between border-b border-stone-200 pb-2.5">
              <span className="text-stone-500">Baki Stok Terkini di BigQuery:</span>
              <span className="font-mono font-bold text-stone-900">{completedReceipt.bakiSelepas} Unit</span>
            </div>
            <div className="flex justify-between text-stone-500 text-xs pt-1">
              <span>Tarikh & Masa: {completedReceipt.timestamp}</span>
              <span>Pegawai: {completedReceipt.operator}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={() => window.print()}
              className="w-full sm:flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Slip Penebusan</span>
            </button>
            <button
              onClick={handleResetWorkflow}
              className="w-full sm:flex-1 py-2.5 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Penebusan Pelanggan Seterusnya</span>
            </button>
          </div>
        </div>
      ) : (
        /* 🔄 2-Column Responsive Workflow Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kolum Kiri: Langkah 1 - Carian Pelanggan (5 Kolum) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-stone-100">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h3 className="font-serif-heading font-bold text-stone-900 text-sm">
                  Cari & Pilih Akaun Pelanggan
                </h3>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Taip No Akaun, Nama, atau No K/P..."
                  className="w-full pl-9.5 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                />
                {isSearching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded animate-pulse">
                    Mencari...
                  </span>
                )}
              </div>

              {/* Live Search Results Dropdown/List */}
              {!selectedCustomer && searchResults.length > 0 && (
                <div className="mt-3 border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-56 overflow-y-auto bg-stone-50/50">
                  {searchResults.map((acc) => (
                    <button
                      key={acc.noAkaun}
                      onClick={() => {
                        setSelectedCustomer(acc);
                        setSearchResults([]);
                        setSearchQuery('');
                      }}
                      className="w-full text-left p-3 hover:bg-amber-50/80 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-stone-900 text-xs truncate">{acc.nama}</div>
                        <div className="text-[11px] text-stone-500 font-mono">
                          Akaun: {acc.noAkaun} {acc.kadPengenalan && `• IC: ${acc.kadPengenalan}`}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold bg-stone-200 text-stone-800 px-2 py-0.5 rounded shrink-0">
                        Pilih
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Customer Card Box */}
              {selectedCustomer ? (
                <div className="mt-4 p-4 rounded-xl bg-amber-50/70 border border-amber-300/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded">
                      Pelanggan Dipilih
                    </span>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
                    >
                      Tukar
                    </button>
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">{selectedCustomer.nama}</h4>
                    <div className="text-xs text-stone-600 font-mono mt-0.5">
                      No. Akaun: <strong>{selectedCustomer.noAkaun}</strong>
                    </div>
                    {selectedCustomer.kadPengenalan && (
                      <div className="text-xs text-stone-600 font-mono">
                        No. K/P: {selectedCustomer.kadPengenalan}
                      </div>
                    )}
                    {selectedCustomer.telefon && (
                      <div className="text-xs text-stone-600 font-mono">
                        Telefon: {selectedCustomer.telefon}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-6 rounded-xl border border-dashed border-stone-300 text-center text-stone-400 text-xs">
                  <User className="w-8 h-8 mx-auto mb-1.5 text-stone-300" />
                  <span>Sila gunakan carian di atas untuk memilih akaun pelanggan.</span>
                </div>
              )}
            </div>
          </div>

          {/* Kolum Kanan: Langkah 2 & 3 - Pilih Hadiah, Kuantiti & Pengesahan (7 Kolum) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h3 className="font-serif-heading font-bold text-stone-900 text-sm">
                  Pilih Hadiah & Kuantiti Penebusan
                </h3>
              </div>

              {/* Senarai Pilihan Hadiah */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-stone-700">Pilih Hadiah Sedia Ada *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1">
                  {gifts.map((g) => {
                    const init = Number(g.kuantitiAsal) || Number(g.kuantiti) || 0;
                    const baki = g.bakiSemasa !== undefined ? Number(g.bakiSemasa) : init;
                    const isOut = baki === 0;
                    const isSelected = selectedGiftId === g.id;

                    return (
                      <button
                        key={g.id}
                        type="button"
                        disabled={isOut}
                        onClick={() => {
                          setSelectedGiftId(g.id);
                          if (quantity > baki) setQuantity(Math.max(1, baki));
                        }}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                          isOut 
                            ? 'opacity-40 bg-stone-100 border-stone-200 cursor-not-allowed' 
                            : isSelected 
                              ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 shadow-xs' 
                              : 'bg-stone-50/50 hover:bg-stone-100/80 border-stone-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-semibold text-stone-900 text-xs truncate">{g.namaHadiah}</span>
                          {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-stone-500">{g.kategori || 'Umum'}</span>
                          <span className={`font-mono font-bold ${isOut ? 'text-rose-600' : 'text-stone-800'}`}>
                            {isOut ? 'HABIS' : `${baki} unit`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Kuantiti & Live Calculation */}
              {activeGift && (
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-stone-700">Kuantiti Penebusan (Unit):</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-8 h-8 rounded-lg bg-white border border-stone-300 font-bold text-sm hover:bg-stone-100 flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={currentStock}
                        value={quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setQuantity(isNaN(val) ? 1 : val);
                        }}
                        className="w-16 text-center py-1.5 bg-white border border-stone-300 rounded-lg font-mono font-bold text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                        disabled={quantity >= currentStock}
                        className="w-8 h-8 rounded-lg bg-white border border-stone-300 font-bold text-sm hover:bg-stone-100 flex items-center justify-center cursor-pointer disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Warning / Stock preview */}
                  <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between text-xs">
                    <span className="text-stone-500">Baki stok selepas penebusan:</span>
                    <strong className={`font-mono ${isStockInsufficient ? 'text-rose-600' : 'text-stone-900'}`}>
                      {stockAfterRedemption} unit
                    </strong>
                  </div>

                  {isStockInsufficient && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Kuantiti melebihi baki stok semasa ({currentStock} unit).</span>
                    </div>
                  )}
                </div>
              )}

              {/* Catatan Pilihan */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Catatan Tambahan (Pilihan)</label>
                <input
                  type="text"
                  value={redemptionNotes}
                  onChange={(e) => setRedemptionNotes(e.target.value)}
                  placeholder="cth: Penebusan sempena Program Kesetiaan 2026"
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleOpenConfirm}
                disabled={!selectedCustomer || !activeGift || isOutOfStock || isStockInsufficient}
                className="w-full py-3 bg-stone-900 hover:bg-black text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Sahkan & Tolak Stok Inventori</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔒 Modal Pengesahan Penebusan (Anti-Double Submit Protection) */}
      {isConfirmModalOpen && selectedCustomer && activeGift && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-300 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-stone-200 bg-amber-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-800" />
                <h3 className="font-serif-heading font-bold text-stone-900">Pengesahan Penebusan Hadiah</h3>
              </div>
              <button
                disabled={isSubmitting}
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs sm:text-sm">
              <p className="text-stone-600">
                Sila pastikan maklumat di bawah adalah tepat. Stok hadiah akan ditolak secara automatik dan rekod kekal akan disimpan ke dalam ledger penebusan:
              </p>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">Pelanggan:</span>
                  <strong className="text-stone-900">{selectedCustomer.nama}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">No. Akaun:</span>
                  <strong className="text-stone-900 font-mono">{selectedCustomer.noAkaun}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Hadiah:</span>
                  <strong className="text-stone-900">{activeGift.namaHadiah}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Kuantiti:</span>
                  <strong className="text-emerald-700 font-mono">{quantity} Unit</strong>
                </div>
                <div className="flex justify-between pt-2 border-t border-stone-200">
                  <span className="text-stone-500">Baki Stok Selepas:</span>
                  <strong className="text-stone-900 font-mono">{stockAfterRedemption} Unit</strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleExecuteRedemption}
                  className="px-5 py-2.5 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Memproses Transaksi...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Sahkan Penebusan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

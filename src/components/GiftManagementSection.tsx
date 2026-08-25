import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gift, 
  Plus, 
  Trash2, 
  Sparkles, 
  PackageCheck, 
  Crown, 
  AlertCircle, 
  CheckCircle2, 
  Tag, 
  Layers, 
  Edit2, 
  Check, 
  X,
  FileSpreadsheet,
  HelpCircle
} from 'lucide-react';
import { GiftItem } from '../types';
import { useToast } from '../context/ToastContext';
import { 
  getStoredGifts, 
  saveGiftsLocally, 
  subscribeToGifts, 
  addNewGift, 
  removeGift, 
  updateGiftItem, 
  INITIAL_SAMPLE_GIFTS 
} from '../services/giftService';

// Quick suggestions for rapid entry
const QUICK_PRESETS = [
  'Payung Eksklusif eKemaskini',
  'Tumbler Stainless Steel (500ml)',
  'Baucar Tunai RM10',
  'Beg Kanvas Mesra Alam',
  'Kupon Petrol RM20',
  'Pen Drive 32GB Berjenama',
  'Kalendar & Diari Rasmi'
];

interface GiftManagementSectionProps {
  className?: string;
}

export const GiftManagementSection: React.FC<GiftManagementSectionProps> = ({ className = '' }) => {
  const { showSuccess, showWarning, showInfo } = useToast();

  // State for gifts list
  const [giftList, setGiftList] = useState<GiftItem[]>(() => getStoredGifts());

  // Dynamic Input Form States
  const [jenisHadiah, setJenisHadiah] = useState<string>('');
  const [kuantiti, setKuantiti] = useState<string>('50');
  const [catatan, setCatatan] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNama, setEditNama] = useState<string>('');
  const [editKuantiti, setEditKuantiti] = useState<string>('');

  // Subscribe to gifts updates
  useEffect(() => {
    const unsubscribe = subscribeToGifts((gifts) => {
      setGiftList(gifts);
    });
    return () => unsubscribe();
  }, []);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalItems = giftList.length;
    const totalQuantity = giftList.reduce((sum, item) => sum + (Number(item.kuantitiAsal) || Number(item.kuantiti) || 0), 0);
    const totalRemaining = giftList.reduce((sum, item) => {
      const initial = Number(item.kuantitiAsal) || Number(item.kuantiti) || 0;
      const baki = item.bakiSemasa !== undefined ? Number(item.bakiSemasa) : initial;
      return sum + baki;
    }, 0);
    const totalClaimed = giftList.reduce((sum, item) => {
      const initial = Number(item.kuantitiAsal) || Number(item.kuantiti) || 0;
      const baki = item.bakiSemasa !== undefined ? Number(item.bakiSemasa) : initial;
      const claimed = item.jumlahDitebus !== undefined ? Number(item.jumlahDitebus) : Math.max(0, initial - baki);
      return sum + claimed;
    }, 0);
    return { totalItems, totalQuantity, totalRemaining, totalClaimed };
  }, [giftList]);

  // Handle Add New Gift Row
  const handleAddGift = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedJenis = jenisHadiah.trim();
    const parsedQty = parseInt(kuantiti, 10);

    if (!trimmedJenis) {
      setFormError('Sila masukkan Jenis Hadiah.');
      return;
    }

    if (isNaN(parsedQty) || parsedQty <= 0) {
      setFormError('Sila masukkan bilangan/kuantiti yang sah (sekurang-kurangnya 1).');
      return;
    }

    setFormError(null);

    await addNewGift(trimmedJenis, parsedQty, catatan.trim() || undefined);
    showSuccess('Hadiah Ditambah', `"${trimmedJenis}" (${parsedQty} unit) berjaya ditambah ke dalam jadual.`);

    // Reset input form
    setJenisHadiah('');
    setKuantiti('50');
    setCatatan('');
  };

  // Handle Delete Single Gift Row
  const handleDeleteGift = async (id: string, nama: string) => {
    await removeGift(id);
    showInfo('Hadiah Dibuang', `Rekod "${nama}" telah dipadam daripada senarai.`);
  };

  // Handle Start Edit
  const handleStartEdit = (gift: GiftItem) => {
    setEditingId(gift.id);
    setEditNama(gift.namaHadiah);
    setEditKuantiti(String(gift.kuantitiAsal || gift.kuantiti));
  };

  // Handle Save Edit
  const handleSaveEdit = async (id: string) => {
    const trimmed = editNama.trim();
    const qty = parseInt(editKuantiti, 10);

    if (!trimmed || isNaN(qty) || qty < 0) {
      showWarning('Data Tidak Sah', 'Sila pastikan nama dan kuantiti hadiah sah.');
      return;
    }

    await updateGiftItem(id, {
      namaHadiah: trimmed,
      kuantiti: qty,
      kuantitiAsal: qty,
    });

    setEditingId(null);
    showSuccess('Dikemaskini', 'Maklumat hadiah berjaya disimpan.');
  };

  // Handle Reset to Default
  const handleResetToSample = () => {
    saveGiftsLocally(INITIAL_SAMPLE_GIFTS);
    showInfo('Tetapan Asal', 'Senarai hadiah telah ditetapkan semula ke contoh asal.');
  };

  // Handle Clear All
  const handleClearAll = () => {
    if (window.confirm('Adakah anda pasti ingin mengosongkan semua senarai hadiah?')) {
      saveGiftsLocally([]);
      showWarning('Senarai Dikosongkan', 'Semua rekod hadiah telah dipadam.');
    }
  };

  return (
    <section id="pengurusan-hadiah-section" className={`space-y-6 ${className}`}>
      
      {/* 👑 Section Header Banner */}
      <div className="bg-[#FAF9F6] border border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-purple-950 text-purple-100 text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded tracking-wider flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" />
                Super Admin
              </span>
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-600" />
                Inventori Penghargaan
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-serif-heading font-bold text-stone-950 tracking-tight flex items-center gap-2">
              <Gift className="w-6 h-6 text-purple-700" />
              <span>Pengurusan Hadiah</span>
            </h2>

            <p className="text-xs sm:text-sm text-stone-600 font-serif max-w-2xl leading-relaxed">
              Daftar, urus, dan selaraskan senarai jenis hadiah penghargaan pelanggan beserta bilangan/kuantiti stok secara dinamik.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="bg-white border border-stone-200 rounded-xl px-3.5 py-2 text-center shadow-2xs">
              <div className="text-[10px] font-mono text-stone-500 uppercase font-semibold">Jenis Hadiah</div>
              <div className="text-base sm:text-lg font-mono font-bold text-stone-900">{stats.totalItems}</div>
            </div>
            <div className="bg-stone-100 border border-stone-300 rounded-xl px-3.5 py-2 text-center shadow-2xs">
              <div className="text-[10px] font-mono text-stone-600 uppercase font-semibold">Jumlah Kuantiti Asal</div>
              <div className="text-base sm:text-lg font-mono font-bold text-stone-900">{stats.totalQuantity.toLocaleString()} Unit</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-3.5 py-2 text-center shadow-2xs">
              <div className="text-[10px] font-mono text-emerald-800 uppercase font-semibold flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Baki Hadiah Semasa
              </div>
              <div className="text-base sm:text-lg font-mono font-bold text-emerald-950">
                {stats.totalRemaining.toLocaleString()} Unit
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📝 Borang Input Dinamik Tambah Hadiah */}
      <div className="bg-[#FAF9F6] border border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-100 text-purple-900 rounded-lg">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif-heading font-bold text-stone-900 text-sm sm:text-base">
                Borang Input Dinamik Hadiah
              </h3>
              <p className="text-[11px] text-stone-500 font-serif">
                Masukkan maklumat hadiah di bawah dan klik butang Tambah (+) untuk memasukkan ke dalam jadual.
              </p>
            </div>
          </div>
        </div>

        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleAddGift} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
            
            {/* 1. Input: Jenis Hadiah (Text Input) */}
            <div className="md:col-span-6 space-y-1.5">
              <label htmlFor="input-jenis-hadiah" className="block text-xs font-semibold text-stone-800">
                Jenis Hadiah <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="input-jenis-hadiah"
                  type="text"
                  value={jenisHadiah}
                  onChange={(e) => {
                    setJenisHadiah(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="Contoh: Payung Eksklusif / Baucar Tunai RM10 / Tumbler"
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-purple-900/20 focus:border-purple-900 transition-all font-sans shadow-2xs"
                />
              </div>
            </div>

            {/* 2. Input: Bilangan / Kuantiti (Number Input) */}
            <div className="md:col-span-3 space-y-1.5">
              <label htmlFor="input-kuantiti-hadiah" className="block text-xs font-semibold text-stone-800">
                Bilangan / Kuantiti Asal <span className="text-red-500">*</span>
              </label>
              <input
                id="input-kuantiti-hadiah"
                type="number"
                min="1"
                step="1"
                value={kuantiti}
                onChange={(e) => {
                  setKuantiti(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="Kuantiti Asal"
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-purple-900/20 focus:border-purple-900 transition-all font-mono font-bold shadow-2xs"
              />
            </div>

            {/* 3. Butang Tambah (+) */}
            <div className="md:col-span-3">
              <button
                id="btn-tambah-hadiah"
                type="submit"
                className="w-full py-2.5 px-4 bg-purple-950 hover:bg-black text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all border border-purple-900 cursor-pointer group"
              >
                <Plus className="w-4 h-4 text-amber-400 transition-transform group-hover:rotate-90 duration-200" />
                <span>Tambah Hadiah (+)</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Tags for Swift Entry */}
          <div className="pt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-stone-500 font-mono flex items-center gap-1">
              <Tag className="w-3 h-3 text-stone-400" />
              <span>Cadangan Pantas:</span>
            </span>
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setJenisHadiah(preset)}
                className="text-[11px] px-2.5 py-0.5 bg-white hover:bg-stone-100 text-stone-700 hover:text-stone-900 border border-stone-300 rounded-lg transition-colors cursor-pointer"
              >
                + {preset}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* 📊 Senarai Jadual Hadiah Dinamik */}
      <div className="bg-[#FAF9F6] border border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif-heading font-bold text-stone-950 text-base">
                Senarai Jadual Hadiah
              </h3>
              <span className="bg-stone-900 text-white text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                {giftList.length} Rekod
              </span>
            </div>
            <p className="text-xs text-stone-500 font-serif mt-0.5">
              Jadual senarai hadiah aktif. Anda boleh menyunting kuantiti atau memadam baris secara terus jika tersilap masuk.
            </p>
          </div>

          {/* Reset & Utility Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToSample}
              className="text-xs text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 px-3 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer"
              title="Isi semula senarai dengan contoh lalai"
            >
              Muat Contoh
            </button>
            {giftList.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                title="Kosongkan semua baris jadual"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Kosongkan Semua</span>
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {giftList.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center mx-auto border border-purple-200">
              <Gift className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-serif-heading font-bold text-stone-800 text-sm">
                Tiada Hadiah Didaftarkan Lagi
              </h4>
              <p className="text-xs text-stone-500 max-w-md mx-auto font-serif">
                Sila gunakan borang input di atas untuk memasukkan jenis hadiah dan kuantiti ke dalam jadual ini.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetToSample}
              className="px-4 py-2 bg-purple-950 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Isi Contoh Hadiah Sekarang</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-300 bg-white shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF9F6] border-b border-stone-300 text-stone-700 font-serif-heading font-bold">
                  <th className="py-3 px-3.5 w-12 text-center text-stone-500 font-mono text-[11px]">#</th>
                  <th className="py-3 px-4">Jenis Hadiah</th>
                  <th className="py-3 px-4 text-center w-36">Bilangan / Kuantiti Asal</th>
                  <th className="py-3 px-4 text-center w-48">Baki Hadiah Semasa</th>
                  <th className="py-3 px-4 w-36 hidden md:table-cell">Tarikh Ditambah</th>
                  <th className="py-3 px-4 text-center w-28">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 font-sans">
                {giftList.map((gift, idx) => {
                  const isEditing = editingId === gift.id;
                  const initialQty = Number(gift.kuantitiAsal) || Number(gift.kuantiti) || 0;
                  const bakiQty = gift.bakiSemasa !== undefined ? Number(gift.bakiSemasa) : initialQty;
                  const claimed = gift.jumlahDitebus !== undefined ? Number(gift.jumlahDitebus) : Math.max(0, initialQty - bakiQty);
                  const isOutOfStock = bakiQty <= 0;
                  const isLow = bakiQty > 0 && bakiQty <= 10;

                  return (
                    <tr 
                      key={gift.id} 
                      className="hover:bg-[#FAF9F6]/80 transition-colors group"
                    >
                      {/* 1. Index # */}
                      <td className="py-3 px-3.5 text-center font-mono text-stone-400 font-semibold">
                        {idx + 1}
                      </td>

                      {/* 2. Jenis Hadiah */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editNama}
                            onChange={(e) => setEditNama(e.target.value)}
                            className="w-full px-2 py-1 border border-purple-400 rounded-lg text-xs font-semibold text-stone-900 focus:outline-hidden"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                              <Gift className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-stone-900 text-xs sm:text-sm">
                                {gift.namaHadiah}
                              </div>
                              {gift.catatan && (
                                <div className="text-[10px] text-stone-500 font-serif truncate max-w-xs">
                                  {gift.catatan}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 3. Bilangan / Kuantiti Asal (Kekal Asal) */}
                      <td className="py-3 px-4 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            value={editKuantiti}
                            onChange={(e) => setEditKuantiti(e.target.value)}
                            className="w-20 px-2 py-1 border border-purple-400 rounded-lg text-xs font-mono font-bold text-stone-900 text-center focus:outline-hidden mx-auto"
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 text-stone-800 border border-stone-300 font-mono font-bold text-xs">
                            <PackageCheck className="w-3 h-3 text-stone-600" />
                            <span>{initialQty.toLocaleString()}</span>
                            <span className="text-[10px] font-normal text-stone-500">unit</span>
                          </span>
                        )}
                      </td>

                      {/* 4. Baki Hadiah Semasa (Baki Tinggal) */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-mono font-bold text-xs border ${
                              isOutOfStock
                                ? 'bg-rose-100 text-rose-900 border-rose-300'
                                : isLow
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-emerald-100 text-emerald-950 border-emerald-300'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOutOfStock ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                            />
                            <span>{bakiQty.toLocaleString()}</span>
                            <span className="text-[10px] font-normal opacity-85">unit tinggal</span>
                          </span>

                          {claimed > 0 && (
                            <span className="text-[10px] text-stone-500 font-mono">
                              ({claimed} telah diserah)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Tarikh Ditambah */}
                      <td className="py-3 px-4 text-stone-500 font-mono text-[11px] hidden md:table-cell">
                        {gift.tarikhDitambah || '-'}
                      </td>

                      {/* 6. Butang Tindakan (Sunting & Padam/Buang) */}
                      <td className="py-3 px-4 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(gift.id)}
                              className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition-colors cursor-pointer"
                              title="Simpan perubahan"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg transition-colors cursor-pointer"
                              title="Batal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(gift)}
                              className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg transition-colors cursor-pointer"
                              title="Sunting rekod ini"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`btn-padam-hadiah-${gift.id}`}
                              type="button"
                              onClick={() => handleDeleteGift(gift.id, gift.namaHadiah)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 rounded-lg border border-red-200 transition-colors cursor-pointer"
                              title="Padam / Buang baris ini jika tersilap masuk"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info tip */}
        <div className="flex items-center gap-1.5 text-[11px] text-stone-500 font-serif pt-1">
          <HelpCircle className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <span>
            Setiap baris yang dimasukkan disimpan secara langsung di dalam pangkalan data sesi Super Admin.
          </span>
        </div>
      </div>
    </section>
  );
};

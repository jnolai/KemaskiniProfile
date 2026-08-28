import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  PackagePlus, 
  Trash2, 
  Check, 
  X, 
  AlertCircle, 
  Tag, 
  Layers, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertTriangle,
  RotateCcw,
  Sparkles,
  PackageCheck
} from 'lucide-react';
import { GiftItem } from '../../types';

interface GiftInventoryListViewProps {
  gifts: GiftItem[];
  onAddGift: (gift: { nama: string; kuantiti: number; stokMinimum: number; kategori: string; catatan: string }) => Promise<void>;
  onEditGift: (id: string, updates: { namaHadiah: string; kuantiti: number; stokMinimum: number; kategori?: string; status?: string }) => Promise<void>;
  onRestockGift: (id: string, addedQty: number, catatan: string) => Promise<void>;
  onDeleteGift: (id: string, nama: string) => Promise<void>;
  isOperating: boolean;
}

export const GiftInventoryListView: React.FC<GiftInventoryListViewProps> = ({
  gifts,
  onAddGift,
  onEditGift,
  onRestockGift,
  onDeleteGift,
  isOperating
}) => {
  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'stockAsc' | 'stockDesc'>('name');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<GiftItem | null>(null);
  const [restockGift, setRestockGift] = useState<GiftItem | null>(null);

  // Form states - Add Gift
  const [newNama, setNewNama] = useState('');
  const [newKategori, setNewKategori] = useState('Premium');
  const [newKuantiti, setNewKuantiti] = useState('50');
  const [newStokMin, setNewStokMin] = useState('10');
  const [newCatatan, setNewCatatan] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Form states - Edit Gift
  const [editNama, setEditNama] = useState('');
  const [editKategori, setEditKategori] = useState('');
  const [editKuantiti, setEditKuantiti] = useState('0');
  const [editStokMin, setEditStokMin] = useState('10');

  // Form states - Restock
  const [restockQty, setRestockQty] = useState('25');
  const [restockNote, setRestockNote] = useState('');

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    gifts.forEach(g => {
      if (g.kategori) set.add(g.kategori);
    });
    return Array.from(set);
  }, [gifts]);

  // Filtered & Sorted gifts
  const filteredGifts = useMemo(() => {
    return gifts.filter(g => {
      const matchSearch = g.namaHadiah.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.kategori && g.kategori.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchCat = selectedCategory === 'ALL' || g.kategori === selectedCategory;

      const init = Number(g.kuantitiAsal) || Number(g.kuantiti) || 0;
      const baki = g.bakiSemasa !== undefined ? Number(g.bakiSemasa) : init;
      const minStock = g.stokMinimum !== undefined ? g.stokMinimum : 10;

      let status = 'NORMAL';
      if (baki === 0) status = 'HABIS';
      else if (baki <= minStock) status = 'RENDAH';

      const matchStatus = selectedStatus === 'ALL' || selectedStatus === status;

      return matchSearch && matchCat && matchStatus;
    }).sort((a, b) => {
      const bakiA = a.bakiSemasa !== undefined ? Number(a.bakiSemasa) : (Number(a.kuantitiAsal) || Number(a.kuantiti) || 0);
      const bakiB = b.bakiSemasa !== undefined ? Number(b.bakiSemasa) : (Number(b.kuantitiAsal) || Number(b.kuantiti) || 0);

      if (sortBy === 'stockAsc') return bakiA - bakiB;
      if (sortBy === 'stockDesc') return bakiB - bakiA;
      return a.namaHadiah.localeCompare(b.namaHadiah);
    });
  }, [gifts, searchTerm, selectedCategory, selectedStatus, sortBy]);

  // Submit Add Gift
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNama.trim()) {
      setFormError('Nama hadiah wajib diisi.');
      return;
    }
    const qty = parseInt(newKuantiti, 10);
    const min = parseInt(newStokMin, 10);
    if (isNaN(qty) || qty < 0) {
      setFormError('Jumlah stok tidak boleh negatif.');
      return;
    }
    if (isNaN(min) || min < 0) {
      setFormError('Stok minimum tidak boleh negatif.');
      return;
    }

    setFormError(null);
    await onAddGift({
      nama: newNama.trim(),
      kuantiti: qty,
      stokMinimum: min,
      kategori: newKategori.trim(),
      catatan: newCatatan.trim(),
    });

    setIsAddModalOpen(false);
    setNewNama('');
    setNewKuantiti('50');
    setNewStokMin('10');
    setNewCatatan('');
  };

  // Submit Edit Gift
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGift) return;
    const qty = parseInt(editKuantiti, 10);
    const min = parseInt(editStokMin, 10);

    await onEditGift(editingGift.id, {
      namaHadiah: editNama.trim(),
      kuantiti: isNaN(qty) ? 0 : qty,
      stokMinimum: isNaN(min) ? 10 : min,
      kategori: editKategori.trim() || 'Umum',
    });

    setEditingGift(null);
  };

  // Submit Restock
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockGift) return;
    const qty = parseInt(restockQty, 10);
    if (isNaN(qty) || qty <= 0) return;

    await onRestockGift(restockGift.id, qty, restockNote.trim() || 'Penambahan stok inventori');
    setRestockGift(null);
    setRestockQty('25');
    setRestockNote('');
  };

  return (
    <div className="space-y-5">
      {/* 🔍 Top Bar: Search, Category Filter, Status Filter & Add Button */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari hadiah mengikut nama atau kategori..."
              className="w-full pl-9.5 pr-4 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
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

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">Semua Status Stok</option>
            <option value="NORMAL">🟢 Stok Normal</option>
            <option value="RENDAH">🟡 Stok Rendah</option>
            <option value="HABIS">🔴 Stok Habis</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="name">Susun: Nama (A-Z)</option>
            <option value="stockAsc">Susun: Stok Terendah</option>
            <option value="stockDesc">Susun: Stok Tertinggi</option>
          </select>
        </div>

        {/* ➕ Tambah Hadiah Button */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 bg-stone-900 hover:bg-black text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all shrink-0"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Tambah Hadiah</span>
        </button>
      </div>

      {/* 📦 Desktop Table View */}
      <div className="hidden md:block bg-white border border-stone-200/90 rounded-2xl shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-stone-50/90 border-b border-stone-200 text-stone-600 font-mono text-[11px] uppercase tracking-wider">
              <th className="py-3.5 px-4 font-semibold">Hadiah & Penerangan</th>
              <th className="py-3.5 px-4 font-semibold">Kategori</th>
              <th className="py-3.5 px-4 font-semibold text-right">Baki Stok</th>
              <th className="py-3.5 px-4 font-semibold text-right">Telah Ditebus</th>
              <th className="py-3.5 px-4 font-semibold text-center">Status Stok</th>
              <th className="py-3.5 px-4 font-semibold text-center">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredGifts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-stone-400 text-xs">
                  🎁 Tiada hadiah dijumpai sepadan dengan carian / penapis anda.
                </td>
              </tr>
            ) : (
              filteredGifts.map((gift) => {
                const initial = Number(gift.kuantitiAsal) || Number(gift.kuantiti) || 0;
                const baki = gift.bakiSemasa !== undefined ? Number(gift.bakiSemasa) : initial;
                const claimed = gift.jumlahDitebus !== undefined ? Number(gift.jumlahDitebus) : Math.max(0, initial - baki);
                const minThreshold = gift.stokMinimum !== undefined ? gift.stokMinimum : 10;

                const isOut = baki === 0;
                const isLow = baki > 0 && baki <= minThreshold;

                return (
                  <tr key={gift.id} className="hover:bg-stone-50/80 transition-colors">
                    {/* Nama Hadiah */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-stone-900">{gift.namaHadiah}</div>
                      {gift.catatan && (
                        <div className="text-[11px] text-stone-500 line-clamp-1">{gift.catatan}</div>
                      )}
                    </td>

                    {/* Kategori */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md border border-stone-200">
                        <Tag className="w-3 h-3 text-stone-500" />
                        {gift.kategori || 'Umum'}
                      </span>
                    </td>

                    {/* Baki Stok */}
                    <td className="py-3.5 px-4 text-right">
                      <span className={`font-mono font-bold text-sm ${
                        isOut ? 'text-rose-700 font-black' : isLow ? 'text-amber-800' : 'text-stone-900'
                      }`}>
                        {baki}
                      </span>
                      <span className="text-[10px] text-stone-400 block font-mono">Min: {minThreshold}</span>
                    </td>

                    {/* Telah Ditebus */}
                    <td className="py-3.5 px-4 text-right font-mono text-stone-600 font-medium">
                      {claimed} unit
                    </td>

                    {/* Status Stok */}
                    <td className="py-3.5 px-4 text-center">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <X className="w-3 h-3" /> HABIS
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <AlertTriangle className="w-3 h-3" /> RENDAH
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <Check className="w-3 h-3" /> NORMAL
                        </span>
                      )}
                    </td>

                    {/* Tindakan */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Butang Tambah Stok */}
                        <button
                          onClick={() => setRestockGift(gift)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                          title="Tambah Stok Inventori"
                        >
                          <PackagePlus className="w-3.5 h-3.5" />
                          <span>+ Stok</span>
                        </button>

                        {/* Butang Edit */}
                        <button
                          onClick={() => {
                            setEditingGift(gift);
                            setEditNama(gift.namaHadiah);
                            setEditKategori(gift.kategori || 'Umum');
                            setEditKuantiti(String(baki));
                            setEditStokMin(String(gift.stokMinimum || 10));
                          }}
                          className="p-1.5 text-stone-600 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                          title="Edit Butiran"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Butang Padam */}
                        <button
                          onClick={() => onDeleteGift(gift.id, gift.namaHadiah)}
                          className="p-1.5 text-rose-600 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                          title="Padam Hadiah"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 📱 Mobile Responsive Cards View */}
      <div className="md:hidden space-y-3">
        {filteredGifts.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-stone-400 text-xs">
            🎁 Tiada hadiah dijumpai.
          </div>
        ) : (
          filteredGifts.map((gift) => {
            const initial = Number(gift.kuantitiAsal) || Number(gift.kuantiti) || 0;
            const baki = gift.bakiSemasa !== undefined ? Number(gift.bakiSemasa) : initial;
            const claimed = gift.jumlahDitebus !== undefined ? Number(gift.jumlahDitebus) : Math.max(0, initial - baki);
            const minThreshold = gift.stokMinimum !== undefined ? gift.stokMinimum : 10;
            const isOut = baki === 0;
            const isLow = baki > 0 && baki <= minThreshold;

            return (
              <div key={gift.id} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">{gift.namaHadiah}</h4>
                    <span className="inline-block mt-1 text-[10px] font-medium bg-stone-100 text-stone-700 px-2 py-0.5 rounded border border-stone-200">
                      {gift.kategori || 'Umum'}
                    </span>
                  </div>
                  {isOut ? (
                    <span className="text-[10px] font-mono font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded uppercase">
                      HABIS
                    </span>
                  ) : isLow ? (
                    <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded uppercase">
                      RENDAH
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded uppercase">
                      NORMAL
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 bg-stone-50 p-2.5 rounded-xl text-xs font-mono">
                  <div>
                    <span className="text-stone-500 text-[10px] block">Baki Stok:</span>
                    <strong className={`text-sm ${isOut ? 'text-rose-700' : 'text-stone-900'}`}>{baki} unit</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 text-[10px] block">Telah Ditebus:</span>
                    <strong className="text-stone-900">{claimed} unit</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setRestockGift(gift)}
                    className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>+ Tambah Stok</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingGift(gift);
                      setEditNama(gift.namaHadiah);
                      setEditKategori(gift.kategori || 'Umum');
                      setEditKuantiti(String(baki));
                      setEditStokMin(String(gift.stokMinimum || 10));
                    }}
                    className="p-2 bg-stone-100 text-stone-700 rounded-xl"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteGift(gift.id, gift.namaHadiah)}
                    className="p-2 bg-rose-50 text-rose-700 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 📝 Modal: Tambah Hadiah Baharu */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-300 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-600" />
                <h3 className="font-serif-heading font-bold text-stone-900">Tambah Hadiah Baharu</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Nama Hadiah *</label>
                <input
                  type="text"
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  placeholder="cth: Payung Eksklusif eKemaskini"
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Kategori</label>
                  <input
                    type="text"
                    value={newKategori}
                    onChange={(e) => setNewKategori(e.target.value)}
                    placeholder="cth: Premium, Baucar, Alat Tulis"
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Stok Awal (Unit) *</label>
                  <input
                    type="number"
                    min="0"
                    value={newKuantiti}
                    onChange={(e) => setNewKuantiti(e.target.value)}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Paras Stok Minimum (Alert)</label>
                  <input
                    type="number"
                    min="0"
                    value={newStokMin}
                    onChange={(e) => setNewStokMin(e.target.value)}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Catatan / Keterangan</label>
                  <input
                    type="text"
                    value={newCatatan}
                    onChange={(e) => setNewCatatan(e.target.value)}
                    placeholder="Pilihan catatan"
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-stone-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isOperating}
                  className="px-5 py-2 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isOperating ? 'Menyimpan...' : 'Simpan Hadiah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ Modal: Edit Hadiah */}
      {editingGift && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-300 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <h3 className="font-serif-heading font-bold text-stone-900">Kemaskini Butiran Hadiah</h3>
              <button onClick={() => setEditingGift(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Nama Hadiah</label>
                <input
                  type="text"
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Kategori</label>
                  <input
                    type="text"
                    value={editKategori}
                    onChange={(e) => setEditKategori(e.target.value)}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Paras Min Alert</label>
                  <input
                    type="number"
                    min="0"
                    value={editStokMin}
                    onChange={(e) => setEditStokMin(e.target.value)}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-stone-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingGift(null)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isOperating}
                  className="px-5 py-2 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold"
                >
                  {isOperating ? 'Menyimpan...' : 'Kemaskini'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📦 Modal: Tambah Stok (Restock Audit) */}
      {restockGift && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-300 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 bg-blue-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-blue-700" />
                <h3 className="font-serif-heading font-bold text-stone-900">Tambah Stok Inventori</h3>
              </div>
              <button onClick={() => setRestockGift(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-[11px] text-stone-500 block">Item Sasaran:</span>
                <strong className="text-stone-900 text-sm font-semibold">{restockGift.namaHadiah}</strong>
                <div className="text-xs text-stone-600 mt-1 font-mono">
                  Baki Semasa: <strong>{restockGift.bakiSemasa !== undefined ? restockGift.bakiSemasa : (restockGift.kuantitiAsal || restockGift.kuantiti)} unit</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Kuantiti Tambahan (Unit) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Catatan / Rujukan Pembelian / Batch
                </label>
                <input
                  type="text"
                  value={restockNote}
                  onChange={(e) => setRestockNote(e.target.value)}
                  placeholder="cth: Penerimaan batch baharu daripada pembekal"
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 pt-4 border-t border-stone-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRestockGift(null)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isOperating}
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>{isOperating ? 'Menambah...' : 'Sahkan Tambah Stok'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

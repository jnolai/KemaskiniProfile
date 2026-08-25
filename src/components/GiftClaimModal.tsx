import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gift, 
  X, 
  Check, 
  Sparkles, 
  AlertCircle, 
  Package, 
  Info,
  Layers,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GiftItem } from '../types';
import { 
  getStoredGifts, 
  subscribeToGifts, 
  deductGiftStock, 
  saveGiftsLocally, 
  INITIAL_SAMPLE_GIFTS 
} from '../services/giftService';

export interface GiftRecipientInfo {
  noAkaun: string;
  nama: string;
  rewardCode?: string;
  kadPengenalan?: string;
  noTel?: string;
}

export interface GiftClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: GiftRecipientInfo | null;
  onConfirmClaim: (noAkaun: string, giftName: string, remainingStock: number) => Promise<void> | void;
}

export const GiftClaimModal: React.FC<GiftClaimModalProps> = ({
  isOpen,
  onClose,
  recipient,
  onConfirmClaim,
}) => {
  const [giftList, setGiftList] = useState<GiftItem[]>(() => getStoredGifts());
  const [selectedGiftId, setSelectedGiftId] = useState<string>('');
  const [customGiftName, setCustomGiftName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Subscribe to real-time gift inventory changes
  useEffect(() => {
    const unsubscribe = subscribeToGifts((gifts) => {
      setGiftList(gifts);
    });
    return () => unsubscribe();
  }, []);

  // When modal opens or recipient changes, select first available in-stock gift
  useEffect(() => {
    if (isOpen && recipient) {
      setErrorMsg(null);
      setIsSubmitting(false);
      if (giftList.length > 0) {
        const available = giftList.find((g) => {
          const baki = g.bakiSemasa !== undefined ? Number(g.bakiSemasa) : Number(g.kuantiti);
          return baki > 0;
        }) || giftList[0];
        setSelectedGiftId(available ? available.id : 'custom');
      } else {
        setSelectedGiftId('custom');
      }
      setCustomGiftName('');
    }
  }, [isOpen, recipient, giftList]);

  const currentSelectedGift = useMemo(() => {
    if (!selectedGiftId || selectedGiftId === 'custom') return null;
    return giftList.find((g) => g.id === selectedGiftId) || null;
  }, [selectedGiftId, giftList]);

  if (!isOpen || !recipient) return null;

  const handleConfirm = async () => {
    if (!recipient) return;
    setErrorMsg(null);

    let finalGiftName = '';
    let remainingStock = 0;

    if (selectedGiftId === 'custom') {
      const trimmed = customGiftName.trim();
      if (!trimmed) {
        setErrorMsg('Sila nyatakan nama hadiah khas atau pilih hadiah daripada senarai.');
        return;
      }
      finalGiftName = trimmed;
      remainingStock = 0;
    } else {
      const gift = giftList.find((g) => g.id === selectedGiftId);
      if (!gift) {
        setErrorMsg('Sila pilih satu jenis hadiah daripada senarai.');
        return;
      }
      finalGiftName = gift.namaHadiah;
      try {
        setIsSubmitting(true);
        // Deduct 1 unit from inventory in giftService
        const res = await deductGiftStock(gift.id, 1);
        remainingStock = res.remainingStock;
      } catch (err: any) {
        console.error('Failed to deduct gift stock:', err);
      }
    }

    try {
      setIsSubmitting(true);
      await onConfirmClaim(recipient.noAkaun, finalGiftName, remainingStock);
      onClose();
    } catch (err: any) {
      console.error('Error in onConfirmClaim:', err);
      setErrorMsg('Gagal memproses penyerahan hadiah. Sila cuba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
        {/* Background Overlay */}
        <div 
          className="fixed inset-0" 
          onClick={() => !isSubmitting && onClose()} 
          aria-hidden="true" 
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative bg-white border border-stone-300 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-950 via-stone-900 to-purple-900 text-white p-5 border-b border-purple-900 flex items-start justify-between shrink-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-amber-400 text-purple-950 text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-950" />
                  Penebusan Hadiah 1x
                </span>
              </div>
              <h3 className="text-lg font-bold font-serif-heading flex items-center gap-2 text-white">
                <Gift className="w-5 h-5 text-amber-400" />
                Pilih Jenis Hadiah Penghargaan
              </h3>
              <p className="text-xs text-purple-200">
                Pilih jenis hadiah yang diserahkan kepada pelanggan ini. 1 unit akan ditolak daripada inventori secara automatik.
              </p>
            </div>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="text-stone-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
            
            {/* Customer Info Card */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-1.5 shadow-2xs">
              <div className="text-[10px] font-mono uppercase text-stone-500 font-bold flex items-center justify-between">
                <span>Penerima Hadiah:</span>
                <span className="font-mono text-purple-950 font-bold">Status: Layak (1x)</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-stone-950 text-sm font-serif-heading truncate">
                    {recipient.nama}
                  </div>
                  <div className="font-mono text-xs text-stone-600 flex items-center gap-2 mt-0.5">
                    <span>No Akaun: <strong className="text-stone-900">{recipient.noAkaun}</strong></span>
                    {recipient.noTel && <span>• Tel: {recipient.noTel}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg shadow-2xs">
                    {recipient.rewardCode || `GIFT-${recipient.noAkaun}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message if any */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Gift Options List */}
            <div className="space-y-2">
              <label className="font-bold text-stone-900 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-purple-900" />
                  <span>Pilih Jenis Hadiah Daripada Pengurusan Hadiah:</span>
                </span>
                <span className="text-[10px] font-normal text-stone-500 font-mono">
                  {giftList.length} jenis didaftarkan
                </span>
              </label>

              {giftList.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 mx-auto" />
                  <p className="text-stone-700">Belum ada senarai hadiah dalam Pengurusan Hadiah.</p>
                  <button
                    type="button"
                    onClick={() => saveGiftsLocally(INITIAL_SAMPLE_GIFTS)}
                    className="px-3 py-1.5 bg-purple-950 hover:bg-black text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Muat Senarai Hadiah Contoh
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {giftList.map((gift) => {
                    const isSelected = selectedGiftId === gift.id;
                    const initialQty = Number(gift.kuantitiAsal) || Number(gift.kuantiti) || 0;
                    const bakiQty = gift.bakiSemasa !== undefined ? Number(gift.bakiSemasa) : initialQty;
                    const isOutOfStock = bakiQty <= 0;

                    return (
                      <div
                        key={gift.id}
                        onClick={() => {
                          setSelectedGiftId(gift.id);
                          setErrorMsg(null);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-purple-50/90 border-purple-950 ring-1 ring-purple-950 shadow-2xs'
                            : isOutOfStock
                            ? 'bg-stone-50 border-stone-200 opacity-65 hover:opacity-100'
                            : 'bg-white border-stone-200 hover:border-stone-400 hover:bg-stone-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'border-purple-950 bg-purple-950 text-white'
                                : 'border-stone-400 bg-white'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>

                          <div className="min-w-0">
                            <div className="font-bold text-stone-900 text-xs flex items-center gap-1.5 truncate">
                              <Gift className="w-3.5 h-3.5 text-purple-800 shrink-0" />
                              <span className="truncate">{gift.namaHadiah}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-stone-500 font-mono mt-0.5">
                              <span>Jumlah Asal: <strong>{initialQty} unit</strong></span>
                              {gift.catatan && (
                                <span className="font-serif truncate max-w-[140px]">• {gift.catatan}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`inline-block font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isOutOfStock
                                ? 'bg-rose-100 text-rose-900 border-rose-300'
                                : bakiQty <= 10
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            }`}
                          >
                            {isOutOfStock ? 'Habis Stok (0)' : `Baki Semasa: ${bakiQty} unit`}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Option for Custom Gift */}
                  <div
                    onClick={() => {
                      setSelectedGiftId('custom');
                      setErrorMsg(null);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      selectedGiftId === 'custom'
                        ? 'bg-purple-50/90 border-purple-950 ring-1 ring-purple-950 shadow-2xs'
                        : 'bg-white border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          selectedGiftId === 'custom'
                            ? 'border-purple-950 bg-purple-950 text-white'
                            : 'border-stone-400 bg-white'
                        }`}
                      >
                        {selectedGiftId === 'custom' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <span className="font-bold text-stone-900 text-xs">
                        Lain-lain / Hadiah Khas (Kemasukan Manual)
                      </span>
                    </div>

                    {selectedGiftId === 'custom' && (
                      <div className="pl-7 pt-1">
                        <input
                          type="text"
                          value={customGiftName}
                          onChange={(e) => {
                            setCustomGiftName(e.target.value);
                            setErrorMsg(null);
                          }}
                          placeholder="cth: Hadiah Hamper Khas, Baucar Tambahan..."
                          className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:outline-none focus:border-purple-950"
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Deduction Preview Banner */}
            {currentSelectedGift && (
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-purple-950 text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Ringkasan Penolakan Inventori:</span>
                </div>
                <div className="text-[11px] text-purple-900">
                  Penyerahan <strong>1 unit</strong> &quot;{currentSelectedGift.namaHadiah}&quot; kepada <strong>{recipient.nama}</strong>.
                </div>
                <div className="text-[10px] font-mono text-purple-800 pt-0.5">
                  Jumlah Asal: <strong>{currentSelectedGift.kuantitiAsal || currentSelectedGift.kuantiti} unit</strong> | Baki Semasa: <strong>{currentSelectedGift.bakiSemasa !== undefined ? currentSelectedGift.bakiSemasa : (currentSelectedGift.kuantitiAsal || currentSelectedGift.kuantiti)} unit</strong> → Baki Baharu: <strong className="text-emerald-700">{Math.max(0, (currentSelectedGift.bakiSemasa !== undefined ? currentSelectedGift.bakiSemasa : (currentSelectedGift.kuantitiAsal || currentSelectedGift.kuantiti)) - 1)} unit</strong>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="bg-stone-100 p-4 border-t border-stone-200 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-white hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold border border-stone-300 transition-colors cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || (!selectedGiftId || (selectedGiftId === 'custom' && !customGiftName.trim()))}
              className="px-5 py-2.5 bg-purple-950 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Sahkan & Tanda Hadiah Diberi'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

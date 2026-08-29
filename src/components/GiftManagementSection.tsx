import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Gift, 
  Crown, 
  Sparkles, 
  RefreshCw, 
  Database, 
  BarChart3, 
  Package, 
  CheckCircle2, 
  History, 
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Server
} from 'lucide-react';
import { GiftItem, AccountData } from '../types';
import { GiftDashboardMetrics, BigQueryRedemptionRecord } from '../types/bigQueryTypes';
import { useToast } from '../context/ToastContext';
import { 
  getStoredGifts, 
  subscribeToGifts, 
  addNewGift, 
  removeGift, 
  updateGiftItem, 
  fetchGiftsFromFirestore
} from '../services/giftService';
import { 
  fetchBigQueryGiftsApi, 
  createBigQueryGiftApi, 
  updateBigQueryGiftApi, 
  deleteBigQueryGiftApi,
  restockBigQueryGiftApi,
  fetchBigQueryGiftDashboardMetricsApi,
  fetchBigQueryRedemptionsApi 
} from '../services/bigQueryApiClient';

import { GiftDashboardView } from './gift/GiftDashboardView';
import { GiftInventoryListView } from './gift/GiftInventoryListView';
import { GiftRedemptionWorkflow } from './gift/GiftRedemptionWorkflow';
import { GiftRedemptionHistoryView } from './gift/GiftRedemptionHistoryView';

interface GiftManagementSectionProps {
  className?: string;
  onSyncCloud?: () => Promise<void> | void;
  operatorName?: string;
  accounts?: AccountData[];
}

export type GiftSubTab = 'dashboard' | 'inventory' | 'redeem' | 'history';

export const GiftManagementSection: React.FC<GiftManagementSectionProps> = ({ 
  className = '',
  onSyncCloud,
  operatorName = 'Super Admin',
  accounts = []
}) => {
  const { showSuccess, showWarning, showInfo, showError } = useToast();

  // Active Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState<GiftSubTab>('dashboard');

  // State for gifts list & metrics
  const [giftList, setGiftList] = useState<GiftItem[]>(() => getStoredGifts());
  const [metrics, setMetrics] = useState<GiftDashboardMetrics>({
    totalGiftTypes: 0,
    totalCurrentStock: 0,
    totalRedeemed: 0,
    criticalStockCount: 0,
    topRedeemedGifts: [],
    lowStockGifts: []
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOperating, setIsOperating] = useState<boolean>(false);
  const [isBigQueryOnline, setIsBigQueryOnline] = useState<boolean>(true);

  // Load live data from BigQuery API & Firestore
  const loadAllGiftData = useCallback(async () => {
    setIsSyncing(true);
    try {
      // 1. Fetch BigQuery metrics
      const bqMetrics = await fetchBigQueryGiftDashboardMetricsApi();
      if (bqMetrics) {
        setMetrics(bqMetrics);
        setIsBigQueryOnline(true);
      }

      // 2. Fetch BigQuery Gifts
      const bqGifts = await fetchBigQueryGiftsApi();
      if (bqGifts && bqGifts.length > 0) {
        const mapped: GiftItem[] = bqGifts.map(b => ({
          id: b.id,
          namaHadiah: b.nama_hadiah,
          kuantiti: b.stok_semasa,
          kuantitiAsal: b.stok_semasa + b.jumlah_ditebus,
          bakiSemasa: b.stok_semasa,
          jumlahDitebus: b.jumlah_ditebus,
          stokMinimum: b.stok_minimum,
          kategori: b.kategori,
          catatan: b.catatan,
          status: b.status as any,
          tarikhDitambah: b.created_at,
          tarikhKemaskini: b.updated_at
        }));
        setGiftList(mapped);
      } else {
        // Fallback to Firestore
        const cloudGifts = await fetchGiftsFromFirestore();
        if (cloudGifts && cloudGifts.length > 0) {
          setGiftList(cloudGifts);
        }
      }
    } catch (err) {
      console.warn('BigQuery load fallback to local/Firestore:', err);
      const cloudGifts = await fetchGiftsFromFirestore();
      if (cloudGifts && cloudGifts.length > 0) {
        setGiftList(cloudGifts);
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Initial mount subscription & sync
  useEffect(() => {
    loadAllGiftData();

    // Subscribe to Firestore changes as real-time backing
    const unsubscribe = subscribeToGifts((gifts) => {
      setGiftList(gifts);
    });

    const handleFocus = () => {
      loadAllGiftData();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadAllGiftData]);

  // Handler: Add New Gift (BigQuery + Firestore Dual Layer)
  const handleAddGift = async (data: { nama: string; kuantiti: number; stokMinimum: number; kategori: string; catatan: string }) => {
    setIsOperating(true);
    try {
      await addNewGift(
        data.nama, 
        data.kuantiti, 
        data.catatan, 
        data.kategori || 'Umum', 
        data.stokMinimum || 5, 
        operatorName
      );

      showSuccess('Hadiah Disimpan & Direkodkan', `"${data.nama}" (${data.kuantiti} unit) berjaya didaftarkan ke BigQuery dan diselaraskan ke semua peranti.`);
      await loadAllGiftData();
    } catch (err: any) {
      showError('Ralat Mendaftar Hadiah', err?.message || 'Gagal menyimpan hadiah ke BigQuery.');
    } finally {
      setIsOperating(false);
    }
  };

  // Handler: Edit Gift (BigQuery + Firestore + Local)
  const handleEditGift = async (id: string, updates: { namaHadiah: string; kuantiti: number; stokMinimum: number; kategori?: string; status?: string }) => {
    setIsOperating(true);
    try {
      await updateGiftItem(
        id, 
        {
          namaHadiah: updates.namaHadiah,
          kuantiti: updates.kuantiti,
          kuantitiAsal: updates.kuantiti,
          stokMinimum: updates.stokMinimum,
          kategori: updates.kategori,
          status: updates.status as any,
        },
        operatorName
      );

      showSuccess('Kemaskini Berjaya', `Maklumat hadiah telah dikemaskini dalam BigQuery & disegerakkan.`);
      await loadAllGiftData();
    } catch (err: any) {
      showError('Ralat Mengemaskini Hadiah', err?.message || 'Gagal mengemaskini maklumat hadiah.');
    } finally {
      setIsOperating(false);
    }
  };

  // Handler: Restock Gift (BigQuery + Firestore + Local)
  const handleRestockGift = async (id: string, addedQty: number, catatan: string) => {
    setIsOperating(true);
    try {
      await restockBigQueryGiftApi(id, addedQty, catatan, operatorName);
      
      // Update local & firestore as well
      const existing = giftList.find(g => g.id === id);
      if (existing) {
        const newTotal = (existing.kuantiti || 0) + addedQty;
        const newBaki = (existing.bakiSemasa !== undefined ? existing.bakiSemasa : existing.kuantiti) + addedQty;
        await updateGiftItem(id, { kuantiti: newTotal, kuantitiAsal: newTotal, bakiSemasa: newBaki }, operatorName);
      }

      showSuccess('Stok Ditambah & Direkodkan', `Sebanyak +${addedQty} unit telah ditambah ke dalam inventori BigQuery.`);
      await loadAllGiftData();
    } catch (err: any) {
      showWarning('Penambahan Stok Tempatan', 'Stok telah dikemaskini dalam pangkalan data.');
      await loadAllGiftData();
    } finally {
      setIsOperating(false);
    }
  };

  // Handler: Delete / Mansuhkan Gift (BigQuery + Firestore + Local)
  const handleDeleteGift = async (id: string, nama: string) => {
    if (!window.confirm(`Adakah anda pasti ingin memansuhkan hadiah "${nama}" daripada inventori BigQuery? Tindakan ini akan direkodkan.`)) return;

    setIsOperating(true);
    try {
      await removeGift(id, operatorName);
      showInfo('Hadiah Dimansuhkan', `Rekod "${nama}" telah dimansuhkan daripada BigQuery dan dipadam daripada semua peranti.`);
      await loadAllGiftData();
    } catch (err: any) {
      showError('Ralat Memansuhkan Hadiah', err?.message || 'Gagal memansuhkan hadiah daripada BigQuery.');
    } finally {
      setIsOperating(false);
    }
  };

  // Navigation Helper
  const handleNavigateSubTab = (tabKey: 'inventory' | 'redeem' | 'history') => {
    setActiveSubTab(tabKey);
  };

  return (
    <section id="pengurusan-hadiah-section" className={`space-y-6 ${className}`}>
      
      {/* 👑 Masthead Banner: Super Admin & Live Cloud Inventory Badge */}
      <div className="bg-[#FAF9F6] border border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-purple-950 text-purple-100 text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded tracking-wider flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" />
                Super Admin
              </span>
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-600" />
                Pusat Inventori & Penebusan
              </span>
              <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Pangkalan Data Awan: Aktif
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-serif-heading font-bold text-stone-950 tracking-tight flex items-center gap-2">
              <Gift className="w-6 h-6 text-purple-700" />
              <span>Pengurusan & Penebusan Hadiah</span>
            </h2>

            <p className="text-xs sm:text-sm text-stone-600 font-serif max-w-2xl leading-relaxed">
              Pusat kawalan inventori hadiah, pemantauan paras stok masa-nyata, dan kaunter penebusan pelanggan dengan transaksi selamat.
            </p>
          </div>

          {/* Cloud & Live Inventory Status */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadAllGiftData}
              disabled={isSyncing || isOperating}
              className="px-3.5 py-2 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-xl font-semibold text-xs shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Segerak data terkini daripada pangkalan data awan"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Menyegerak...' : 'Segerak Data'}</span>
            </button>
          </div>
        </div>

        {/* 🗂️ 4 Interactive Sub-Tabs Navigation */}
        <div className="mt-5 pt-3 border-t border-stone-200/90 flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-none">
          {/* Tab 1: Dashboard Hadiah */}
          <button
            onClick={() => setActiveSubTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeSubTab === 'dashboard'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/60'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>Dashboard Metrik</span>
          </button>

          {/* Tab 2: Senarai Hadiah (Inventori) */}
          <button
            onClick={() => setActiveSubTab('inventory')}
            className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeSubTab === 'inventory'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/60'
            }`}
          >
            <Package className="w-4 h-4 text-blue-400" />
            <span>Senarai Hadiah (Inventori)</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              activeSubTab === 'inventory' ? 'bg-stone-800 text-stone-200' : 'bg-stone-200 text-stone-700'
            }`}>
              {giftList.length}
            </span>
          </button>

          {/* Tab 3: Sistem Penebusan Hadiah */}
          <button
            onClick={() => setActiveSubTab('redeem')}
            className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeSubTab === 'redeem'
                ? 'bg-purple-950 text-white shadow-xs ring-2 ring-purple-900/20'
                : 'text-stone-600 hover:text-stone-950 hover:bg-purple-50/60'
            }`}
          >
            <Gift className="w-4 h-4 text-amber-400" />
            <span>Kaunter Penebusan Pelanggan</span>
            <span className="bg-amber-400 text-stone-950 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full">
              Pantas
            </span>
          </button>

          {/* Tab 4: Sejarah Penebusan (Ledger) */}
          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/60'
            }`}
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span>Sejarah & Audit Ledger</span>
          </button>
        </div>
      </div>

      {/* 🚀 Active Sub-Tab Views Rendering */}
      <div className="animate-in fade-in duration-150">
        {activeSubTab === 'dashboard' && (
          <GiftDashboardView
            metrics={metrics}
            gifts={giftList}
            onNavigateTab={handleNavigateSubTab}
            isLoading={isSyncing}
            onRefresh={loadAllGiftData}
          />
        )}

        {activeSubTab === 'inventory' && (
          <GiftInventoryListView
            gifts={giftList}
            onAddGift={handleAddGift}
            onEditGift={handleEditGift}
            onRestockGift={handleRestockGift}
            onDeleteGift={handleDeleteGift}
            isOperating={isOperating}
          />
        )}

        {activeSubTab === 'redeem' && (
          <GiftRedemptionWorkflow
            gifts={giftList}
            operatorName={operatorName}
            onRedemptionComplete={loadAllGiftData}
            localAccounts={accounts}
          />
        )}

        {activeSubTab === 'history' && (
          <GiftRedemptionHistoryView />
        )}
      </div>

    </section>
  );
};

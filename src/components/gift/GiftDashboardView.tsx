import React from 'react';
import { 
  Gift, 
  Package, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  ArrowUpRight, 
  Sparkles,
  ShieldCheck,
  Flame,
  ArrowRight,
  Database
} from 'lucide-react';
import { GiftDashboardMetrics } from '../../types/bigQueryTypes';
import { GiftItem } from '../../types';

interface GiftDashboardViewProps {
  metrics: GiftDashboardMetrics;
  gifts: GiftItem[];
  onNavigateTab: (tabKey: 'inventory' | 'redeem' | 'history') => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const GiftDashboardView: React.FC<GiftDashboardViewProps> = ({
  metrics,
  gifts,
  onNavigateTab,
  isLoading = false,
  onRefresh
}) => {
  // Aggregate real-time numbers combining BigQuery metrics & live gifts
  const totalGiftTypes = metrics.totalGiftTypes || gifts.length;
  const totalCurrentStock = gifts.reduce((sum, g) => {
    const init = Number(g.kuantitiAsal) || Number(g.kuantiti) || 0;
    const baki = g.bakiSemasa !== undefined ? Number(g.bakiSemasa) : init;
    return sum + baki;
  }, 0) || metrics.totalCurrentStock;

  const totalClaimed = gifts.reduce((sum, g) => {
    const init = Number(g.kuantitiAsal) || Number(g.kuantiti) || 0;
    const baki = g.bakiSemasa !== undefined ? Number(g.bakiSemasa) : init;
    const claimed = g.jumlahDitebus !== undefined ? Number(g.jumlahDitebus) : Math.max(0, init - baki);
    return sum + claimed;
  }, 0) || metrics.totalRedeemed;

  const criticalGifts = gifts.filter(g => {
    const init = Number(g.kuantitiAsal) || Number(g.kuantiti) || 0;
    const baki = g.bakiSemasa !== undefined ? Number(g.bakiSemasa) : init;
    const minThreshold = g.stokMinimum !== undefined ? g.stokMinimum : 10;
    return baki <= minThreshold;
  });

  const criticalCount = criticalGifts.length;

  return (
    <div className="space-y-6">
      {/* 📊 Top 4 Core Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Jumlah Jenis Hadiah */}
        <div className="bg-white border border-stone-200/90 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:border-stone-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-stone-500 uppercase tracking-wider">Jenis Hadiah</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-serif-heading font-bold text-stone-900">
              {isLoading ? '...' : totalGiftTypes}
            </span>
            <span className="text-xs text-stone-500 font-medium">SKU item</span>
          </div>
          <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
            <span className="text-stone-500">Katalog Aktif</span>
            <button
              onClick={() => onNavigateTab('inventory')}
              className="text-amber-800 hover:text-amber-950 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              Urus <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 2: Jumlah Stok Semasa */}
        <div className="bg-white border border-stone-200/90 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:border-stone-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-stone-500 uppercase tracking-wider">Jumlah Stok</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-800">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-serif-heading font-bold text-stone-900">
              {isLoading ? '...' : totalCurrentStock.toLocaleString()}
            </span>
            <span className="text-xs text-stone-500 font-medium">unit sedia ada</span>
          </div>
          <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
            <span className="text-emerald-700 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Baki Semasa
            </span>
            <button
              onClick={() => onNavigateTab('inventory')}
              className="text-blue-800 hover:text-blue-950 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              Tambah Stok <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 3: Jumlah Telah Ditebus */}
        <div className="bg-white border border-stone-200/90 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:border-stone-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-stone-500 uppercase tracking-wider">Telah Ditebus</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-serif-heading font-bold text-emerald-950">
              {isLoading ? '...' : totalClaimed.toLocaleString()}
            </span>
            <span className="text-xs text-stone-500 font-medium">unit diedar</span>
          </div>
          <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
            <span className="text-stone-500">Kadar Pengagihan</span>
            <button
              onClick={() => onNavigateTab('history')}
              className="text-emerald-800 hover:text-emerald-950 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              Log Penebusan <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 4: Stok Kritikal */}
        <div className={`border rounded-2xl p-4 sm:p-5 shadow-xs transition-all ${
          criticalCount > 0 
            ? 'bg-rose-50/60 border-rose-200 hover:border-rose-300' 
            : 'bg-white border-stone-200 hover:border-stone-300'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${
              criticalCount > 0 ? 'text-rose-800' : 'text-stone-500'
            }`}>
              Stok Kritikal
            </span>
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${
              criticalCount > 0 
                ? 'bg-rose-100 border-rose-300 text-rose-800' 
                : 'bg-stone-50 border-stone-200 text-stone-600'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-serif-heading font-bold ${
              criticalCount > 0 ? 'text-rose-950' : 'text-stone-900'
            }`}>
              {isLoading ? '...' : criticalCount}
            </span>
            <span className="text-xs text-stone-500 font-medium">item perlu restock</span>
          </div>
          <div className="mt-3 pt-3 border-t border-rose-200/60 flex items-center justify-between text-xs">
            <span className={criticalCount > 0 ? 'text-rose-700 font-medium' : 'text-stone-500'}>
              {criticalCount > 0 ? 'Perlu tindakan' : 'Stok mencukupi'}
            </span>
            {criticalCount > 0 && (
              <button
                onClick={() => onNavigateTab('inventory')}
                className="text-rose-900 hover:text-rose-950 font-bold flex items-center gap-0.5 cursor-pointer underline"
              >
                Semak
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 📈 Section 2: Popular Gifts Ranking & Critical Stock Alert Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Hadiah Paling Banyak Ditebus */}
        <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                <Flame className="w-4 h-4" />
              </div>
              <h3 className="font-serif-heading font-bold text-stone-900 text-sm">
                Hadiah Paling Popular (Paling Banyak Ditebus)
              </h3>
            </div>
            <span className="text-[10px] font-mono uppercase bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-bold border border-amber-200">
              Paling Popular
            </span>
          </div>

          <div className="space-y-3">
            {gifts.length === 0 ? (
              <div className="text-center py-6 text-stone-400 text-xs">
                Tiada data hadiah tersedia.
              </div>
            ) : (
              [...gifts]
                .sort((a, b) => {
                  const claimA = Number(a.jumlahDitebus || 0);
                  const claimB = Number(b.jumlahDitebus || 0);
                  return claimB - claimA;
                })
                .slice(0, 4)
                .map((item, idx) => {
                  const claimed = Number(item.jumlahDitebus || 0);
                  const initial = Number(item.kuantitiAsal) || Number(item.kuantiti) || 1;
                  const percent = Math.min(100, Math.round((claimed / initial) * 100));
                  const baki = item.bakiSemasa !== undefined ? Number(item.bakiSemasa) : (initial - claimed);

                  return (
                    <div key={item.id} className="p-3 rounded-xl bg-stone-50/80 border border-stone-200/70 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                            idx === 0 ? 'bg-amber-400 text-stone-950 font-black' : 'bg-stone-200 text-stone-700'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-stone-800 text-xs truncate">
                            {item.namaHadiah}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-stone-900 shrink-0">
                          {claimed} unit ditebus
                        </span>
                      </div>

                      <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-amber-500 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-stone-500">
                        <span>Baki stok: <strong className="text-stone-800">{baki} unit</strong></span>
                        <span>{percent}% telah diagihkan</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Hadiah Hampir Habis (Stok Rendah) */}
        <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center text-rose-800">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="font-serif-heading font-bold text-stone-900 text-sm">
                Hadiah Hampir Habis & Stok Rendah
              </h3>
            </div>
            <span className="text-[10px] font-mono uppercase bg-rose-50 text-rose-800 px-2 py-0.5 rounded font-bold border border-rose-200">
              Perlu Tambah Stok
            </span>
          </div>

          <div className="space-y-3">
            {criticalGifts.length === 0 ? (
              <div className="text-center py-8 rounded-xl bg-emerald-50/50 border border-emerald-200/60 p-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="font-semibold text-xs text-emerald-900">Semua Stok Dalam Keadaan Sihat</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">Tiada hadiah yang berada di bawah paras stok minimum.</p>
              </div>
            ) : (
              criticalGifts.slice(0, 4).map((item) => {
                const init = Number(item.kuantitiAsal) || Number(item.kuantiti) || 0;
                const baki = item.bakiSemasa !== undefined ? Number(item.bakiSemasa) : init;
                const isOut = baki === 0;

                return (
                  <div key={item.id} className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    isOut ? 'bg-rose-50/80 border-rose-300' : 'bg-amber-50/60 border-amber-200'
                  }`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                          isOut ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                        }`}>
                          {isOut ? 'HABIS' : 'RENDAH'}
                        </span>
                        <span className="font-semibold text-stone-900 text-xs truncate">
                          {item.namaHadiah}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500 mt-1">
                        Baki semasa: <strong className={isOut ? 'text-rose-700' : 'text-amber-800'}>{baki} unit</strong> (Min: {item.stokMinimum || 10} unit)
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigateTab('inventory')}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl text-xs font-semibold text-stone-800 shadow-2xs shrink-0 cursor-pointer"
                    >
                      Tambah Stok
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 🚀 Quick Action Workflow Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-serif-heading font-bold text-base text-amber-100">
              Aliran Penebusan Hadiah Pelanggan Masa-Nyata
            </h4>
            <p className="text-xs text-stone-300 mt-0.5">
              Cari akaun pelanggan, pilih hadiah dan tolak stok secara automatik dengan perlindungan transaksi selamat.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigateTab('redeem')}
          className="w-full md:w-auto px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0"
        >
          <Gift className="w-4 h-4" />
          <span>Buka Kaunter Penebusan</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

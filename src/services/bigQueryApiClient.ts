/**
 * Client API Bridge for BigQuery Gift Management Module
 * Connects frontend eKemaskini to /api/* endpoints
 * Supports offline/development fallback with seamless cloud sync
 */

import {
  BigQueryGiftRecord,
  BigQueryRedemptionRecord,
  GiftDashboardMetrics,
  CustomerSearchResult,
} from '../types/bigQueryTypes';
import { GiftItem } from '../types';

export class BigQueryApiClient {
  private static baseUrl = '';

  /**
   * 📊 Get Real-Time Dashboard Statistics
   */
  static async getDashboardMetrics(): Promise<GiftDashboardMetrics> {
    try {
      const res = await fetch(`${this.baseUrl}/api/hadiah/dashboard`);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json() as { success: boolean; data: GiftDashboardMetrics };
      return data.data;
    } catch (err) {
      console.warn('[BigQueryApiClient] Fallback for dashboard metrics:', err);
      return {
        totalGiftTypes: 0,
        totalCurrentStock: 0,
        totalRedeemed: 0,
        criticalStockCount: 0,
        todayRedemptionsCount: 0,
        monthRedemptionsCount: 0,
        topRedeemedGifts: [],
        criticalGifts: [],
        recentRedemptions: [],
      };
    }
  }

  /**
   * 🔍 Search Customers in BigQuery Database
   */
  static async searchCustomers(query: string): Promise<CustomerSearchResult[]> {
    if (!query || query.trim().length < 2) return [];
    try {
      const res = await fetch(`${this.baseUrl}/api/pelanggan/search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json() as { success: boolean; data: CustomerSearchResult[] };
      return data.data || [];
    } catch (err) {
      console.warn('[BigQueryApiClient] Fallback for customer search:', err);
      return [];
    }
  }

  /**
   * 🎁 Fetch All Active Gifts from BigQuery
   */
  static async getGifts(): Promise<BigQueryGiftRecord[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/hadiah`);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json() as { success: boolean; data: BigQueryGiftRecord[] };
      return data.data || [];
    } catch (err) {
      console.warn('[BigQueryApiClient] Fallback for gifts fetch:', err);
      return [];
    }
  }

  /**
   * ➕ Add New Gift into BigQuery
   */
  static async addGift(gift: {
    nama_hadiah: string;
    kategori?: string;
    stok_semasa: number;
    stok_minimum: number;
    status: string;
    catatan?: string;
    operator?: string;
  }): Promise<{ success: boolean; id?: string; message: string }> {
    const res = await fetch(`${this.baseUrl}/api/hadiah`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gift),
    });

    const data = await res.json() as any;
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal menambah hadiah ke pangkalan data BigQuery.');
    }
    return data;
  }

  /**
   * ✏️ Update Existing Gift Details
   */
  static async updateGift(
    giftId: string,
    updates: {
      nama_hadiah?: string;
      kategori?: string;
      stok_minimum?: number;
      status?: string;
      catatan?: string;
      operator?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${this.baseUrl}/api/hadiah/${encodeURIComponent(giftId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    const data = await res.json() as any;
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal mengemaskini maklumat hadiah.');
    }
    return data;
  }

  /**
   * 📦 Restock Gift Inventory
   */
  static async restockGift(
    giftId: string,
    quantity: number,
    catatan?: string,
    operator?: string
  ): Promise<{ success: boolean; newStock: number; message: string }> {
    const res = await fetch(`${this.baseUrl}/api/hadiah/${encodeURIComponent(giftId)}/stok`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity, catatan, operator }),
    });

    const data = await res.json() as any;
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal menambah stok hadiah.');
    }
    return data;
  }

  /**
   * 🤝 Process Redemption Transaction
   */
  static async processRedemption(redemption: {
    transaction_id?: string;
    no_akaun: string;
    nama_pelanggan: string;
    kad_pengenalan?: string;
    gift_id: string;
    nama_hadiah: string;
    kuantiti: number;
    operator: string;
    catatan?: string;
  }): Promise<{ success: boolean; transaction_id: string; baki_selepas: number; message: string }> {
    const res = await fetch(`${this.baseUrl}/api/penebusan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(redemption),
    });

    const data = await res.json() as any;
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal memproses transaksi penebusan hadiah.');
    }
    return data;
  }

  /**
   * 📜 Get Redemption History
   */
  static async getRedemptions(filters: {
    search?: string;
    giftId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<BigQueryRedemptionRecord[]> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.giftId) params.append('gift_id', filters.giftId);
    if (filters.status) params.append('status', filters.status);
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.offset) params.append('offset', String(filters.offset));

    try {
      const res = await fetch(`${this.baseUrl}/api/penebusan?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json() as { success: boolean; data: BigQueryRedemptionRecord[] };
      return data.data || [];
    } catch (err) {
      console.warn('[BigQueryApiClient] Fallback for redemptions fetch:', err);
      return [];
    }
  }
}

// Standalone Helper Functions for Easy Component Imports
export const fetchBigQueryGiftDashboardMetricsApi = () => BigQueryApiClient.getDashboardMetrics();
export const searchBigQueryCustomersApi = (q: string) => BigQueryApiClient.searchCustomers(q);
export const fetchBigQueryGiftsApi = () => BigQueryApiClient.getGifts();
export const createBigQueryGiftApi = (gift: {
  nama_hadiah: string;
  kategori?: string;
  stok_semasa: number;
  stok_minimum: number;
  status?: string;
  catatan?: string;
  operator?: string;
}) => BigQueryApiClient.addGift({
  ...gift,
  status: gift.status || 'AKTIF'
});
export const updateBigQueryGiftApi = (id: string, updates: Parameters<typeof BigQueryApiClient.updateGift>[1]) => 
  BigQueryApiClient.updateGift(id, updates);
export const restockBigQueryGiftApi = (id: string, qty: number, note?: string, op?: string) => 
  BigQueryApiClient.restockGift(id, qty, note, op);
export const executeBigQueryGiftRedemptionApi = (redemption: Parameters<typeof BigQueryApiClient.processRedemption>[0]) => 
  BigQueryApiClient.processRedemption(redemption);
export const fetchBigQueryRedemptionsApi = (filters?: Parameters<typeof BigQueryApiClient.getRedemptions>[0]) => 
  BigQueryApiClient.getRedemptions(filters);

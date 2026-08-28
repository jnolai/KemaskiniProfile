// Cloudflare Pages Functions / Express Backend Types for BigQuery Gift Management Module

export interface BigQueryGiftRecord {
  id: string;
  nama_hadiah: string;
  kategori?: string;
  stok_semasa: number;
  stok_minimum: number;
  jumlah_ditebus?: number;
  status: 'AKTIF' | 'TIDAK_AKTIF' | 'HABIS';
  catatan?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BigQueryRedemptionRecord {
  transaction_id: string;
  no_akaun: string;
  nama_pelanggan: string;
  kad_pengenalan?: string;
  gift_id: string;
  nama_hadiah: string;
  kuantiti: number;
  baki_selepas?: number;
  status: 'BERJAYA' | 'BATAL';
  operator: string;
  catatan?: string;
  created_at: string;
}

export interface BigQueryAuditLogRecord {
  id: string;
  transaction_id?: string;
  action: 'CREATE_GIFT' | 'UPDATE_GIFT' | 'ADD_STOCK' | 'REDEEM_GIFT' | 'CANCEL_REDEMPTION' | 'UPDATE_PROFILE';
  item?: string;
  quantity?: number;
  operator: string;
  details?: string;
  status: 'BERJAYA' | 'GAGAL';
  timestamp: string;
}

export interface GiftDashboardMetrics {
  totalGiftTypes: number;
  totalCurrentStock: number;
  totalRedeemed: number;
  criticalStockCount: number;
  todayRedemptionsCount: number;
  monthRedemptionsCount: number;
  topRedeemedGifts: Array<{
    nama_hadiah: string;
    jumlah_ditebus: number;
    baki_stok: number;
  }>;
  criticalGifts: Array<{
    id: string;
    nama_hadiah: string;
    stok_semasa: number;
    stok_minimum: number;
    kategori: string;
  }>;
  recentRedemptions: BigQueryRedemptionRecord[];
}

export interface CustomerSearchResult {
  noAkaun: string;
  nama: string;
  kadPengenalan: string;
  noTel?: string;
  email?: string;
  kategoriAkaun?: string;
  rewardStatus?: string;
  rewardClaimedAt?: string;
  rewardGiftName?: string;
}

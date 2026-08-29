/**
 * Google BigQuery Integration & Cloudflare Pages Service
 * Handles communication with Google Apps Script Web App API bridging to Google BigQuery.
 */

import { CustomerAccount, ProfileUpdateAuditLog, GiftItem, BigQueryConfig } from '../types';
import { getMalaysiaDateTime, getMalaysiaDateTimeFull } from '../utils/dateHelper';

export const BIGQUERY_CONFIG_KEY = 'ekemaskini_bigquery_config_v1';
export const BIGQUERY_DEFAULT_API_KEY = 'eKemaskini_Secret_Key_2026';

export const DEFAULT_BIGQUERY_CONFIG: BigQueryConfig = {
  projectId: 'ekemaskini-project-2026',
  datasetId: 'ekemaskini_db',
  customersTable: 'pelanggan',
  giftsTable: 'hadiah',
  auditLogsTable: 'log_audit',
  appsScriptUrl: '',
  apiKey: BIGQUERY_DEFAULT_API_KEY,
  isConnected: false,
  autoSyncOnUpdate: true,
};

/**
 * Retrieve stored BigQuery configuration
 */
export function getStoredBigQueryConfig(): BigQueryConfig {
  try {
    const raw = localStorage.getItem(BIGQUERY_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_BIGQUERY_CONFIG, ...parsed };
    }
  } catch (err) {
    console.error('Failed to parse BigQuery config:', err);
  }
  return DEFAULT_BIGQUERY_CONFIG;
}

/**
 * Save BigQuery configuration to localStorage
 */
export function saveBigQueryConfig(config: BigQueryConfig): void {
  try {
    localStorage.setItem(BIGQUERY_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save BigQuery config:', err);
  }
}

/**
 * Complete Google BigQuery SQL DDL Schema creation script
 */
export function generateBigQueryDDL(config: BigQueryConfig): string {
  const project = config.projectId || 'ekemaskini-project-2026';
  const dataset = config.datasetId || 'ekemaskini_db';
  const custTable = config.customersTable || 'pelanggan';
  const giftsTable = config.giftsTable || 'hadiah';
  const auditTable = config.auditLogsTable || 'log_audit';

  return `-- ====================================================================
-- Google BigQuery DDL: Skrip Cipta Dataset & Jadual eKemaskini
-- Salin dan laksana (Run) arahan SQL ini di dalam Google BigQuery Console
-- ====================================================================

-- 1. Cipta Dataset (Pangkalan Data)
CREATE SCHEMA IF NOT EXISTS \`${project}.${dataset}\`
OPTIONS (
  location = 'asia-southeast1', -- Lokasi data (Singapura / Rantau Malaysia)
  description = 'Pangkalan Data eKemaskini Pelanggan & Pengurusan Hadiah'
);

-- 2. Cipta Jadual: Pelanggan (${custTable})
CREATE TABLE IF NOT EXISTS \`${project}.${dataset}.${custTable}\` (
  id STRING NOT NULL,
  noAkaun STRING NOT NULL,
  nama STRING NOT NULL,
  kadPengenalan STRING,
  noTel STRING,
  email STRING,
  kategoriAkaun STRING DEFAULT 'Kediaman',
  status STRING DEFAULT 'Aktif',
  telahDikemaskini BOOLEAN DEFAULT FALSE,
  lastUpdated STRING,
  tarikhDaftar STRING,
  kemaskiniOleh STRING,
  rewardStatus STRING DEFAULT 'Belum Layak', -- 'Belum Layak' | 'Layak (Belum Dituntut)' | 'Telah Dituntut'
  rewardCode STRING,
  rewardClaimedAt STRING,
  rewardGiftName STRING,
  rewardGiftRemainingStock INT64,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- Cipta Index / Partition untuk Carian Pantas
-- Nota: BigQuery mengoptimumkan carian automatik melalui carian partition & cluster
-- Anda boleh menambah clustering jika data melebihi 100,000 rekod:
-- CLUSTER BY noAkaun, kadPengenalan;

-- 3. Cipta Jadual: Inventori Hadiah (${giftsTable})
CREATE TABLE IF NOT EXISTS \`${project}.${dataset}.${giftsTable}\` (
  id STRING NOT NULL,
  namaHadiah STRING NOT NULL,
  kuantiti INT64 NOT NULL DEFAULT 0,
  kuantitiAsal INT64 NOT NULL DEFAULT 0,
  bakiSemasa INT64 NOT NULL DEFAULT 0,
  jumlahDitebus INT64 NOT NULL DEFAULT 0,
  tarikhDitambah STRING,
  catatan STRING,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- 4. Cipta Jadual: Log Audit Transaksi (${auditTable})
CREATE TABLE IF NOT EXISTS \`${project}.${dataset}.${auditTable}\` (
  id STRING NOT NULL,
  noAkaun STRING NOT NULL,
  nama STRING NOT NULL,
  oldPhone STRING,
  newPhone STRING,
  oldEmail STRING,
  newEmail STRING,
  changedFields ARRAY<STRING>,
  timestamp STRING NOT NULL,
  source STRING DEFAULT 'Portal Pelanggan',
  isRewardEligible BOOLEAN DEFAULT FALSE,
  rewardStatus STRING,
  rewardCode STRING,
  rewardClaimed BOOLEAN DEFAULT FALSE,
  rewardClaimedAt STRING,
  rewardGiftName STRING,
  rewardGiftRemainingStock INT64,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ====================================================================
-- Contoh Data Permulaan (Seed Data Pilihan)
-- ====================================================================

-- Tambah Inventori Hadiah Awal
INSERT INTO \`${project}.${dataset}.${giftsTable}\` 
(id, namaHadiah, kuantiti, kuantitiAsal, bakiSemasa, jumlahDitebus, tarikhDitambah, catatan)
VALUES 
  ('gift_001', 'Baucar Tunai RM10', 100, 100, 100, 0, '${getMalaysiaDateTime()}', 'Baucar digital untuk 100 pelanggan terawal'),
  ('gift_002', 'Payung Eksklusif eKemaskini', 50, 50, 50, 0, '${getMalaysiaDateTime()}', 'Cenderahati eksklusif'),
  ('gift_003', 'Beg Kanvas Mesra Alam', 50, 50, 50, 0, '${getMalaysiaDateTime()}', 'Beg kitar semula edisi khas');
`;
}

/**
 * Complete Google Apps Script (Code.gs) for BigQuery REST API
 */
export function generateAppsScriptBigQueryCode(config: BigQueryConfig): string {
  const project = config.projectId || 'ekemaskini-project-2026';
  const dataset = config.datasetId || 'ekemaskini_db';
  const custTable = config.customersTable || 'pelanggan';
  const giftsTable = config.giftsTable || 'hadiah';
  const auditTable = config.auditLogsTable || 'log_audit';
  const apiKey = config.apiKey || BIGQUERY_DEFAULT_API_KEY;

  return `/**
 * ====================================================================
 * eKemaskini - Google Apps Script Web App API untuk Google BigQuery
 * ====================================================================
 * 
 * ARAHAN PERSEDIAAN (SETUP INSTRUCTIONS):
 * 1. Buka Google Apps Script (https://script.google.com).
 * 2. Cipta projek baru bernama "eKemaskini BigQuery API".
 * 3. Di menu sebelah kiri, klik "Services" (+) -> Pilih "BigQuery API" -> Klik "Add".
 * 4. Pastikan Projek GCP (Google Cloud Platform) anda dihubungkan di Project Settings jika perlu,
 *    atau berikan kebenaran (OAuth) semasa menjalankan fungsi pertama kali.
 * 5. Salin dan tampal keseluruhan kod ini ke dalam Code.gs.
 * 6. Klik "Deploy" -> "New deployment" -> Jenis "Web App":
 *    - Execute as: "Me (akaun Google anda)"
 *    - Who has access: "Anyone" (semua request dipertahankan oleh Secret API Token di bawah).
 * 7. Salin Web App URL dan masukkan ke dalam aplikasi frontend Cloudflare Pages anda.
 */

// Konfigurasi Pangkalan Data BigQuery
var CONFIG = {
  PROJECT_ID: '${project}',
  DATASET_ID: '${dataset}',
  TABLE_CUSTOMERS: '${custTable}',
  TABLE_GIFTS: '${giftsTable}',
  TABLE_AUDIT: '${auditTable}',
  SECRET_API_KEY: '${apiKey}', // Kunci keselamatan API
};

/**
 * Handle GET Request (Health Check, Search, Get Gifts, Get Stats)
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || 'ping';

    // 1. Health Check (Ping)
    if (action === 'ping') {
      return jsonResponse({
        success: true,
        message: 'eKemaskini BigQuery API sedang beroperasi!',
        timestamp: getMalaysiaTimestamp(),
        project: CONFIG.PROJECT_ID,
        dataset: CONFIG.DATASET_ID
      });
    }

    // 2. Semak Pengesahan API Token untuk fungsi lain
    var authKey = params.apiKey || params.api_key || (e && e.headers && e.headers.Authorization);
    if (!isValidAuth(authKey)) {
      return jsonResponse({ success: false, error: 'Akses Ditolak: Kunci API tidak sah atau tiada.' }, 401);
    }

    // 3. Carian Akaun Pelanggan (Lookup)
    if (action === 'searchAccount') {
      var queryTerm = String(params.query || '').trim();
      if (!queryTerm) {
        return jsonResponse({ success: false, error: 'Parameter carian diperlukan.' });
      }
      var account = searchCustomerInBigQuery(queryTerm);
      if (!account) {
        return jsonResponse({ success: false, found: false, message: 'Akaun tidak dijumpai.' });
      }
      return jsonResponse({ success: true, found: true, account: account });
    }

    // 4. Dapatkan Senarai Hadiah & Baki Stok
    if (action === 'getGifts') {
      var gifts = getGiftsFromBigQuery();
      return jsonResponse({ success: true, gifts: gifts });
    }

    // 5. Dapatkan Statistik Keseluruhan
    if (action === 'getStats') {
      var stats = getOverallStatsFromBigQuery();
      return jsonResponse({ success: true, stats: stats });
    }

    // 6. Dapatkan Semua Akaun (Untuk Panel Admin)
    if (action === 'getAllAccounts') {
      var limit = parseInt(params.limit || '1000', 10);
      var offset = parseInt(params.offset || '0', 10);
      var result = getAllAccountsFromBigQuery(limit, offset);
      return jsonResponse({ success: true, accounts: result.accounts, total: result.total });
    }

    // 7. Dapatkan Log Audit
    if (action === 'getAuditLogs') {
      var logs = getAuditLogsFromBigQuery();
      return jsonResponse({ success: true, logs: logs });
    }

    return jsonResponse({ success: false, error: 'Tindakan (action) tidak dikenali.' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() }, 500);
  }
}

/**
 * Handle POST Request (Update Profile, Update Gift Stock, Claim Gift, Add Gift, Bulk Import)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: 'Tiada data payload POST diterima.' }, 400);
    }

    var body = {};
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({ success: false, error: 'Format JSON payload tidak sah.' }, 400);
    }

    // Semak Pengesahan API Token
    var authKey = body.apiKey || body.api_key;
    if (!isValidAuth(authKey)) {
      return jsonResponse({ success: false, error: 'Akses Ditolak: Kunci API tidak sah atau tiada.' }, 401);
    }

    var action = body.action || '';

    // 1. Kemaskini Profil Pelanggan (Oleh Pelanggan atau Admin)
    if (action === 'updateProfile') {
      var account = body.account;
      var changedFields = body.changedFields || [];
      var oldPhone = body.oldPhone || '';
      var oldEmail = body.oldEmail || '';
      var source = body.source || 'Portal Pelanggan';

      if (!account || !account.noAkaun) {
        return jsonResponse({ success: false, error: 'Data akaun tidak lengkap.' });
      }

      var updateResult = updateCustomerInBigQuery(account, changedFields, oldPhone, oldEmail, source);
      return jsonResponse(updateResult);
    }

    // 2. Kemaskini / Tambah Inventori Hadiah (Super Admin)
    if (action === 'saveGift') {
      var gift = body.gift;
      if (!gift || !gift.namaHadiah) {
        return jsonResponse({ success: false, error: 'Data hadiah tidak lengkap.' });
      }
      var saveResult = saveGiftInBigQuery(gift);
      return jsonResponse(saveResult);
    }

    // 3. Padam Hadiah (Super Admin)
    if (action === 'deleteGift') {
      var giftId = body.giftId;
      if (!giftId) {
        return jsonResponse({ success: false, error: 'ID Hadiah diperlukan.' });
      }
      var delResult = deleteGiftFromBigQuery(giftId);
      return jsonResponse(delResult);
    }

    // 4. Tebus / Serah Hadiah kepada Pelanggan (Admin / Super Admin)
    if (action === 'claimGift') {
      var noAkaun = body.noAkaun;
      var giftId = body.giftId;
      var giftName = body.giftName;

      if (!noAkaun) {
        return jsonResponse({ success: false, error: 'Nombor akaun diperlukan untuk tuntutan hadiah.' });
      }

      var claimResult = claimCustomerGiftInBigQuery(noAkaun, giftId, giftName);
      return jsonResponse(claimResult);
    }

    // 5. Muat Naik Pukal Akaun ke BigQuery (Bulk Import)
    if (action === 'bulkImportAccounts') {
      var accounts = body.accounts || [];
      if (!accounts.length) {
        return jsonResponse({ success: false, error: 'Senarai akaun kosong.' });
      }
      var importResult = bulkInsertAccountsToBigQuery(accounts);
      return jsonResponse(importResult);
    }

    return jsonResponse({ success: false, error: 'Tindakan (action) tidak dikenali.' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() }, 500);
  }
}

// ====================================================================
// FUNGSI OPERASI BIGQUERY (SQL & DATA ENGINE)
// ====================================================================

/**
 * Cari Profil Pelanggan dalam BigQuery mengikut No Akaun atau Kad Pengenalan
 */
function searchCustomerInBigQuery(queryTerm) {
  var cleanTerm = queryTerm.replace(/['"\\\`]/g, '').trim();
  var sql = 'SELECT * FROM \`' + CONFIG.PROJECT_ID + '.' + CONFIG.DATASET_ID + '.' + CONFIG.TABLE_CUSTOMERS + '\` ' +
            'WHERE LOWER(noAkaun) = LOWER(@term) OR REPLACE(kadPengenalan, "-", "") = REPLACE(@term, "-", "") ' +
            'LIMIT 1';

  var request = {
    query: sql,
    useLegacySql: false,
    queryParameters: [
      {
        name: 'term',
        parameterType: { type: 'STRING' },
        parameterValue: { value: cleanTerm }
      }
    ]
  };

  var queryResults = BigQuery.Jobs.query(request, CONFIG.PROJECT_ID);
  var rows = queryResults.rows;

  if (!rows || rows.length === 0) {
    return null;
  }

  return formatBigQueryRowToAccount(rows[0], queryResults.schema.fields);
}

/**
 * Kemaskini Maklumat Profil Pelanggan & Masukkan Log Audit ke BigQuery
 */
function updateCustomerInBigQuery(account, changedFields, oldPhone, oldEmail, source) {
  var now = getMalaysiaTimestamp();
  var noAkaun = String(account.noAkaun).trim();
  var noTel = String(account.noTel || '').trim();
  var email = String(account.email || '').trim();
  var kemaskiniOleh = account.kemaskiniOleh || source || 'Portal Pelanggan';

  // 1. Tentukan kelayakan hadiah (jika kali pertama dikemaskini)
  var rewardStatus = account.rewardStatus || 'Layak (Belum Dituntut)';
  var rewardCode = account.rewardCode || ('GIFT-' + Math.random().toString(36).substring(2, 8).toUpperCase());

  // 2. Laksana DML SQL UPDATE dalam BigQuery
  var updateSql = 'UPDATE \`' + CONFIG.PROJECT_ID + '.' + CONFIG.DATASET_ID + '.' + CONFIG.TABLE_CUSTOMERS + '\` ' +
                  'SET noTel = @noTel, ' +
                  '    email = @email, ' +
                  '    telahDikemaskini = TRUE, ' +
                  '    lastUpdated = @lastUpdated, ' +
                  '    kemaskiniOleh = @kemaskiniOleh, ' +
                  '    rewardStatus = COALESCE(rewardStatus, @rewardStatus), ' +
                  '    rewardCode = COALESCE(rewardCode, @rewardCode) ' +
                  'WHERE LOWER(noAkaun) = LOWER(@noAkaun)';

  var updateRequest = {
    query: updateSql,
    useLegacySql: false,
    queryParameters: [
      { name: 'noTel', parameterType: { type: 'STRING' }, parameterValue: { value: noTel } },
      { name: 'email', parameterType: { type: 'STRING' }, parameterValue: { value: email } },
      { name: 'lastUpdated', parameterType: { type: 'STRING' }, parameterValue: { value: now } },
      { name: 'kemaskiniOleh', parameterType: { type: 'STRING' }, parameterValue: { value: kemaskiniOleh } },
      { name: 'rewardStatus', parameterType: { type: 'STRING' }, parameterValue: { value: rewardStatus } },
      { name: 'rewardCode', parameterType: { type: 'STRING' }, parameterValue: { value: rewardCode } },
      { name: 'noAkaun', parameterType: { type: 'STRING' }, parameterValue: { value: noAkaun } }
    ]
  };

  var queryJob = BigQuery.Jobs.query(updateRequest, CONFIG.PROJECT_ID);

  // 3. Masukkan Rekod Log Audit ke Jadual log_audit
  var logId = 'audit_' + new Date().getTime() + '_' + Math.random().toString(36).substring(2, 6);
  var insertAuditRequest = {
    rows: [
      {
        json: {
          id: logId,
          noAkaun: noAkaun,
          nama: account.nama || 'Pelanggan',
          oldPhone: oldPhone,
          newPhone: noTel,
          oldEmail: oldEmail,
          newEmail: email,
          changedFields: changedFields.length ? changedFields : ['Profil Dikemaskini'],
          timestamp: now,
          source: source,
          isRewardEligible: true,
          rewardStatus: rewardStatus,
          rewardCode: rewardCode,
          rewardClaimed: false
        }
      }
    ]
  };

  try {
    BigQuery.Tabledata.insertAll(insertAuditRequest, CONFIG.PROJECT_ID, CONFIG.DATASET_ID, CONFIG.TABLE_AUDIT);
  } catch (auditErr) {
    Logger.log('Gagal menyimpan log audit: ' + auditErr);
  }

  return {
    success: true,
    message: 'Profil berjaya dikemaskini dan disimpan dalam Google BigQuery!',
    timestamp: now,
    account: {
      noAkaun: noAkaun,
      nama: account.nama,
      noTel: noTel,
      email: email,
      telahDikemaskini: true,
      lastUpdated: now,
      rewardStatus: rewardStatus,
      rewardCode: rewardCode
    }
  };
}

/**
 * Dapatkan Senarai Hadiah & Baki Semasa dari BigQuery
 */
function getGiftsFromBigQuery() {
  var sql = 'SELECT * FROM \`' + CONFIG.PROJECT_ID + '.' + CONFIG.DATASET_ID + '.' + CONFIG.TABLE_GIFTS + '\` ORDER BY tarikhDitambah DESC';
  var request = { query: sql, useLegacySql: false };
  var results = BigQuery.Jobs.query(request, CONFIG.PROJECT_ID);

  var gifts = [];
  if (results.rows && results.rows.length) {
    var fields = results.schema.fields;
    for (var i = 0; i < results.rows.length; i++) {
      var item = formatBigQueryRowToGift(results.rows[i], fields);
      gifts.push(item);
    }
  }
  return gifts;
}

/**
 * Tambah / Kemaskini Hadiah dalam BigQuery
 */
function saveGiftInBigQuery(gift) {
  var giftId = gift.id || ('gift_' + new Date().getTime());
  var namaHadiah = String(gift.namaHadiah).trim();
  var kuantiti = parseInt(gift.kuantiti || 0, 10);
  var kuantitiAsal = parseInt(gift.kuantitiAsal || gift.kuantiti || 0, 10);
  var bakiSemasa = parseInt(gift.bakiSemasa !== undefined ? gift.bakiSemasa : gift.kuantiti, 10);
  var jumlahDitebus = parseInt(gift.jumlahDitebus || 0, 10);
  var catatan = gift.catatan || '';
  var tarikhDitambah = gift.tarikhDitambah || getMalaysiaTimestamp();

  // Semak jika hadiah sudah wujud
  var checkSql = 'SELECT id FROM \`' + CONFIG.PROJECT_ID + '.' + CONFIG.DATASET_ID + '.' + CONFIG.TABLE_GIFTS + '\` WHERE id = @id LIMIT 1';
  var checkResults = BigQuery.Jobs.query({
    query: checkSql,
    useLegacySql: false,
    queryParameters: [{ name: 'id', parameterType: { type: 'STRING' }, parameterValue: { value: giftId } }]
  }, CONFIG.PROJECT_ID);

  if (checkResults.rows && checkResults.rows.length > 0) {
    // UPDATE
    var updateSql = 'UPDATE \`' + CONFIG.PROJECT_ID + '.' + CONFIG.DATASET_ID + '.' + CONFIG.TABLE_GIFTS + '\` ' +
                    'SET namaHadiah = @nama, kuantiti = @kuantiti, kuantitiAsal = @kuantitiAsal, ' +
                    '    bakiSemasa = @bakiSemasa, jumlahDitebus = @jumlahDitebus, catatan = @catatan ' +
                    'WHERE id = @id';
    BigQuery.Jobs.query({
      query: updateSql,
      useLegacySql: false,
      queryParameters: [
        { name: 'nama', parameterType: { type: 'STRING' }, parameterValue: { value: namaHadiah } },
        { name: 'kuantiti', parameterType: { type: 'INT64' }, parameterValue: { value: String(kuantiti) } },
        { name: 'kuantitiAsal', parameterType: { type: 'INT64' }, parameterValue: { value: String(kuantitiAsal) } },
        { name: 'bakiSemasa', parameterType: { type: 'INT64' }, parameterValue: { value: String(bakiSemasa) } },
        { name: 'jumlahDitebus', parameterType: { type: 'INT64' }, parameterValue: { value: String(jumlahDitebus) } },
        { name: 'catatan', parameterType: { type: 'STRING' }, parameterValue: { value: catatan } },
        { name: 'id', parameterType: { type: 'STRING' }, parameterValue: { value: giftId } }
      ]
    }, CONFIG.PROJECT_ID);
  } else {
    // INSERT
    BigQuery.Tabledata.insertAll({
      rows: [{
        json: {
          id: giftId,
          namaHadiah: namaHadiah,
          kuantiti: kuantiti,
          kuantitiAsal: kuantitiAsal,
          bakiSemasa: bakiSemasa,
          jumlahDitebus: jumlahDitebus,
          tarikhDitambah: tarikhDitambah,
          catatan: catatan
        }
      }]
    }, CONFIG.PROJECT_ID, CONFIG.DATASET_ID, CONFIG.TABLE_GIFTS);
  }

  return { success: true, message: 'Inventori hadiah berjaya disimpan ke BigQuery.', giftId: giftId };
}

/**
 * Padam Hadiah dari BigQuery
 */
function deleteGiftFromBigQuery(giftId) {
  var sql = 'DELETE FROM \`' + CONFIG.PROJECT_ID + '.' + CONFIG.DATASET_ID + '.' + CONFIG.TABLE_GIFTS + '\` WHERE id = @id';
  BigQuery.Jobs.query({
    query: sql,
    useLegacySql: false,
    queryParameters: [{ name: 'id', parameterType: { type: 'STRING' }, parameterValue: { value: giftId } }]
  }, CONFIG.PROJECT_ID);
  return { success: true, message: 'Hadiah berjaya dipadam dari BigQuery.' };
}

/**
 * Laksana Tuntutan Hadiah Pelanggan & Tolak Baki Stok Hadiah dalam BigQuery
 */
function claimCustomerGiftInBigQuery(noAkaun, giftId, giftName) {
  var now = getMalaysiaTimestamp();

  // 1. Dapatkan stok terkini hadiah jika giftId diberikan
  var remainingStock = 0;
  var finalGiftName = giftName || 'Hadiah Penghargaan';

  if (giftId) {
    var giftQuery = BigQuery.Jobs.query({
      query: 'SELECT * FROM \`' + CONFIG.PROJECT_ID + '.' + CONFIG.DATASET_ID + '.' + CONFIG.TABLE_GIFTS + '\` WHERE id = @id LIMIT 1',
      useLegacySql: false,
      queryParameters: [{ name: 'id', parameterType: { type: 'STRING' }, parameterValue: { value: giftId } }]
    }, CONFIG.PROJECT_ID);

    if (giftQuery.rows && giftQuery.rows.length > 0) {
      var gObj = formatBigQueryRowToGift(giftQuery.rows[0], giftQuery.schema.fields);
      finalGiftName = gObj.namaHadiah;
      var curBaki = Math.max(0, parseInt(gObj.bakiSemasa || 0, 10));
      var curClaimed = parseInt(gObj.jumlahDitebus || 0, 10);

      if (curBaki > 0) {
        var newBaki = curBaki - 1;
        var newClaimed = curClaimed + 1;
        remainingStock = newBaki;

        // Kemaskini baki hadiah dalam BigQuery
        BigQuery.Jobs.query({
          query: 'UPDATE \`' + CONFIG.PROJECT_ID + '.' + CONFIG.DATASET_ID + '.' + CONFIG.TABLE_GIFTS + '\` ' +
                 'SET bakiSemasa = @baki, jumlahDitebus = @claimed WHERE id = @id',
          useLegacySql: false,
          queryParameters: [
            { name: 'baki', parameterType: { type: 'INT64' }, parameterValue: { value: String(newBaki) } },
            { name: 'claimed', parameterType: { type: 'INT64' }, parameterValue: { value: String(newClaimed) } },
            { name: 'id', parameterType: { type: 'STRING' }, parameterValue: { value: giftId } }
          ]
        }, CONFIG.PROJECT_ID);
      }
    }
  }

  // 2. Kemaskini Status Pelanggan dalam BigQuery
  var updateCustSql = 'UPDATE \`' + CONFIG.PROJECT_ID + '.' + CONFIG.DATASET_ID + '.' + CONFIG.TABLE_CUSTOMERS + '\` ' +
                      'SET rewardStatus = "Telah Dituntut", ' +
                      '    rewardClaimedAt = @claimedAt, ' +
                      '    rewardGiftName = @giftName, ' +
                      '    rewardGiftRemainingStock = @remStock ' +
                      'WHERE LOWER(noAkaun) = LOWER(@noAkaun)';

  BigQuery.Jobs.query({
    query: updateCustSql,
    useLegacySql: false,
    queryParameters: [
      { name: 'claimedAt', parameterType: { type: 'STRING' }, parameterValue: { value: now } },
      { name: 'giftName', parameterType: { type: 'STRING' }, parameterValue: { value: finalGiftName } },
      { name: 'remStock', parameterType: { type: 'INT64' }, parameterValue: { value: String(remainingStock) } },
      { name: 'noAkaun', parameterType: { type: 'STRING' }, parameterValue: { value: noAkaun } }
    ]
  }, CONFIG.PROJECT_ID);

  return {
    success: true,
    message: 'Penyerahan hadiah berjaya direkodkan dalam BigQuery!',
    rewardStatus: 'Telah Dituntut',
    rewardGiftName: finalGiftName,
    rewardGiftRemainingStock: remainingStock,
    rewardClaimedAt: now
  };
}

/**
 * Dapatkan Statistik Keseluruhan dari BigQuery
 */
function getOverallStatsFromBigQuery() {
  var custStatsQuery = BigQuery.Jobs.query({
    query: 'SELECT ' +
           '  COUNT(*) AS totalAccounts, ' +
           '  COUNTIF(telahDikemaskini = TRUE) AS totalUpdated, ' +
           '  COUNTIF(rewardStatus = "Telah Dituntut") AS totalGiftsClaimed ' +
           'FROM \`' + CONFIG.PROJECT_ID + '.' + CONFIG.DATASET_ID + '.' + CONFIG.TABLE_CUSTOMERS + '\`',
    useLegacySql: false
  }, CONFIG.PROJECT_ID);

  var giftStatsQuery = BigQuery.Jobs.query({
    query: 'SELECT ' +
           '  COALESCE(SUM(kuantitiAsal), 0) AS totalInitialStock, ' +
           '  COALESCE(SUM(bakiSemasa), 0) AS totalRemainingStock ' +
           'FROM \`' + CONFIG.PROJECT_ID + '.' + CONFIG.DATASET_ID + '.' + CONFIG.TABLE_GIFTS + '\`',
    useLegacySql: false
  }, CONFIG.PROJECT_ID);

  var totalAccounts = 0;
  var totalUpdated = 0;
  var totalGiftsClaimed = 0;
  var totalInitialStock = 0;
  var totalRemainingStock = 0;

  if (custStatsQuery.rows && custStatsQuery.rows.length) {
    var r = custStatsQuery.rows[0].f;
    totalAccounts = parseInt(r[0].v || 0, 10);
    totalUpdated = parseInt(r[1].v || 0, 10);
    totalGiftsClaimed = parseInt(r[2].v || 0, 10);
  }

  if (giftStatsQuery.rows && giftStatsQuery.rows.length) {
    var gr = giftStatsQuery.rows[0].f;
    totalInitialStock = parseInt(gr[0].v || 0, 10);
    totalRemainingStock = parseInt(gr[1].v || 0, 10);
  }

  return {
    totalAccounts: totalAccounts,
    totalUpdated: totalUpdated,
    totalGiftsClaimed: totalGiftsClaimed,
    totalInitialStock: totalInitialStock,
    totalRemainingStock: totalRemainingStock,
    lastSync: getMalaysiaTimestamp()
  };
}

/**
 * Dapatkan Senarai Semua Akaun dari BigQuery (Paging)
 */
function getAllAccountsFromBigQuery(limit, offset) {
  var countQuery = BigQuery.Jobs.query({
    query: 'SELECT COUNT(*) FROM \`' + CONFIG.PROJECT_ID + '.' + CONFIG.DATASET_ID + '.' + CONFIG.TABLE_CUSTOMERS + '\`',
    useLegacySql: false
  }, CONFIG.PROJECT_ID);
  var total = countQuery.rows && countQuery.rows.length ? parseInt(countQuery.rows[0].f[0].v || 0, 10) : 0;

  var sql = 'SELECT * FROM \`' + CONFIG.PROJECT_ID + '.' + CONFIG.DATASET_ID + '.' + CONFIG.TABLE_CUSTOMERS + '\` ' +
            'ORDER BY lastUpdated DESC LIMIT ' + limit + ' OFFSET ' + offset;
  var results = BigQuery.Jobs.query({ query: sql, useLegacySql: false }, CONFIG.PROJECT_ID);

  var accounts = [];
  if (results.rows && results.rows.length) {
    var fields = results.schema.fields;
    for (var i = 0; i < results.rows.length; i++) {
      accounts.push(formatBigQueryRowToAccount(results.rows[i], fields));
    }
  }
  return { accounts: accounts, total: total };
}

/**
 * Dapatkan Senarai Log Audit dari BigQuery
 */
function getAuditLogsFromBigQuery() {
  var sql = 'SELECT * FROM \`' + CONFIG.PROJECT_ID + '.' + CONFIG.DATASET_ID + '.' + CONFIG.TABLE_AUDIT + '\` ORDER BY timestamp DESC LIMIT 500';
  var results = BigQuery.Jobs.query({ query: sql, useLegacySql: false }, CONFIG.PROJECT_ID);

  var logs = [];
  if (results.rows && results.rows.length) {
    var fields = results.schema.fields;
    for (var i = 0; i < results.rows.length; i++) {
      var r = results.rows[i].f;
      var obj = {};
      for (var f = 0; f < fields.length; f++) {
        var fName = fields[f].name;
        var fVal = r[f].v;
        if (fVal !== null && fVal !== undefined) {
          obj[fName] = fVal;
        }
      }
      logs.push(obj);
    }
  }
  return logs;
}

/**
 * Muat Naik Pukal Akaun Pelanggan (Bulk Insert Streaming)
 */
function bulkInsertAccountsToBigQuery(accounts) {
  var rows = [];
  var now = getMalaysiaTimestamp();

  for (var i = 0; i < accounts.length; i++) {
    var a = accounts[i];
    rows.push({
      json: {
        id: a.id || ('acc_' + (i + 1) + '_' + a.noAkaun),
        noAkaun: String(a.noAkaun || ''),
        nama: String(a.nama || ''),
        kadPengenalan: String(a.kadPengenalan || ''),
        noTel: String(a.noTel || ''),
        email: String(a.email || ''),
        kategoriAkaun: a.kategoriAkaun || 'Kediaman',
        status: a.status || 'Aktif',
        telahDikemaskini: Boolean(a.telahDikemaskini),
        lastUpdated: a.lastUpdated || now,
        tarikhDaftar: a.tarikhDaftar || now.slice(0, 10),
        kemaskiniOleh: a.kemaskiniOleh || 'Import Pukal',
        rewardStatus: a.rewardStatus || 'Belum Layak',
        rewardCode: a.rewardCode || ''
      }
    });
  }

  // Masukkan secara kelompok (batch 500 baris setiap kali)
  var batchSize = 500;
  var insertedCount = 0;

  for (var j = 0; j < rows.length; j += batchSize) {
    var batch = rows.slice(j, j + batchSize);
    BigQuery.Tabledata.insertAll({ rows: batch }, CONFIG.PROJECT_ID, CONFIG.DATASET_ID, CONFIG.TABLE_CUSTOMERS);
    insertedCount += batch.length;
  }

  return { success: true, count: insertedCount, message: 'Berjaya memuat naik ' + insertedCount + ' rekod ke BigQuery.' };
}

// ====================================================================
// FUNGSI BANTUAN FORMATTING & KESELAMATAN
// ====================================================================

function isValidAuth(authKey) {
  if (!authKey) return false;
  var cleanKey = String(authKey).replace(/^Bearer\\s+/i, '').trim();
  return cleanKey === CONFIG.SECRET_API_KEY;
}

function formatBigQueryRowToAccount(row, fields) {
  var acc = {};
  var fValues = row.f;
  for (var i = 0; i < fields.length; i++) {
    var fName = fields[i].name;
    var val = fValues[i].v;
    if (val !== null && val !== undefined) {
      if (fName === 'telahDikemaskini') acc[fName] = (val === 'true' || val === true);
      else if (fName === 'rewardGiftRemainingStock') acc[fName] = parseInt(val, 10);
      else acc[fName] = val;
    }
  }
  return acc;
}

function formatBigQueryRowToGift(row, fields) {
  var gift = {};
  var fValues = row.f;
  for (var i = 0; i < fields.length; i++) {
    var fName = fields[i].name;
    var val = fValues[i].v;
    if (val !== null && val !== undefined) {
      if (['kuantiti', 'kuantitiAsal', 'bakiSemasa', 'jumlahDitebus'].indexOf(fName) !== -1) {
        gift[fName] = parseInt(val, 10);
      } else {
        gift[fName] = val;
      }
    }
  }
  return gift;
}

function getMalaysiaTimestamp() {
  return Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy-MM-dd HH:mm');
}

function jsonResponse(obj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
`;
}

/**
 * Standalone Frontend HTML/JS Template for Cloudflare Pages
 * Contains both Public "Carian & Kemaskini Profile" and Admin with strict PIN code protection!
 */
export function generateCloudflarePagesIndexHtml(config: BigQueryConfig): string {
  const apiUrl = config.appsScriptUrl || 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
  const apiKey = config.apiKey || BIGQUERY_DEFAULT_API_KEY;

  return `<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>eKemaskini - Portal Pelanggan & BigQuery Admin</title>
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Lucide Icons -->
  <script src="https://unpkg.com/lucide@latest"></script>
  <!-- Font Google -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">

  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .font-serif-heading { font-family: 'Playfair Display', Georgia, serif; }
    .font-mono-code { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="bg-[#F8F6F0] text-stone-900 min-h-screen flex flex-col antialiased">

  <!-- TOP NAVIGATION -->
  <header class="bg-[#FAF8F5] border-b border-stone-300/80 sticky top-0 z-40 backdrop-blur-md">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        
        <!-- Brand Logo -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center text-amber-400 font-bold shadow-sm">
            <i data-lucide="shield-check" class="w-6 h-6 text-amber-400"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-serif-heading font-bold text-lg tracking-tight text-stone-950">eKemaskini</span>
              <span class="text-[10px] font-mono-code bg-amber-200 text-amber-950 font-bold px-1.5 py-0.5 rounded border border-amber-300">BigQuery Edition</span>
            </div>
            <p class="text-[11px] text-stone-500 font-medium">Portal Pelanggan & Pengurusan Hadiah</p>
          </div>
        </div>

        <!-- Navigation Tabs & Admin Trigger -->
        <div class="flex items-center gap-2">
          <button id="nav-lookup-btn" onclick="showTab('lookup')" class="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all bg-stone-900 text-white shadow-xs">
            <span class="flex items-center gap-1.5"><i data-lucide="search" class="w-4 h-4"></i> Carian Awam</span>
          </button>
          
          <button id="nav-admin-btn" onclick="openAdminPinModal()" class="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all bg-white hover:bg-stone-100 text-stone-800 border border-stone-300">
            <span class="flex items-center gap-1.5 text-purple-900 font-bold"><i data-lucide="lock" class="w-4 h-4 text-purple-700"></i> Panel Admin (PIN)</span>
          </button>
        </div>

      </div>
    </div>
  </header>

  <!-- MAIN CONTAINER -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">

    <!-- ==================================================================== -->
    <!-- BAHAGIAN 1: CARIAN & KEMASKINI PROFILE (AWAM / MULTI-DEVICE) -->
    <!-- ==================================================================== -->
    <section id="tab-lookup" class="space-y-6">
      
      <!-- Hero Banner -->
      <div class="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-950 text-white rounded-2xl p-6 sm:p-8 shadow-md border border-stone-800">
        <div class="max-w-3xl">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-semibold mb-3 border border-amber-400/30">
            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Kemaskini & Dapatkan Hadiah Penghargaan
          </div>
          <h1 class="text-2xl sm:text-3xl font-serif-heading font-bold tracking-tight mb-2">
            Portal Semakan & Kemaskini Maklumat Pelanggan
          </h1>
          <p class="text-stone-300 text-sm sm:text-base leading-relaxed">
            Masukkan No. Akaun atau No. Kad Pengenalan anda untuk menyemak profil dan mengemaskini nombor telefon serta alamat e-mel terkini terus ke pangkalan data selamat Google BigQuery.
          </p>
        </div>
      </div>

      <!-- Search Input Card -->
      <div class="bg-white rounded-2xl p-6 shadow-sm border border-stone-200/80">
        <label class="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
          Masukkan No. Akaun Pelanggan atau No. Kad Pengenalan
        </label>
        <div class="flex flex-col sm:flex-row gap-3">
          <div class="relative flex-1">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
              <i data-lucide="search" class="w-5 h-5"></i>
            </div>
            <input 
              type="text" 
              id="search-input" 
              placeholder="Contoh: ACC-10023 atau 880112145543" 
              class="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all outline-none"
              onkeydown="if(event.key==='Enter') executeAccountSearch()"
            >
          </div>
          <button 
            id="search-submit-btn" 
            onclick="executeAccountSearch()" 
            class="px-6 py-3 bg-stone-900 hover:bg-black text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <i data-lucide="search" class="w-4 h-4"></i>
            <span>Cari Profil</span>
          </button>
        </div>

        <div id="search-loading" class="hidden mt-4 text-center py-4 text-stone-500 text-sm flex items-center justify-center gap-2">
          <div class="w-5 h-5 border-2 border-stone-900 border-t-transparent rounded-full animate-spin"></div>
          <span>Menghubungi Google BigQuery API...</span>
        </div>
      </div>

      <!-- Search Result & Update Card -->
      <div id="account-card" class="hidden bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-stone-200/80 space-y-6">
        
        <!-- Header Profile Info -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-stone-200">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span id="res-badge-status" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Aktif</span>
              <span id="res-badge-category" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-700">Kediaman</span>
              <span id="res-badge-updated" class="hidden px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300">✨ Telah Dikemaskini</span>
            </div>
            <h2 id="res-nama" class="text-xl sm:text-2xl font-serif-heading font-bold text-stone-950">-</h2>
            <p class="text-xs font-mono-code text-stone-500 mt-0.5">No. Akaun: <strong id="res-noakaun" class="text-stone-900">-</strong></p>
          </div>

          <!-- Reward Box Status -->
          <div id="reward-banner-box" class="bg-amber-50 border border-amber-300 rounded-xl p-3.5 max-w-sm w-full">
            <div class="flex items-center gap-2 text-amber-900 font-bold text-xs">
              <i data-lucide="gift" class="w-4 h-4 text-amber-600"></i>
              <span id="res-reward-title">Kelayakan Hadiah Penghargaan</span>
            </div>
            <p id="res-reward-desc" class="text-xs text-amber-800 mt-1">
              Kemaskini maklumat anda untuk melayakkan diri menuntut hadiah penghargaan (1x setiap akaun).
            </p>
          </div>
        </div>

        <!-- Editable Form -->
        <form id="profile-update-form" onsubmit="handleCustomerUpdate(event)" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div>
              <label class="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1.5">
                <i data-lucide="phone" class="w-3.5 h-3.5 text-stone-500"></i> Nombor Telefon Terkini *
              </label>
              <input 
                type="tel" 
                id="edit-notel" 
                required 
                placeholder="Contoh: 012-3456789"
                class="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all outline-none"
              >
            </div>

            <div>
              <label class="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1.5">
                <i data-lucide="mail" class="w-3.5 h-3.5 text-stone-500"></i> Alamat E-mel Terkini *
              </label>
              <input 
                type="email" 
                id="edit-email" 
                required 
                placeholder="Contoh: nama@domain.com"
                class="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all outline-none"
              >
            </div>

          </div>

          <div class="flex items-center justify-end gap-3 pt-4">
            <button 
              type="submit" 
              id="update-submit-btn"
              class="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <i data-lucide="check-circle" class="w-4 h-4"></i>
              <span>Simpan & Sahkan Kemaskini</span>
            </button>
          </div>
        </form>

      </div>

    </section>

    <!-- ==================================================================== -->
    <!-- BAHAGIAN 2: ADMIN & SUPERADMIN (PIN CODE PROTECTED - NO AUTO SESSION) -->
    <!-- ==================================================================== -->
    <section id="tab-admin" class="hidden space-y-6">
      
      <!-- Admin Top Toolbar -->
      <div class="bg-purple-950 text-white rounded-2xl p-6 shadow-md border border-purple-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-purple-950 font-mono-code">SUPERADMIN ACTIVE</span>
            <span class="text-xs text-purple-300">Sesi Selamat (Memori Sahaja)</span>
          </div>
          <h2 class="text-xl sm:text-2xl font-serif-heading font-bold">Panel Kawalan Google BigQuery</h2>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="refreshAdminData()" class="px-3.5 py-2 bg-purple-900 hover:bg-purple-800 text-purple-100 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-purple-700 cursor-pointer">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Segar Semula
          </button>
          <button onclick="logoutAdmin()" class="px-3.5 py-2 bg-stone-900 hover:bg-black text-stone-200 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-stone-800 cursor-pointer">
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i> Kunci Panel
          </button>
        </div>
      </div>

      <!-- Quick KPI Stats Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <span class="text-xs text-stone-500 font-bold uppercase">Jumlah Pelanggan</span>
          <div id="stat-total-accounts" class="text-2xl font-bold font-mono-code text-stone-900 mt-1">0</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <span class="text-xs text-stone-500 font-bold uppercase">Telah Dikemaskini</span>
          <div id="stat-total-updated" class="text-2xl font-bold font-mono-code text-emerald-700 mt-1">0</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <span class="text-xs text-stone-500 font-bold uppercase">Hadiah Ditebus</span>
          <div id="stat-gifts-claimed" class="text-2xl font-bold font-mono-code text-purple-700 mt-1">0</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <span class="text-xs text-stone-500 font-bold uppercase">Baki Stok Hadiah</span>
          <div id="stat-remaining-stock" class="text-2xl font-bold font-mono-code text-amber-700 mt-1">0</div>
        </div>
      </div>

      <!-- Section: Pengurusan Hadiah & Stok -->
      <div class="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 class="text-lg font-serif-heading font-bold text-stone-900 flex items-center gap-2">
              <i data-lucide="gift" class="w-5 h-5 text-amber-600"></i> Inventori Hadiah (Google BigQuery)
            </h3>
            <p class="text-xs text-stone-500">Ubah kuantiti dan baki stok yang diselaraskan serentak ke semua peranti.</p>
          </div>
          <button onclick="openAddGiftModal()" class="px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5">
            <i data-lucide="plus" class="w-4 h-4"></i> Tambah Hadiah Baru
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-stone-100 text-stone-700 border-b border-stone-200">
                <th class="p-3 font-bold">Jenis Hadiah</th>
                <th class="p-3 font-bold">Kuantiti Asal</th>
                <th class="p-3 font-bold">Baki Stok Semasa</th>
                <th class="p-3 font-bold">Ditebus</th>
                <th class="p-3 font-bold">Status Stok</th>
                <th class="p-3 font-bold text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody id="gifts-table-body" class="divide-y divide-stone-100">
              <tr>
                <td colspan="6" class="p-4 text-center text-stone-400">Memuatkan data hadiah dari BigQuery...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Section: Serahan Hadiah & Lookup Admin -->
      <div class="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
        <h3 class="text-lg font-serif-heading font-bold text-stone-900 flex items-center gap-2">
          <i data-lucide="check-square" class="w-5 h-5 text-emerald-600"></i> Serahan Hadiah Pelanggan
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input 
            type="text" 
            id="admin-claim-noakaun" 
            placeholder="No Akaun Pelanggan (cth: ACC-10023)"
            class="px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium outline-none"
          >
          <select id="admin-claim-gift-select" class="px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium outline-none">
            <option value="">-- Pilih Hadiah Diberikan --</option>
          </select>
          <button onclick="handleAdminClaimGift()" class="px-4 py-2.5 bg-purple-900 hover:bg-purple-950 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2">
            <i data-lucide="gift" class="w-4 h-4"></i> Sahkan Serahan Hadiah
          </button>
        </div>
      </div>

    </section>

  </main>

  <!-- ==================================================================== -->
  <!-- MODAL: PIN CODE SECURITY (ZERO SESSION STORAGE - STRICT AUTH) -->
  <!-- ==================================================================== -->
  <div id="pin-modal" class="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 hidden flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-5 animate-in fade-in zoom-in duration-150">
      
      <div class="flex items-center justify-between pb-3 border-b border-stone-100">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center">
            <i data-lucide="shield-alert" class="w-5 h-5 text-purple-800"></i>
          </div>
          <div>
            <h3 class="font-bold text-base text-stone-900">Pengesahan Kod PIN Admin</h3>
            <p class="text-[11px] text-stone-500">Wajib masukkan PIN setiap kali muat halaman</p>
          </div>
        </div>
        <button onclick="closeAdminPinModal()" class="text-stone-400 hover:text-stone-700">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <div class="space-y-3">
        <label class="block text-xs font-bold text-stone-700">Masukkan Kod PIN / Kata Laluan Rahsia:</label>
        <div class="relative">
          <input 
            type="password" 
            id="admin-pin-input" 
            placeholder="Kod PIN Superadmin (cth: jnolai@13813)" 
            class="w-full px-3.5 py-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-mono-code font-bold text-center tracking-widest focus:ring-2 focus:ring-purple-600 outline-none"
            onkeydown="if(event.key==='Enter') verifyAdminPin()"
          >
        </div>
        <p id="pin-error" class="hidden text-xs text-red-600 font-semibold"></p>
        <p class="text-[11px] text-stone-500">
          * Dasar keselamatan ketat: Sesi tidak disimpan di dalam pelayar untuk mengelakkan akses tanpa izin.
        </p>
      </div>

      <div class="flex items-center justify-end gap-2 pt-2">
        <button onclick="closeAdminPinModal()" class="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl">Batal</button>
        <button onclick="verifyAdminPin()" class="px-5 py-2 bg-purple-950 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5">
          <i data-lucide="key" class="w-3.5 h-3.5 text-amber-400"></i> Sahkan & Masuk
        </button>
      </div>

    </div>
  </div>

  <!-- JAVASCRIPT APP LOGIC -->
  <script>
    // Konfigurasi API
    const API_URL = '${apiUrl}';
    const API_KEY = '${apiKey}';

    // State Pengguna & Data Sementara (InMemory sahaja, tiada sessionStorage kekal untuk Admin)
    let currentAccount = null;
    let isAdminAuthenticated = false;
    let giftsData = [];

    // Inisialisasi Ikon Lucide
    document.addEventListener('DOMContentLoaded', () => {
      lucide.createIcons();
    });

    // Tab Switcher
    function showTab(tabId) {
      if (tabId === 'admin' && !isAdminAuthenticated) {
        openAdminPinModal();
        return;
      }
      document.getElementById('tab-lookup').classList.toggle('hidden', tabId !== 'lookup');
      document.getElementById('tab-admin').classList.toggle('hidden', tabId !== 'admin');
      
      const lookupBtn = document.getElementById('nav-lookup-btn');
      if (tabId === 'lookup') {
        lookupBtn.className = 'px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-stone-900 text-white shadow-xs';
      } else {
        lookupBtn.className = 'px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-white hover:bg-stone-100 text-stone-800 border border-stone-300';
      }
      lucide.createIcons();
    }

    // ====================================================================
    // BAHAGIAN 1: CARIAN & KEMASKINI PROFILE
    // ====================================================================
    async function executeAccountSearch() {
      const term = document.getElementById('search-input').value.trim();
      if (!term) {
        alert('Sila masukkan No. Akaun atau No. Kad Pengenalan.');
        return;
      }

      const loading = document.getElementById('search-loading');
      const card = document.getElementById('account-card');
      loading.classList.remove('hidden');
      card.classList.add('hidden');

      try {
        const res = await fetch(\`\${API_URL}?action=searchAccount&query=\${encodeURIComponent(term)}&apiKey=\${encodeURIComponent(API_KEY)}\`);
        const data = await res.json();
        loading.classList.add('hidden');

        if (data.success && data.found && data.account) {
          currentAccount = data.account;
          displayAccountData(data.account);
        } else {
          alert(data.message || 'Rekod akaun tidak dijumpai di dalam Google BigQuery.');
        }
      } catch (err) {
        loading.classList.add('hidden');
        alert('Ralat menyambung ke Google BigQuery API: ' + err.message);
      }
    }

    function displayAccountData(acc) {
      document.getElementById('res-nama').innerText = acc.nama || '-';
      document.getElementById('res-noakaun').innerText = acc.noAkaun || '-';
      document.getElementById('res-badge-category').innerText = acc.kategoriAkaun || 'Kediaman';
      document.getElementById('res-badge-status').innerText = acc.status || 'Aktif';
      
      const updatedBadge = document.getElementById('res-badge-updated');
      if (acc.telahDikemaskini) {
        updatedBadge.classList.remove('hidden');
      } else {
        updatedBadge.classList.add('hidden');
      }

      document.getElementById('edit-notel').value = acc.noTel || '';
      document.getElementById('edit-email').value = acc.email || '';

      const card = document.getElementById('account-card');
      card.classList.remove('hidden');
      lucide.createIcons();
    }

    async function handleCustomerUpdate(e) {
      e.preventDefault();
      if (!currentAccount) return;

      const newPhone = document.getElementById('edit-notel').value.trim();
      const newEmail = document.getElementById('edit-email').value.trim();

      const btn = document.getElementById('update-submit-btn');
      btn.disabled = true;
      btn.innerHTML = '<span>Sedang Mengemaskini BigQuery...</span>';

      try {
        const payload = {
          action: 'updateProfile',
          apiKey: API_KEY,
          account: {
            ...currentAccount,
            noTel: newPhone,
            email: newEmail,
          },
          changedFields: ['No Telefon / Email'],
          oldPhone: currentAccount.noTel,
          oldEmail: currentAccount.email,
          source: 'Portal Pelanggan (Cloudflare Pages)'
        };

        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i><span>Simpan & Sahkan Kemaskini</span>';

        if (data.success) {
          alert('Tahniah! Maklumat profil anda telah berjaya dikemaskini dan disegerakkan ke Google BigQuery.');
          document.getElementById('res-badge-updated').classList.remove('hidden');
          currentAccount.noTel = newPhone;
          currentAccount.email = newEmail;
          currentAccount.telahDikemaskini = true;
        } else {
          alert('Gagal mengemaskini: ' + (data.error || 'Ralat tidak diketahui'));
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i><span>Simpan & Sahkan Kemaskini</span>';
        alert('Ralat menghantar data: ' + err.message);
      }
      lucide.createIcons();
    }

    // ====================================================================
    // BAHAGIAN 2: KESELAMATAN PIN ADMIN & LIVE BIGQUERY SYNC
    // ====================================================================
    function openAdminPinModal() {
      document.getElementById('pin-error').classList.add('hidden');
      document.getElementById('admin-pin-input').value = '';
      document.getElementById('pin-modal').classList.remove('hidden');
      document.getElementById('admin-pin-input').focus();
    }

    function closeAdminPinModal() {
      document.getElementById('pin-modal').classList.add('hidden');
    }

    function verifyAdminPin() {
      const pin = document.getElementById('admin-pin-input').value.trim();
      const err = document.getElementById('pin-error');

      // Validasi Kod PIN (Superadmin: jnolai@13813 atau Admin: admin@13813)
      if (pin === 'jnolai@13813' || pin === 'admin@13813') {
        isAdminAuthenticated = true;
        closeAdminPinModal();
        showTab('admin');
        refreshAdminData();
      } else {
        err.innerText = 'Kod PIN / Kata Laluan tidak tepat. Sila cuba lagi.';
        err.classList.remove('hidden');
      }
    }

    function logoutAdmin() {
      isAdminAuthenticated = false;
      showTab('lookup');
      alert('Sesi Admin telah ditutup dengan selamat.');
    }

    async function refreshAdminData() {
      if (!isAdminAuthenticated) return;

      try {
        // Tarik Statistik
        const statsRes = await fetch(\`\${API_URL}?action=getStats&apiKey=\${encodeURIComponent(API_KEY)}\`);
        const statsData = await statsRes.json();
        if (statsData.success && statsData.stats) {
          document.getElementById('stat-total-accounts').innerText = statsData.stats.totalAccounts.toLocaleString();
          document.getElementById('stat-total-updated').innerText = statsData.stats.totalUpdated.toLocaleString();
          document.getElementById('stat-gifts-claimed').innerText = statsData.stats.totalGiftsClaimed.toLocaleString();
          document.getElementById('stat-remaining-stock').innerText = statsData.stats.totalRemainingStock.toLocaleString();
        }

        // Tarik Senarai Hadiah
        const giftsRes = await fetch(\`\${API_URL}?action=getGifts&apiKey=\${encodeURIComponent(API_KEY)}\`);
        const giftsDataRes = await giftsRes.json();
        if (giftsDataRes.success && giftsDataRes.gifts) {
          giftsData = giftsDataRes.gifts;
          renderGiftsTable(giftsData);
          populateGiftSelect(giftsData);
        }
      } catch (err) {
        console.error('Gagal menarik data admin dari BigQuery:', err);
      }
    }

    function renderGiftsTable(gifts) {
      const tbody = document.getElementById('gifts-table-body');
      if (!gifts || gifts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-stone-400">Tiada rekod hadiah didaftarkan di BigQuery.</td></tr>';
        return;
      }

      tbody.innerHTML = gifts.map(g => {
        const baki = g.bakiSemasa !== undefined ? g.bakiSemasa : g.kuantiti;
        const statusBadge = baki <= 0 
          ? '<span class="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px]">Habis Stok</span>'
          : (baki <= 10 
              ? '<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">Stok Rendah</span>'
              : '<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">Tersedia</span>');

        return \`
          <tr class="hover:bg-stone-50 transition-colors">
            <td class="p-3 font-bold text-stone-900">\${g.namaHadiah}</td>
            <td class="p-3 font-mono-code">\${g.kuantitiAsal || g.kuantiti} Unit</td>
            <td class="p-3 font-mono-code font-bold text-stone-900">\${baki} Unit</td>
            <td class="p-3 font-mono-code text-purple-700">\${g.jumlahDitebus || 0} Unit</td>
            <td class="p-3">\${statusBadge}</td>
            <td class="p-3 text-right">
              <button onclick="editGiftStock('\${g.id}', '\${g.namaHadiah}', \${baki})" class="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded text-[11px]">
                Kemaskini Baki
              </button>
            </td>
          </tr>
        \`;
      }).join('');
    }

    function populateGiftSelect(gifts) {
      const select = document.getElementById('admin-claim-gift-select');
      select.innerHTML = '<option value="">-- Pilih Hadiah Diberikan --</option>' + 
        gifts.map(g => \`<option value="\${g.id}">\${g.namaHadiah} (Baki: \${g.bakiSemasa !== undefined ? g.bakiSemasa : g.kuantiti})</option>\`).join('');
    }

    async function editGiftStock(giftId, giftName, currentBaki) {
      const newStock = prompt(\`Masukkan baki stok baharu untuk "\${giftName}":\`, currentBaki);
      if (newStock === null) return;
      const parsed = parseInt(newStock, 10);
      if (isNaN(parsed) || parsed < 0) {
        alert('Sila masukkan nombor kuantiti yang sah.');
        return;
      }

      try {
        const giftObj = giftsData.find(g => g.id === giftId);
        if (!giftObj) return;

        const payload = {
          action: 'saveGift',
          apiKey: API_KEY,
          gift: {
            ...giftObj,
            bakiSemasa: parsed
          }
        };

        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          alert('Baki stok hadiah telah berjaya dikemaskini dalam BigQuery!');
          refreshAdminData();
        } else {
          alert('Gagal: ' + data.error);
        }
      } catch (err) {
        alert('Ralat mengemaskini stok: ' + err.message);
      }
    }

    async function handleAdminClaimGift() {
      const noAkaun = document.getElementById('admin-claim-noakaun').value.trim();
      const giftSelect = document.getElementById('admin-claim-gift-select');
      const giftId = giftSelect.value;
      const giftName = giftSelect.options[giftSelect.selectedIndex]?.text || '';

      if (!noAkaun) {
        alert('Sila masukkan No. Akaun Pelanggan.');
        return;
      }

      try {
        const payload = {
          action: 'claimGift',
          apiKey: API_KEY,
          noAkaun: noAkaun,
          giftId: giftId,
          giftName: giftName
        };

        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
          alert('Penyerahan hadiah telah berjaya direkodkan dalam BigQuery dan stok telah diselaraskan!');
          document.getElementById('admin-claim-noakaun').value = '';
          refreshAdminData();
        } else {
          alert('Gagal merekodkan penyerahan: ' + data.error);
        }
      } catch (err) {
        alert('Ralat menyambung ke BigQuery: ' + err.message);
      }
    }

    async function openAddGiftModal() {
      const nama = prompt('Masukkan Nama / Jenis Hadiah Baharu:');
      if (!nama) return;
      const kuantitiStr = prompt('Masukkan Kuantiti Permulaan:', '50');
      const kuantiti = parseInt(kuantitiStr || '0', 10);
      if (isNaN(kuantiti) || kuantiti <= 0) return;

      try {
        const payload = {
          action: 'saveGift',
          apiKey: API_KEY,
          gift: {
            id: 'gift_' + new Date().getTime(),
            namaHadiah: nama,
            kuantiti: kuantiti,
            kuantitiAsal: kuantiti,
            bakiSemasa: kuantiti,
            jumlahDitebus: 0,
            tarikhDitambah: new Date().toISOString().slice(0, 10),
            catatan: 'Didaftarkan melalui Cloudflare Pages Admin'
          }
        };

        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          alert('Hadiah baharu berjaya didaftarkan ke dalam BigQuery!');
          refreshAdminData();
        }
      } catch (err) {
        alert('Ralat menambah hadiah: ' + err.message);
      }
    }
  </script>

</body>
</html>
`;
}

/**
 * 🎁 Hantar / Segerak Hadiah ke BigQuery (Apps Script API & REST API)
 */
export async function syncGiftToBigQuery(
  gift: GiftItem,
  customConfig?: BigQueryConfig
): Promise<boolean> {
  const config = customConfig || getStoredBigQueryConfig();
  if (!config.appsScriptUrl) {
    return false;
  }

  try {
    const payload = {
      action: 'saveGift',
      apiKey: config.apiKey || BIGQUERY_DEFAULT_API_KEY,
      gift: {
        id: gift.id,
        namaHadiah: gift.namaHadiah,
        kuantiti: gift.kuantiti,
        kuantitiAsal: gift.kuantitiAsal || gift.kuantiti,
        bakiSemasa: gift.bakiSemasa !== undefined ? gift.bakiSemasa : gift.kuantiti,
        jumlahDitebus: gift.jumlahDitebus || 0,
        tarikhDitambah: gift.tarikhDitambah || getMalaysiaDateTime(),
        catatan: gift.catatan || '',
      }
    };

    const res = await fetch(config.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.warn('[BigQueryService] syncGiftToBigQuery error:', err);
    return false;
  }
}

/**
 * 🗑️ Padam / Mansuhkan Hadiah dari BigQuery (Apps Script API)
 */
export async function deleteGiftFromBigQueryRemote(
  giftId: string,
  customConfig?: BigQueryConfig
): Promise<boolean> {
  const config = customConfig || getStoredBigQueryConfig();
  if (!config.appsScriptUrl) {
    return false;
  }

  try {
    const payload = {
      action: 'deleteGift',
      apiKey: config.apiKey || BIGQUERY_DEFAULT_API_KEY,
      giftId: giftId,
    };

    const res = await fetch(config.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.warn('[BigQueryService] deleteGiftFromBigQueryRemote error:', err);
    return false;
  }
}

/**
 * 📥 Dapatkan Senarai Hadiah Terkini dari BigQuery (Apps Script API)
 */
export async function fetchGiftsFromBigQueryRemote(
  customConfig?: BigQueryConfig
): Promise<GiftItem[]> {
  const config = customConfig || getStoredBigQueryConfig();
  if (!config.appsScriptUrl) {
    return [];
  }

  try {
    const url = `${config.appsScriptUrl}?action=getGifts&apiKey=${encodeURIComponent(config.apiKey || BIGQUERY_DEFAULT_API_KEY)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.success && Array.isArray(data.gifts)) {
      return data.gifts;
    }
  } catch (err) {
    console.warn('[BigQueryService] fetchGiftsFromBigQueryRemote error:', err);
  }
  return [];
}


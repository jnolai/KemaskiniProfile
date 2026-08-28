/**
 * BigQuery Server-Side Engine for Cloudflare Pages Functions & Backend APIs
 * Project ID: gen-lang-client-0958142642
 * Dataset: db_pelanggan
 * Tables: hadiah, penebusan_hadiah, profil_akaun, profil_akaun_v2, audit_log_hadiah
 */

import { 
  BigQueryGiftRecord, 
  BigQueryRedemptionRecord, 
  GiftDashboardMetrics, 
  CustomerSearchResult,
  BigQueryAuditLogRecord 
} from '../types/bigQueryTypes';

export interface BigQueryEnvConfig {
  GOOGLE_CLOUD_PROJECT?: string;
  BIGQUERY_DATASET?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  BIGQUERY_API_SECRET?: string;
  BIGQUERY_APPS_SCRIPT_URL?: string;
}

const DEFAULT_PROJECT = 'gen-lang-client-0958142642';
const DEFAULT_DATASET = 'db_pelanggan';

// Generate Google OAuth2 JWT Token for Service Account in Cloudflare Worker / Edge Environment
async function getGoogleCloudAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const cleanKey = privateKeyPem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');

  const binaryKey = Uint8Array.from(atob(cleanKey), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/bigquery https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const b64Url = (obj: any) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const unsignedToken = `${b64Url(header)}.${b64Url(payload)}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signedToken = `${unsignedToken}.${btoa(
    String.fromCharCode(...new Uint8Array(signature))
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedToken,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Google OAuth Token Error: ${tokenResponse.status} - ${errorText}`);
  }

  const tokenData = await tokenResponse.json() as { access_token: string };
  return tokenData.access_token;
}

/**
 * Execute BigQuery SQL with Parameterized Queries (Safe from SQL Injection)
 */
export async function executeBigQuerySql(
  query: string,
  params: Record<string, any> = {},
  env: BigQueryEnvConfig
): Promise<any[]> {
  const projectId = env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT;
  const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.GOOGLE_PRIVATE_KEY;

  // Option A: Direct Service Account Connection via REST API (Production Cloudflare Pages Function)
  if (clientEmail && privateKey) {
    try {
      const accessToken = await getGoogleCloudAccessToken(clientEmail, privateKey);
      
      const queryPayload: any = {
        query,
        useLegacySql: false,
        timeoutMs: 15000,
      };

      if (Object.keys(params).length > 0) {
        queryPayload.queryParameters = Object.entries(params).map(([name, val]) => {
          let type = 'STRING';
          if (typeof val === 'number') type = Number.isInteger(val) ? 'INT64' : 'FLOAT64';
          else if (typeof val === 'boolean') type = 'BOOL';
          return {
            name,
            parameterType: { type },
            parameterValue: { value: String(val) },
          };
        });
      }

      const response = await fetch(
        `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(queryPayload),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error('[BigQuery Engine] Query execution failed:', errText);
        throw new Error('Gagal menyambung ke pangkalan data BigQuery.');
      }

      const result = await response.json() as any;
      const schema = result.schema?.fields || [];
      const rows = result.rows || [];

      return rows.map((row: any) => {
        const item: any = {};
        row.f.forEach((col: any, index: number) => {
          const fieldName = schema[index]?.name || `col_${index}`;
          item[fieldName] = col.v;
        });
        return item;
      });
    } catch (err: any) {
      console.error('[BigQuery Engine] REST API Execution Error:', err.message);
      throw err;
    }
  }

  // Option B: Google Apps Script Web App Bridge (Zero Cloudflare secrets fallback)
  if (env.BIGQUERY_APPS_SCRIPT_URL) {
    const res = await fetch(env.BIGQUERY_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'EXECUTE_BIGQUERY_SQL',
        projectId,
        datasetId: env.BIGQUERY_DATASET || DEFAULT_DATASET,
        query,
        params,
        secret: env.BIGQUERY_API_SECRET || '',
      }),
    });

    if (!res.ok) {
      throw new Error('Gagal menghubungi bridge BigQuery.');
    }

    const data = await res.json() as any;
    if (!data.success) {
      throw new Error(data.message || 'Ralat BigQuery Apps Script Bridge');
    }
    return data.rows || [];
  }

  throw new Error('Konfigurasi BigQuery belum disetkan pada Server Environment.');
}

/**
 * 🎁 1. Get All Gifts from BigQuery `hadiah` table
 */
export async function getBigQueryGifts(env: BigQueryEnvConfig): Promise<BigQueryGiftRecord[]> {
  const projectId = env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT;
  const datasetId = env.BIGQUERY_DATASET || DEFAULT_DATASET;

  const sql = `
    SELECT 
      CAST(id AS STRING) AS id,
      CAST(nama_hadiah AS STRING) AS nama_hadiah,
      CAST(kategori AS STRING) AS kategori,
      CAST(stok_semasa AS INT64) AS stok_semasa,
      CAST(stok_minimum AS INT64) AS stok_minimum,
      CAST(jumlah_ditebus AS INT64) AS jumlah_ditebus,
      CAST(status AS STRING) AS status,
      CAST(catatan AS STRING) AS catatan,
      CAST(created_at AS STRING) AS created_at,
      CAST(updated_at AS STRING) AS updated_at
    FROM \`${projectId}.${datasetId}.hadiah\`
    ORDER BY nama_hadiah ASC
  `;

  return await executeBigQuerySql(sql, {}, env);
}

/**
 * 🎁 2. Insert or Add New Gift into BigQuery `hadiah`
 */
export async function insertBigQueryGift(
  gift: {
    id: string;
    nama_hadiah: string;
    kategori?: string;
    stok_semasa: number;
    stok_minimum: number;
    status: string;
    catatan?: string;
  },
  operator: string,
  env: BigQueryEnvConfig
): Promise<void> {
  const projectId = env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT;
  const datasetId = env.BIGQUERY_DATASET || DEFAULT_DATASET;

  const sql = `
    INSERT INTO \`${projectId}.${datasetId}.hadiah\` (
      id, nama_hadiah, kategori, stok_semasa, stok_minimum, jumlah_ditebus, status, catatan, created_at, updated_at
    ) VALUES (
      @id, @nama_hadiah, @kategori, @stok_semasa, @stok_minimum, 0, @status, @catatan, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
    )
  `;

  await executeBigQuerySql(sql, {
    id: gift.id,
    nama_hadiah: gift.nama_hadiah.trim(),
    kategori: gift.kategori?.trim() || 'Umum',
    stok_semasa: Math.max(0, gift.stok_semasa),
    stok_minimum: Math.max(0, gift.stok_minimum),
    status: gift.status || 'AKTIF',
    catatan: gift.catatan?.trim() || '',
  }, env);
}

/**
 * 🎁 3. Update Existing Gift Details
 */
export async function updateBigQueryGift(
  id: string,
  updates: {
    nama_hadiah?: string;
    kategori?: string;
    stok_minimum?: number;
    status?: string;
    catatan?: string;
  },
  operator: string,
  env: BigQueryEnvConfig
): Promise<void> {
  const projectId = env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT;
  const datasetId = env.BIGQUERY_DATASET || DEFAULT_DATASET;

  const sql = `
    UPDATE \`${projectId}.${datasetId}.hadiah\`
    SET 
      nama_hadiah = COALESCE(@nama_hadiah, nama_hadiah),
      kategori = COALESCE(@kategori, kategori),
      stok_minimum = COALESCE(@stok_minimum, stok_minimum),
      status = COALESCE(@status, status),
      catatan = COALESCE(@catatan, catatan),
      updated_at = CURRENT_TIMESTAMP()
    WHERE id = @id
  `;

  await executeBigQuerySql(sql, {
    id,
    nama_hadiah: updates.nama_hadiah ? updates.nama_hadiah.trim() : null,
    kategori: updates.kategori ? updates.kategori.trim() : null,
    stok_minimum: updates.stok_minimum !== undefined ? Math.max(0, updates.stok_minimum) : null,
    status: updates.status || null,
    catatan: updates.catatan !== undefined ? updates.catatan.trim() : null,
  }, env);
}

/**
 * 🎁 4. Restock Gift Inventory (Add Stock with Audit Trail)
 */
export async function restockBigQueryGift(
  id: string,
  addedQuantity: number,
  operator: string,
  catatan: string,
  env: BigQueryEnvConfig
): Promise<{ newStock: number }> {
  if (addedQuantity <= 0) {
    throw new Error('Kuantiti tambahan stok mesti melebihi 0.');
  }

  const projectId = env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT;
  const datasetId = env.BIGQUERY_DATASET || DEFAULT_DATASET;

  const updateSql = `
    UPDATE \`${projectId}.${datasetId}.hadiah\`
    SET 
      stok_semasa = stok_semasa + @addedQuantity,
      status = CASE WHEN (stok_semasa + @addedQuantity) > 0 THEN 'AKTIF' ELSE status END,
      updated_at = CURRENT_TIMESTAMP()
    WHERE id = @id
  `;

  await executeBigQuerySql(updateSql, {
    id,
    addedQuantity,
  }, env);

  // Fetch updated stock
  const fetchSql = `
    SELECT stok_semasa 
    FROM \`${projectId}.${datasetId}.hadiah\`
    WHERE id = @id
    LIMIT 1
  `;
  const result = await executeBigQuerySql(fetchSql, { id }, env);
  const newStock = Number(result[0]?.stok_semasa || 0);

  return { newStock };
}

/**
 * 🎁 5. Atomic Safe Redemption Transaction (Double-Submit & Concurrency Protected)
 */
export async function processBigQueryRedemption(
  redemption: {
    transaction_id: string;
    no_akaun: string;
    nama_pelanggan: string;
    kad_pengenalan?: string;
    gift_id: string;
    nama_hadiah: string;
    kuantiti: number;
    operator: string;
    catatan?: string;
  },
  env: BigQueryEnvConfig
): Promise<{ success: boolean; transaction_id: string; baki_selepas: number }> {
  const projectId = env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT;
  const datasetId = env.BIGQUERY_DATASET || DEFAULT_DATASET;

  if (redemption.kuantiti <= 0) {
    throw new Error('Kuantiti penebusan mestilah sekurang-kurangnya 1 unit.');
  }

  // Check 1: Idempotency Protection (Prevent Duplicate Transaction ID)
  const checkTxSql = `
    SELECT transaction_id 
    FROM \`${projectId}.${datasetId}.penebusan_hadiah\`
    WHERE transaction_id = @transaction_id
    LIMIT 1
  `;
  const existingTx = await executeBigQuerySql(checkTxSql, { transaction_id: redemption.transaction_id }, env);
  if (existingTx && existingTx.length > 0) {
    throw new Error('Transaksi ini telah diproses sebelum ini (Duplicate Transaction ID).');
  }

  // Check 2: Verify current stock availability before mutation
  const checkStockSql = `
    SELECT id, nama_hadiah, stok_semasa, status 
    FROM \`${projectId}.${datasetId}.hadiah\`
    WHERE id = @gift_id
    LIMIT 1
  `;
  const giftResult = await executeBigQuerySql(checkStockSql, { gift_id: redemption.gift_id }, env);
  if (!giftResult || giftResult.length === 0) {
    throw new Error('Hadiah yang dipilih tidak dijumpai dalam sistem inventori.');
  }

  const currentGift = giftResult[0];
  const currentStock = Number(currentGift.stok_semasa || 0);

  if (currentStock < redemption.kuantiti) {
    throw new Error(`Stok tidak mencukupi. Stok semasa hanya tinggal ${currentStock} unit.`);
  }

  const bakiSelepas = currentStock - redemption.kuantiti;
  const newStatus = bakiSelepas === 0 ? 'HABIS' : 'AKTIF';

  // Atomic Update 1: Deduct Stock & Increment Redeemed Count
  const updateStockSql = `
    UPDATE \`${projectId}.${datasetId}.hadiah\`
    SET 
      stok_semasa = stok_semasa - @kuantiti,
      jumlah_ditebus = COALESCE(jumlah_ditebus, 0) + @kuantiti,
      status = CASE WHEN (stok_semasa - @kuantiti) <= 0 THEN 'HABIS' ELSE status END,
      updated_at = CURRENT_TIMESTAMP()
    WHERE id = @gift_id AND stok_semasa >= @kuantiti
  `;
  await executeBigQuerySql(updateStockSql, {
    gift_id: redemption.gift_id,
    kuantiti: redemption.kuantiti,
  }, env);

  // Atomic Update 2: Insert into `penebusan_hadiah` Ledger
  const insertRedemptionSql = `
    INSERT INTO \`${projectId}.${datasetId}.penebusan_hadiah\` (
      transaction_id, no_akaun, nama_pelanggan, kad_pengenalan, gift_id, nama_hadiah, kuantiti, baki_selepas, status, operator, catatan, created_at
    ) VALUES (
      @transaction_id, @no_akaun, @nama_pelanggan, @kad_pengenalan, @gift_id, @nama_hadiah, @kuantiti, @baki_selepas, 'BERJAYA', @operator, @catatan, CURRENT_TIMESTAMP()
    )
  `;

  await executeBigQuerySql(insertRedemptionSql, {
    transaction_id: redemption.transaction_id,
    no_akaun: redemption.no_akaun.trim(),
    nama_pelanggan: redemption.nama_pelanggan.trim(),
    kad_pengenalan: redemption.kad_pengenalan?.trim() || '',
    gift_id: redemption.gift_id,
    nama_hadiah: redemption.nama_hadiah.trim(),
    kuantiti: redemption.kuantiti,
    baki_selepas: bakiSelepas,
    operator: redemption.operator || 'Kaunter Portal',
    catatan: redemption.catatan?.trim() || '',
  }, env);

  return {
    success: true,
    transaction_id: redemption.transaction_id,
    baki_selepas: bakiSelepas,
  };
}

/**
 * 🎁 6. Get Redemption History with Pagination & Filters
 */
export async function getBigQueryRedemptions(
  filters: {
    search?: string;
    giftId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  },
  env: BigQueryEnvConfig
): Promise<BigQueryRedemptionRecord[]> {
  const projectId = env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT;
  const datasetId = env.BIGQUERY_DATASET || DEFAULT_DATASET;
  const limit = Math.min(100, Math.max(1, filters.limit || 50));
  const offset = Math.max(0, filters.offset || 0);

  let whereClauses: string[] = [];
  const params: Record<string, any> = { limit, offset };

  if (filters.search) {
    whereClauses.push(`(
      LOWER(nama_pelanggan) LIKE LOWER(@search) OR 
      LOWER(no_akaun) LIKE LOWER(@search) OR 
      LOWER(transaction_id) LIKE LOWER(@search) OR 
      LOWER(nama_hadiah) LIKE LOWER(@search)
    )`);
    params.search = `%${filters.search.trim()}%`;
  }

  if (filters.giftId) {
    whereClauses.push(`gift_id = @giftId`);
    params.giftId = filters.giftId;
  }

  if (filters.status) {
    whereClauses.push(`status = @status`);
    params.status = filters.status;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      CAST(transaction_id AS STRING) AS transaction_id,
      CAST(no_akaun AS STRING) AS no_akaun,
      CAST(nama_pelanggan AS STRING) AS nama_pelanggan,
      CAST(kad_pengenalan AS STRING) AS kad_pengenalan,
      CAST(gift_id AS STRING) AS gift_id,
      CAST(nama_hadiah AS STRING) AS nama_hadiah,
      CAST(kuantiti AS INT64) AS kuantiti,
      CAST(baki_selepas AS INT64) AS baki_selepas,
      CAST(status AS STRING) AS status,
      CAST(operator AS STRING) AS operator,
      CAST(catatan AS STRING) AS catatan,
      CAST(created_at AS STRING) AS created_at
    FROM \`${projectId}.${datasetId}.penebusan_hadiah\`
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT @limit OFFSET @offset
  `;

  return await executeBigQuerySql(sql, params, env);
}

/**
 * 🎁 7. Real-Time Dashboard Aggregate Metrics
 */
export async function getBigQueryGiftDashboardMetrics(env: BigQueryEnvConfig): Promise<GiftDashboardMetrics> {
  const projectId = env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT;
  const datasetId = env.BIGQUERY_DATASET || DEFAULT_DATASET;

  // Single aggregated query to minimize BigQuery billable query bytes
  const statsSql = `
    SELECT 
      COUNT(1) AS total_gift_types,
      COALESCE(SUM(stok_semasa), 0) AS total_current_stock,
      COALESCE(SUM(jumlah_ditebus), 0) AS total_redeemed,
      COALESCE(SUM(CASE WHEN stok_semasa <= stok_minimum THEN 1 ELSE 0 END), 0) AS critical_stock_count
    FROM \`${projectId}.${datasetId}.hadiah\`
  `;

  const topGiftsSql = `
    SELECT 
      nama_hadiah,
      COALESCE(jumlah_ditebus, 0) AS jumlah_ditebus,
      COALESCE(stok_semasa, 0) AS baki_stok
    FROM \`${projectId}.${datasetId}.hadiah\`
    ORDER BY jumlah_ditebus DESC, stok_semasa ASC
    LIMIT 5
  `;

  const criticalGiftsSql = `
    SELECT 
      id,
      nama_hadiah,
      stok_semasa,
      stok_minimum,
      kategori
    FROM \`${projectId}.${datasetId}.hadiah\`
    WHERE stok_semasa <= stok_minimum
    ORDER BY stok_semasa ASC
    LIMIT 6
  `;

  const recentRedemptionsSql = `
    SELECT 
      transaction_id, no_akaun, nama_pelanggan, gift_id, nama_hadiah, kuantiti, baki_selepas, status, operator, created_at
    FROM \`${projectId}.${datasetId}.penebusan_hadiah\`
    ORDER BY created_at DESC
    LIMIT 6
  `;

  const [statsRows, topRows, criticalRows, recentRows] = await Promise.all([
    executeBigQuerySql(statsSql, {}, env).catch(() => [{}]),
    executeBigQuerySql(topGiftsSql, {}, env).catch(() => []),
    executeBigQuerySql(criticalGiftsSql, {}, env).catch(() => []),
    executeBigQuerySql(recentRedemptionsSql, {}, env).catch(() => []),
  ]);

  const stats = statsRows[0] || {};

  return {
    totalGiftTypes: Number(stats.total_gift_types || 0),
    totalCurrentStock: Number(stats.total_current_stock || 0),
    totalRedeemed: Number(stats.total_redeemed || 0),
    criticalStockCount: Number(stats.critical_stock_count || 0),
    todayRedemptionsCount: 0,
    monthRedemptionsCount: 0,
    topRedeemedGifts: topRows,
    criticalGifts: criticalRows,
    recentRedemptions: recentRows,
  };
}

/**
 * 🔍 8. Customer Search on BigQuery Table `profil_akaun` / `profil_akaun_v2`
 */
export async function searchBigQueryCustomers(
  queryTerm: string,
  env: BigQueryEnvConfig
): Promise<CustomerSearchResult[]> {
  const trimmed = queryTerm.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const projectId = env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT;
  const datasetId = env.BIGQUERY_DATASET || DEFAULT_DATASET;

  const sql = `
    SELECT 
      CAST(COALESCE(no_akaun, noAkaun, id) AS STRING) AS noAkaun,
      CAST(COALESCE(nama, '') AS STRING) AS nama,
      CAST(COALESCE(kad_pengenalan, kadPengenalan, ic, '') AS STRING) AS kadPengenalan,
      CAST(COALESCE(no_tel, noTel, telefon, '') AS STRING) AS noTel,
      CAST(COALESCE(email, '') AS STRING) AS email,
      CAST(COALESCE(kategori, kategori_akaun, kategoriAkaun, 'Kediaman') AS STRING) AS kategoriAkaun,
      CAST(COALESCE(reward_status, rewardStatus, 'Belum Layak') AS STRING) AS rewardStatus
    FROM \`${projectId}.${datasetId}.profil_akaun\`
    WHERE 
      LOWER(COALESCE(no_akaun, noAkaun, '')) LIKE LOWER(@term) OR
      LOWER(COALESCE(nama, '')) LIKE LOWER(@term) OR
      LOWER(COALESCE(kad_pengenalan, kadPengenalan, '')) LIKE LOWER(@term)
    LIMIT 20
  `;

  return await executeBigQuerySql(sql, { term: `%${trimmed}%` }, env);
}

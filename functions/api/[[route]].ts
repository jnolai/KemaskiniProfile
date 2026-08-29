/**
 * Cloudflare Pages Functions - Central API Router
 * Path: /api/*
 * Handles:
 *  - /api/hadiah (GET, POST)
 *  - /api/hadiah/:id (PATCH)
 *  - /api/hadiah/:id/stok (POST)
 *  - /api/hadiah/dashboard (GET)
 *  - /api/penebusan (GET, POST)
 *  - /api/pelanggan/search (GET)
 */

import {
  getBigQueryGifts,
  insertBigQueryGift,
  updateBigQueryGift,
  deleteBigQueryGift,
  restockBigQueryGift,
  processBigQueryRedemption,
  getBigQueryRedemptions,
  getBigQueryGiftDashboardMetrics,
  searchBigQueryCustomers,
  BigQueryEnvConfig
} from '../../src/services/bigQueryEngine';

export interface Env extends BigQueryEnvConfig {
  ADMIN_SECRET_KEY?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Content-Type': 'application/json',
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

function errorResponse(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: CORS_HEADERS,
    }
  );
}

export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // 1. GET /api/hadiah/dashboard - Dashboard Real-time Metrics
    if (pathname === '/api/hadiah/dashboard' && method === 'GET') {
      const metrics = await getBigQueryGiftDashboardMetrics(env);
      return jsonResponse({ success: true, data: metrics });
    }

    // 2. GET /api/pelanggan/search - Debounced Customer Search
    if (pathname === '/api/pelanggan/search' && method === 'GET') {
      const query = url.searchParams.get('q') || '';
      const customers = await searchBigQueryCustomers(query, env);
      return jsonResponse({ success: true, count: customers.length, data: customers });
    }

    // 3. GET /api/hadiah - Fetch All Inventory Gifts
    if (pathname === '/api/hadiah' && method === 'GET') {
      const gifts = await getBigQueryGifts(env);
      return jsonResponse({ success: true, count: gifts.length, data: gifts });
    }

    // 4. POST /api/hadiah - Add New Gift
    if (pathname === '/api/hadiah' && method === 'POST') {
      const body = await request.json() as any;
      if (!body.nama_hadiah || typeof body.nama_hadiah !== 'string') {
        return errorResponse('Nama hadiah wajib diisi.');
      }
      const giftId = body.id || `gift_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const operator = body.operator || 'Pentadbir eKemaskini';

      await insertBigQueryGift(
        {
          id: giftId,
          nama_hadiah: body.nama_hadiah,
          kategori: body.kategori || 'Umum',
          stok_semasa: Number(body.stok_semasa) || 0,
          stok_minimum: Number(body.stok_minimum) || 5,
          status: body.status || 'AKTIF',
          catatan: body.catatan || '',
        },
        operator,
        env
      );

      return jsonResponse({
        success: true,
        message: 'Hadiah berjaya ditambah ke dalam pangkalan data BigQuery.',
        id: giftId,
      }, 201);
    }

    // 5. POST /api/hadiah/:id/stok - Restock Inventory with Audit Trail
    const stockMatch = pathname.match(/^\/api\/hadiah\/([^/]+)\/stok$/);
    if (stockMatch && method === 'POST') {
      const giftId = decodeURIComponent(stockMatch[1]);
      const body = await request.json() as any;
      const quantity = Number(body.quantity || body.kuantiti || 0);
      const operator = body.operator || 'Pentadbir eKemaskini';
      const catatan = body.catatan || 'Penambahan stok manual';

      if (quantity <= 0) {
        return errorResponse('Kuantiti tambahan stok mestilah melebihi 0.');
      }

      const result = await restockBigQueryGift(giftId, quantity, operator, catatan, env);
      return jsonResponse({
        success: true,
        message: `Stok berjaya ditambah sebanyak ${quantity} unit.`,
        newStock: result.newStock,
      });
    }

    // 6. PATCH /api/hadiah/:id - Update Gift Details
    const giftDetailMatch = pathname.match(/^\/api\/hadiah\/([^/]+)$/);
    if (giftDetailMatch && method === 'PATCH') {
      const giftId = decodeURIComponent(giftDetailMatch[1]);
      const body = await request.json() as any;
      const operator = body.operator || 'Pentadbir eKemaskini';

      await updateBigQueryGift(
        giftId,
        {
          nama_hadiah: body.nama_hadiah,
          kategori: body.kategori,
          stok_minimum: body.stok_minimum !== undefined ? Number(body.stok_minimum) : undefined,
          status: body.status,
          catatan: body.catatan,
        },
        operator,
        env
      );

      return jsonResponse({
        success: true,
        message: 'Maklumat hadiah berjaya dikemaskini.',
      });
    }

    // 6b. DELETE /api/hadiah/:id - Delete / Mansuhkan Gift Record
    if (giftDetailMatch && method === 'DELETE') {
      const giftId = decodeURIComponent(giftDetailMatch[1]);
      const operator = url.searchParams.get('operator') || 'Super Admin';

      await deleteBigQueryGift(giftId, operator, env);

      return jsonResponse({
        success: true,
        message: 'Hadiah berjaya dimansuhkan daripada inventori BigQuery.',
        id: giftId,
      });
    }

    // 7. GET /api/penebusan - Redemption History
    if (pathname === '/api/penebusan' && method === 'GET') {
      const search = url.searchParams.get('search') || undefined;
      const giftId = url.searchParams.get('gift_id') || undefined;
      const status = url.searchParams.get('status') || undefined;
      const limit = Number(url.searchParams.get('limit')) || 50;
      const offset = Number(url.searchParams.get('offset')) || 0;

      const history = await getBigQueryRedemptions(
        { search, giftId, status, limit, offset },
        env
      );

      return jsonResponse({
        success: true,
        count: history.length,
        data: history,
      });
    }

    // 8. POST /api/penebusan - Safe Atomic Redemption (Anti Double-Submit)
    if (pathname === '/api/penebusan' && method === 'POST') {
      const body = await request.json() as any;

      if (!body.no_akaun || !body.nama_pelanggan || !body.gift_id || !body.nama_hadiah) {
        return errorResponse('Maklumat pelanggan dan hadiah tidak lengkap.');
      }

      const quantity = Math.max(1, Number(body.kuantiti || 1));
      const txId = body.transaction_id || `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const result = await processBigQueryRedemption(
        {
          transaction_id: txId,
          no_akaun: body.no_akaun,
          nama_pelanggan: body.nama_pelanggan,
          kad_pengenalan: body.kad_pengenalan,
          gift_id: body.gift_id,
          nama_hadiah: body.nama_hadiah,
          kuantiti: quantity,
          operator: body.operator || 'Pegawai Kaunter',
          catatan: body.catatan,
        },
        env
      );

      return jsonResponse({
        success: true,
        message: 'Penebusan hadiah berjaya diproses dan direkod ke dalam BigQuery.',
        transaction_id: result.transaction_id,
        baki_selepas: result.baki_selepas,
      });
    }

    return errorResponse('Endpoint API tidak dijumpai.', 404);
  } catch (err: any) {
    console.error(`[API Error ${pathname}]:`, err);
    return errorResponse(err.message || 'Maaf, transaksi tidak dapat diproses. Sila cuba semula.');
  }
}

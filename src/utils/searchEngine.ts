import { CustomerAccount } from '../types';

export interface IndexedAccount {
  account: CustomerAccount;
  // Pre-computed lowercase and normalized values for zero-allocation instant search
  normNoAkaun: string;
  alphaNoAkaun: string;
  normNama: string;
  normIC: string;
  alphaIC: string;
  normPhone: string;
  alphaPhone: string;
  normEmail: string;
  normReward: string;
  combinedSearchText: string;
}

export interface AccountSearchIndex {
  exactMap: Map<string, CustomerAccount>;
  alphaMap: Map<string, CustomerAccount>;
  indexedList: IndexedAccount[];
  totalCount: number;
}

/**
 * Normalizes an account query or account string:
 * - Trims whitespace
 * - Converts to lower case
 */
export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

/**
 * Strips all non-alphanumeric characters (spaces, hyphens, slashes) for fuzzy matching
 */
export function toAlphaNumeric(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Builds an ultra-fast O(1) in-memory index for tens of thousands of accounts.
 * This takes only a few milliseconds even on 100,000 records and caches tokens.
 */
export function buildAccountSearchIndex(accounts: CustomerAccount[]): AccountSearchIndex {
  const exactMap = new Map<string, CustomerAccount>();
  const alphaMap = new Map<string, CustomerAccount>();
  const indexedList: IndexedAccount[] = new Array(accounts.length);

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    const rawNo = acc.noAkaun || '';
    const normNo = rawNo.trim().toLowerCase();
    const alphaNo = normNo.replace(/[^a-z0-9]/g, '');

    const normNama = (acc.nama || '').trim().toLowerCase();
    const normIC = (acc.kadPengenalan || '').trim().toLowerCase();
    const alphaIC = normIC.replace(/[^a-z0-9]/g, '');
    const normPhone = (acc.noTel || '').trim().toLowerCase();
    const alphaPhone = normPhone.replace(/[^0-9]/g, '');
    const normEmail = (acc.email || '').trim().toLowerCase();
    const normReward = (acc.rewardCode || '').trim().toLowerCase();

    // Map lookups for instant O(1) lookup
    if (normNo) {
      if (!exactMap.has(normNo)) exactMap.set(normNo, acc);
    }
    if (alphaNo) {
      if (!alphaMap.has(alphaNo)) alphaMap.set(alphaNo, acc);
    }

    // Combined search blob for broad multi-field filtering
    const combined = `${normNo} ${alphaNo} ${normNama} ${normIC} ${alphaIC} ${normPhone} ${normEmail} ${normReward}`;

    indexedList[i] = {
      account: acc,
      normNoAkaun: normNo,
      alphaNoAkaun: alphaNo,
      normNama,
      normIC,
      alphaIC,
      normPhone,
      alphaPhone,
      normEmail,
      normReward,
      combinedSearchText: combined,
    };
  }

  return {
    exactMap,
    alphaMap,
    indexedList,
    totalCount: accounts.length,
  };
}

/**
 * Searches the index strictly for Account Number (e.g. for Customer Portal).
 * 1. Checks O(1) exact map
 * 2. Checks O(1) alphanumeric map
 * 3. Scans prefix / substring if no single exact match
 */
export function fastLookupByAccountNo(
  index: AccountSearchIndex,
  query: string,
  maxResults = 50
): {
  exactMatch: CustomerAccount | null;
  results: CustomerAccount[];
  isExact: boolean;
} {
  const normQ = normalizeQuery(query);
  if (!normQ) {
    return { exactMatch: null, results: [], isExact: false };
  }

  const alphaQ = toAlphaNumeric(normQ);

  // 1. Direct O(1) Exact Match
  const exact = index.exactMap.get(normQ);
  if (exact) {
    return { exactMatch: exact, results: [exact], isExact: true };
  }

  // 2. Direct O(1) Alphanumeric Match (e.g., handles dashes "ACC-12345" vs "acc12345")
  if (alphaQ) {
    const alphaExact = index.alphaMap.get(alphaQ);
    if (alphaExact) {
      return { exactMatch: alphaExact, results: [alphaExact], isExact: true };
    }
  }

  // 3. Fast Prefix & Substring Scan
  const results: CustomerAccount[] = [];
  const list = index.indexedList;
  const len = list.length;

  for (let i = 0; i < len; i++) {
    const item = list[i];
    if (item.normNoAkaun.includes(normQ) || (alphaQ.length >= 3 && item.alphaNoAkaun.includes(alphaQ))) {
      results.push(item.account);
      if (results.length >= maxResults) break;
    }
  }

  return {
    exactMatch: results.length === 1 ? results[0] : null,
    results,
    isExact: false,
  };
}

/**
 * Fast typeahead suggestions for instant live dropdown in Customer Portal.
 * Returns up to `limit` suggestions matching prefix or containing query.
 */
export function fastAccountSuggestions(
  index: AccountSearchIndex,
  query: string,
  limit = 6
): CustomerAccount[] {
  const normQ = normalizeQuery(query);
  if (!normQ || normQ.length < 2) return [];

  const alphaQ = toAlphaNumeric(normQ);
  const suggestions: CustomerAccount[] = [];
  const list = index.indexedList;
  const len = list.length;

  // Prioritize prefix matches first
  for (let i = 0; i < len; i++) {
    const item = list[i];
    if (item.normNoAkaun.startsWith(normQ) || (alphaQ && item.alphaNoAkaun.startsWith(alphaQ))) {
      suggestions.push(item.account);
      if (suggestions.length >= limit) return suggestions;
    }
  }

  // Then include substring matches if still under limit
  for (let i = 0; i < len; i++) {
    const item = list[i];
    if (!item.normNoAkaun.startsWith(normQ) && item.normNoAkaun.includes(normQ)) {
      suggestions.push(item.account);
      if (suggestions.length >= limit) return suggestions;
    }
  }

  return suggestions;
}

/**
 * High performance multi-field filter for Directory & Admin Views with No Line Limits
 */
export function fastFilterDirectory(
  index: AccountSearchIndex,
  searchQuery: string,
  statusFilter: string,
  categoryFilter: string,
  updateFilter: string,
  maxResults = 5000000
): CustomerAccount[] {
  const normQ = normalizeQuery(searchQuery);
  const alphaQ = toAlphaNumeric(normQ);
  const hasQuery = normQ.length > 0;

  const list = index.indexedList;
  const len = list.length;
  const filtered: CustomerAccount[] = [];

  for (let i = 0; i < len; i++) {
    const item = list[i];
    const acc = item.account;

    // Status Filter
    if (statusFilter !== 'Semua' && acc.status !== statusFilter) {
      continue;
    }

    // Category Filter
    if (categoryFilter !== 'Semua' && (acc.kategoriAkaun || 'Kediaman') !== categoryFilter) {
      continue;
    }

    // Update / Reward Filter
    if (updateFilter === 'Dikemaskini' && !acc.telahDikemaskini) continue;
    if (updateFilter === 'Asal' && acc.telahDikemaskini) continue;
    if (updateFilter === 'LayakHadiah' && acc.rewardStatus !== 'Layak (Belum Dituntut)') continue;
    if (updateFilter === 'HadiahDitebus' && acc.rewardStatus !== 'Telah Dituntut') continue;

    // Query Match
    if (hasQuery) {
      const matchNo = item.normNoAkaun.includes(normQ) || (alphaQ.length >= 3 && item.alphaNoAkaun.includes(alphaQ));
      const matchNama = item.normNama.includes(normQ);
      const matchIC = item.normIC.includes(normQ) || (alphaQ.length >= 4 && item.alphaIC.includes(alphaQ));
      const matchPhone = item.normPhone.includes(normQ) || (alphaQ.length >= 4 && item.alphaPhone.includes(alphaQ));
      const matchEmail = item.normEmail.includes(normQ);
      const matchReward = item.normReward.includes(normQ);

      if (!matchNo && !matchNama && !matchIC && !matchPhone && !matchEmail && !matchReward) {
        continue;
      }
    }

    filtered.push(acc);
    if (hasQuery && filtered.length >= maxResults) {
      break;
    }
  }

  return filtered;
}

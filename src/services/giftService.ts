import { doc, setDoc, deleteDoc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GiftItem } from '../types';
import { getMalaysiaDateTime } from '../utils/dateHelper';

export const STORAGE_GIFTS_KEY = 'customer_portal_gifts_inventory_v1';
const GIFTS_COLLECTION = 'gifts';

// Default initial sample gifts for demo & quick start
export const INITIAL_SAMPLE_GIFTS: GiftItem[] = [
  {
    id: 'gift-1',
    namaHadiah: 'Payung Eksklusif eKemaskini',
    kuantiti: 150,
    kuantitiAsal: 150,
    bakiSemasa: 150,
    jumlahDitebus: 0,
    tarikhDitambah: '2026-08-20 09:30',
    catatan: 'Hadiah pelanggan kemaskini kali pertama',
  },
  {
    id: 'gift-2',
    namaHadiah: 'Tumbler Stainless Steel Termos (500ml)',
    kuantiti: 200,
    kuantitiAsal: 200,
    bakiSemasa: 200,
    jumlahDitebus: 0,
    tarikhDitambah: '2026-08-21 11:15',
    catatan: 'Stok cawangan utama',
  },
  {
    id: 'gift-3',
    namaHadiah: 'Baucar Tunai / Diskaun RM10',
    kuantiti: 350,
    kuantitiAsal: 350,
    bakiSemasa: 350,
    jumlahDitebus: 0,
    tarikhDitambah: '2026-08-22 14:00',
    catatan: 'Kod e-baucar digital',
  },
  {
    id: 'gift-4',
    namaHadiah: 'Beg Kanvas Mesra Alam Edisi Khas',
    kuantiti: 100,
    kuantitiAsal: 100,
    bakiSemasa: 100,
    jumlahDitebus: 0,
    tarikhDitambah: '2026-08-23 16:45',
    catatan: 'Kempen Go-Green',
  }
];

/**
 * Get current stored gifts from localStorage with fallback to default samples
 */
export function getStoredGifts(): GiftItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_GIFTS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => {
          const initialQty = Number(item.kuantitiAsal) || Number(item.kuantiti) || 50;
          const currentBal = item.bakiSemasa !== undefined 
            ? Number(item.bakiSemasa) 
            : (item.kuantiti !== undefined ? Number(item.kuantiti) : initialQty);
          const claimed = item.jumlahDitebus !== undefined 
            ? Number(item.jumlahDitebus) 
            : Math.max(0, initialQty - currentBal);

          return {
            ...item,
            kuantiti: initialQty, // Bilangan asal kekal
            kuantitiAsal: initialQty,
            bakiSemasa: Math.max(0, currentBal),
            jumlahDitebus: Math.max(0, claimed),
          };
        });
      }
    }
  } catch (e) {
    console.warn('Error reading stored gifts:', e);
  }
  return INITIAL_SAMPLE_GIFTS;
}

/**
 * Save gifts to localStorage and dispatch local event
 */
export function saveGiftsLocally(gifts: GiftItem[]): void {
  try {
    const normalized = gifts.map((g) => {
      const initial = Number(g.kuantitiAsal) || Number(g.kuantiti) || 0;
      const baki = g.bakiSemasa !== undefined ? Number(g.bakiSemasa) : initial;
      const claimed = g.jumlahDitebus !== undefined ? Number(g.jumlahDitebus) : Math.max(0, initial - baki);
      return {
        ...g,
        kuantiti: initial, // Bilangan asal kekal
        kuantitiAsal: initial,
        bakiSemasa: Math.max(0, baki),
        jumlahDitebus: Math.max(0, claimed),
      };
    });
    localStorage.setItem(STORAGE_GIFTS_KEY, JSON.stringify(normalized));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('portal_gifts_updated', { detail: normalized }));
    }
  } catch (e) {
    console.warn('Could not save gifts to localStorage:', e);
  }
}

/**
 * Save single gift item to Firestore
 */
export async function saveGiftToFirestore(gift: GiftItem): Promise<void> {
  try {
    const initial = Number(gift.kuantitiAsal) || Number(gift.kuantiti) || 0;
    const baki = gift.bakiSemasa !== undefined ? Number(gift.bakiSemasa) : initial;
    const claimed = gift.jumlahDitebus !== undefined ? Number(gift.jumlahDitebus) : Math.max(0, initial - baki);

    const docRef = doc(db, GIFTS_COLLECTION, gift.id);
    await setDoc(docRef, {
      id: gift.id,
      namaHadiah: String(gift.namaHadiah || '').trim(),
      kuantiti: initial, // Bilangan asal kekal
      kuantitiAsal: initial,
      bakiSemasa: Math.max(0, baki),
      jumlahDitebus: Math.max(0, claimed),
      tarikhDitambah: gift.tarikhDitambah || getMalaysiaDateTime(),
      catatan: gift.catatan || '',
    }, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Could not save gift:', err);
  }
}

/**
 * Delete single gift item from Firestore
 */
export async function deleteGiftFromFirestore(giftId: string): Promise<void> {
  try {
    const docRef = doc(db, GIFTS_COLLECTION, giftId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('[Firestore] Could not delete gift:', err);
  }
}

/**
 * Subscribe to gifts from Firestore and/or Local Storage
 */
export function subscribeToGifts(
  callback: (gifts: GiftItem[]) => void
): () => void {
  // Fire initial stored data
  callback(getStoredGifts());

  // Listen for local tab events
  const handleLocalEvent = (e: Event) => {
    const custom = e as CustomEvent<GiftItem[]>;
    if (custom.detail) {
      callback(custom.detail);
    } else {
      callback(getStoredGifts());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('portal_gifts_updated', handleLocalEvent);
  }

  // Firestore real-time listener
  let unsubscribeFirestore = () => {};
  try {
    const colRef = collection(db, GIFTS_COLLECTION);
    unsubscribeFirestore = onSnapshot(
      colRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: GiftItem[] = [];
          snapshot.forEach((d) => {
            list.push(d.data() as GiftItem);
          });
          // Sort by added date or id
          list.sort((a, b) => (b.tarikhDitambah || '').localeCompare(a.tarikhDitambah || ''));
          saveGiftsLocally(list);
          callback(list);
        } else {
          // Cloud collection is empty: seed with default gifts so all browsers share the same initial list
          const initialGifts = getStoredGifts();
          initialGifts.forEach((g) => {
            saveGiftToFirestore(g).catch(() => {});
          });
          callback(initialGifts);
        }
      },
      (err) => {
        console.warn('[Firestore] Gifts listener fallback to local:', err?.message);
      }
    );
  } catch (err) {
    console.warn('[Firestore] Failed to attach gifts listener:', err);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('portal_gifts_updated', handleLocalEvent);
    }
    unsubscribeFirestore();
  };
}

/**
 * Deduct 1 unit from specified gift's inventory (by ID or exact name)
 * Returns remaining balance and details while keeping original total count intact
 */
export async function deductGiftStock(
  giftIdOrName: string,
  amount: number = 1
): Promise<{ success: boolean; giftName: string; remainingStock: number; giftItem?: GiftItem }> {
  const currentGifts = getStoredGifts();
  const trimmed = giftIdOrName.trim().toLowerCase();

  const targetIndex = currentGifts.findIndex(
    (g) => g.id.toLowerCase() === trimmed || g.namaHadiah.trim().toLowerCase() === trimmed
  );

  if (targetIndex === -1) {
    // If not found in current inventory, treat as custom gift with 0 remaining
    return {
      success: true,
      giftName: giftIdOrName,
      remainingStock: 0,
    };
  }

  const target = currentGifts[targetIndex];
  const initialQty = Number(target.kuantitiAsal) || Number(target.kuantiti) || 0;
  const currentBal = target.bakiSemasa !== undefined ? Number(target.bakiSemasa) : initialQty;
  const newBal = Math.max(0, currentBal - amount);
  const newClaimed = (target.jumlahDitebus || 0) + amount;

  const updatedGift: GiftItem = {
    ...target,
    kuantiti: initialQty, // Bilangan asal kekal
    kuantitiAsal: initialQty, // Bilangan asal kekal
    bakiSemasa: newBal, // Baki semasa yang tinggal
    jumlahDitebus: newClaimed, // Unit telah diserah
  };

  const updatedList = [...currentGifts];
  updatedList[targetIndex] = updatedGift;

  // Persist locally & cloud
  saveGiftsLocally(updatedList);
  saveGiftToFirestore(updatedGift).catch(console.warn);

  return {
    success: true,
    giftName: updatedGift.namaHadiah,
    remainingStock: newBal,
    giftItem: updatedGift,
  };
}

/**
 * Add a new gift to inventory
 */
export async function addNewGift(
  namaHadiah: string,
  kuantiti: number,
  catatan?: string
): Promise<GiftItem> {
  const formattedDate = getMalaysiaDateTime();

  const validQty = Math.max(0, Number(kuantiti) || 0);

  const newGift: GiftItem = {
    id: `gift-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    namaHadiah: namaHadiah.trim(),
    kuantiti: validQty, // Bilangan asal kekal
    kuantitiAsal: validQty,
    bakiSemasa: validQty, // Baki semasa awal sama dengan bilangan asal
    jumlahDitebus: 0,
    tarikhDitambah: formattedDate,
    catatan: catatan?.trim() || undefined,
  };

  const current = getStoredGifts();
  const updated = [newGift, ...current];

  saveGiftsLocally(updated);
  saveGiftToFirestore(newGift).catch(console.warn);

  return newGift;
}

/**
 * Remove gift by ID
 */
export async function removeGift(giftId: string): Promise<void> {
  const current = getStoredGifts();
  const updated = current.filter((g) => g.id !== giftId);
  saveGiftsLocally(updated);
  deleteGiftFromFirestore(giftId).catch(console.warn);
}

/**
 * Update existing gift
 */
export async function updateGiftItem(
  giftId: string,
  updates: Partial<GiftItem>
): Promise<void> {
  const current = getStoredGifts();
  const updated = current.map((g) => {
    if (g.id === giftId) {
      const newInitial = updates.kuantiti !== undefined 
        ? Number(updates.kuantiti) 
        : (updates.kuantitiAsal !== undefined ? Number(updates.kuantitiAsal) : (Number(g.kuantitiAsal) || Number(g.kuantiti)));
      const claimed = g.jumlahDitebus || 0;
      const newBaki = updates.bakiSemasa !== undefined 
        ? Number(updates.bakiSemasa) 
        : Math.max(0, newInitial - claimed);

      return {
        ...g,
        ...updates,
        kuantiti: newInitial, // Bilangan asal kekal
        kuantitiAsal: newInitial,
        bakiSemasa: newBaki,
      };
    }
    return g;
  });
  saveGiftsLocally(updated);

  const target = updated.find((g) => g.id === giftId);
  if (target) {
    saveGiftToFirestore(target).catch(console.warn);
  }
}

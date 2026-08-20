import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  Firestore 
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Firebase configuration
const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
  measurementId: firebaseConfigJson.measurementId,
};

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with custom Database ID & robust long-polling connection settings
const rawConfig = firebaseConfigJson as Record<string, any>;
const databaseId = rawConfig.firestoreDatabaseId && rawConfig.firestoreDatabaseId !== '(default)'
  ? rawConfig.firestoreDatabaseId
  : undefined;

function createFirestoreInstance(): Firestore {
  try {
    const settings: any = {
      experimentalAutoDetectLongPolling: true,
    };
    
    // Configure multi-tab persistent offline cache if available in browser
    if (typeof window !== 'undefined') {
      try {
        settings.localCache = persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        });
      } catch {
        // Fallback to default cache if indexeddb is restricted
      }
    }

    if (databaseId) {
      return initializeFirestore(app, settings, databaseId);
    }
    return initializeFirestore(app, settings);
  } catch (e) {
    // If already initialized or error, fallback to getFirestore
    return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }
}

export const db: Firestore = createFirestoreInstance();

export const googleOAuthClientId = firebaseConfigJson.oAuthClientId || '';

export const isFirebaseReady = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);


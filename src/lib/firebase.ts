import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
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

// Initialize Firestore with custom Database ID if present
const rawConfig = firebaseConfigJson as Record<string, any>;
const databaseId = rawConfig.firestoreDatabaseId && rawConfig.firestoreDatabaseId !== '(default)'
  ? rawConfig.firestoreDatabaseId
  : undefined;

export const db: Firestore = databaseId 
  ? getFirestore(app, databaseId) 
  : getFirestore(app);

export const googleOAuthClientId = firebaseConfigJson.oAuthClientId || '';

export const isFirebaseReady = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);

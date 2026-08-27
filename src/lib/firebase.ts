import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfigJson) : getApp();

// Initialize Firestore with custom Database ID if specified
const dbId = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== '(default)'
  ? firebaseConfigJson.firestoreDatabaseId
  : undefined;

export const db: Firestore = dbId ? getFirestore(app, dbId) : getFirestore(app);
export const auth: Auth = getAuth(app);

export const googleOAuthClientId = firebaseConfigJson.oAuthClientId || '';
export const isFirebaseReady = Boolean(firebaseConfigJson.projectId && firebaseConfigJson.apiKey);



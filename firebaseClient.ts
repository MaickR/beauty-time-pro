// @ts-nocheck — Archivo legado, migración pendiente en Fase 6. Tipado completo en refactor de servicios.
import { initializeApp as initializeFirebaseApp } from 'firebase/app';
import {
  getFirestore as getFirebaseFirestore,
  collection as firebaseCollection,
  doc as firebaseDoc,
  setDoc as firebaseSetDoc,
  onSnapshot as firebaseOnSnapshot,
  deleteDoc as firebaseDeleteDoc,
  addDoc as firebaseAddDoc,
  updateDoc as firebaseUpdateDoc,
  getDocs as firebaseGetDocs,
} from 'firebase/firestore';
import {
  getAuth as getFirebaseAuth,
  signInAnonymously as firebaseSignInAnonymously,
  signInWithCustomToken as firebaseSignInWithCustomToken,
  onAuthStateChanged as firebaseOnAuthStateChanged,
} from 'firebase/auth';

const STORAGE_KEY = 'agenda-spa-local-db-v1';
const listeners = new Map();
const authListeners = new Set();
let localAuthState = { currentUser: null };

const clone = (value) => JSON.parse(JSON.stringify(value));

const isPlaceholderFirebaseConfig = (config) => {
  if (!config) return true;
  const requiredValues = [
    config.apiKey,
    config.authDomain,
    config.projectId,
    config.storageBucket,
    config.messagingSenderId,
    config.appId,
  ];

  return requiredValues.some(
    (value) => !value || String(value).includes('TU_') || String(value).includes('tu_')
  );
};

const readStore = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { docs: {} };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed.docs ? parsed : { docs: {} };
  } catch {
    return { docs: {} };
  }
};

const writeStore = (store) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};

const createSnapshot = (collectionPath) => {
  const store = readStore();
  const prefix = `${collectionPath}/`;
  const docs = Object.entries(store.docs)
    .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
    .map(([path, data]) => {
      const id = path.slice(prefix.length);
      return {
        id,
        data: () => clone(data),
      };
    });

  return { docs };
};

const notifyCollection = (collectionPath) => {
  const callbacks = listeners.get(collectionPath);
  if (!callbacks) return;
  const snapshot = createSnapshot(collectionPath);
  callbacks.forEach((callback) => callback(snapshot));
};

const notifyDocChange = (docPath) => {
  const collectionPath = docPath.split('/').slice(0, -1).join('/');
  notifyCollection(collectionPath);
};

const createLocalCollectionRef = (segments) => ({
  __local: true,
  type: 'collection',
  path: segments.join('/'),
});

const createLocalDocRef = (segments) => ({
  __local: true,
  type: 'doc',
  path: segments.join('/'),
  id: segments[segments.length - 1],
});

const ensureLocalAuthUser = () => {
  if (!localAuthState.currentUser) {
    localAuthState.currentUser = {
      uid: `local-user-${Date.now()}`,
      isAnonymous: true,
      providerId: 'local',
    };
  }
  return localAuthState.currentUser;
};

const emitAuthState = () => {
  const user = ensureLocalAuthUser();
  authListeners.forEach((callback) => callback(user));
};

export const initializeApp = (config) => {
  if (isPlaceholderFirebaseConfig(config)) {
    return { __local: true, config };
  }
  return initializeFirebaseApp(config);
};

export const getFirestore = (app) => {
  if (app?.__local) {
    return { __local: true, app };
  }
  return getFirebaseFirestore(app);
};

export const collection = (db, ...segments) => {
  if (db?.__local) {
    return createLocalCollectionRef(segments);
  }
  return firebaseCollection(db, ...segments);
};

export const doc = (db, ...segments) => {
  if (db?.__local) {
    return createLocalDocRef(segments);
  }
  return firebaseDoc(db, ...segments);
};

export const setDoc = async (docRef, data) => {
  if (!docRef?.__local) {
    return firebaseSetDoc(docRef, data);
  }

  const store = readStore();
  store.docs[docRef.path] = clone(data);
  writeStore(store);
  notifyDocChange(docRef.path);
};

export const addDoc = async (collectionRef, data) => {
  if (!collectionRef?.__local) {
    return firebaseAddDoc(collectionRef, data);
  }

  const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const docRef = createLocalDocRef([...collectionRef.path.split('/'), id]);
  await setDoc(docRef, { ...data, id: data?.id ?? id });
  return docRef;
};

export const updateDoc = async (docRef, data) => {
  if (!docRef?.__local) {
    return firebaseUpdateDoc(docRef, data);
  }

  const store = readStore();
  const current = store.docs[docRef.path] || {};
  store.docs[docRef.path] = { ...current, ...clone(data) };
  writeStore(store);
  notifyDocChange(docRef.path);
};

export const deleteDoc = async (docRef) => {
  if (!docRef?.__local) {
    return firebaseDeleteDoc(docRef);
  }

  const store = readStore();
  delete store.docs[docRef.path];
  writeStore(store);
  notifyDocChange(docRef.path);
};

export const getDocs = async (collectionRef) => {
  if (!collectionRef?.__local) {
    return firebaseGetDocs(collectionRef);
  }
  return createSnapshot(collectionRef.path);
};

export const onSnapshot = (ref, callback) => {
  if (!ref?.__local) {
    return firebaseOnSnapshot(ref, callback);
  }

  const key = ref.path;
  const bucket = listeners.get(key) || new Set();
  bucket.add(callback);
  listeners.set(key, bucket);
  callback(createSnapshot(key));

  return () => {
    const current = listeners.get(key);
    if (!current) return;
    current.delete(callback);
    if (current.size === 0) {
      listeners.delete(key);
    }
  };
};

export const getAuth = (app) => {
  if (app?.__local) {
    return { __local: true, app };
  }
  return getFirebaseAuth(app);
};

export const signInAnonymously = async (auth) => {
  if (!auth?.__local) {
    return firebaseSignInAnonymously(auth);
  }
  const user = ensureLocalAuthUser();
  emitAuthState();
  return { user };
};

export const signInWithCustomToken = async (auth, token) => {
  if (!auth?.__local) {
    return firebaseSignInWithCustomToken(auth, token);
  }
  localAuthState.currentUser = {
    uid: token || `local-user-${Date.now()}`,
    isAnonymous: false,
    providerId: 'custom',
  };
  emitAuthState();
  return { user: localAuthState.currentUser };
};

export const onAuthStateChanged = (auth, callback) => {
  if (!auth?.__local) {
    return firebaseOnAuthStateChanged(auth, callback);
  }

  authListeners.add(callback);
  queueMicrotask(() => callback(ensureLocalAuthUser()));

  return () => {
    authListeners.delete(callback);
  };
};

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  listeners.forEach((_callbacks, collectionPath) => {
    notifyCollection(collectionPath);
  });
});

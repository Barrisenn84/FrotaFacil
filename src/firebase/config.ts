import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, enableIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// CRITICAL: Connect to configured database instance
export const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

// Ativa a persistência local com Firestore usando IndexedDB para operação contínua offline
export let persistenceActive = false;
export const persistencePromise: Promise<void> | null =
  typeof window !== 'undefined'
    ? enableIndexedDbPersistence(db)
        .then(() => {
          persistenceActive = true;
          console.info('Persistência local do Firestore (IndexedDB) ativada com sucesso.');
        })
        .catch((err: any) => {
          if (err?.code === 'failed-precondition') {
            console.warn(
              'Persistência offline do Firestore: múltiplas abas abertas simultaneamente (apenas uma aba gerencia o cache IndexedDB).'
            );
          } else if (err?.code === 'unimplemented') {
            console.warn('Persistência offline do Firestore não suportada pelo navegador atual.');
          } else {
            console.warn('Aviso ao inicializar persistência IndexedDB do Firestore:', err?.message || err);
          }
        })
    : null;

// Google Auth Provider for Sign-In (no restricted Google Workspace scopes, accessible to all users)
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Dedicated Google Sheets Provider for Workspace Sync (requires explicit spreadsheet permission)
export const googleSheetsProvider = new GoogleAuthProvider();
googleSheetsProvider.setCustomParameters({
  prompt: 'consent',
});
googleSheetsProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleSheetsProvider.addScope('https://www.googleapis.com/auth/drive.file');

// In-memory token cache (MUST NOT be in localStorage/sessionStorage)
let inMemoryAccessToken: string | null = null;

export function setInMemoryAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getInMemoryAccessToken(): string | null {
  return inMemoryAccessToken;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Info: ', JSON.stringify(errInfo));
  return errInfo;
}

// CRITICAL CONSTRAINT: Test connection on boot
export async function testConnection() {
  try {
    if (persistencePromise) {
      await persistencePromise.catch(() => {});
    }
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    // Non-blocking connection check on startup
  }
}
testConnection();

export { signInWithPopup, fbSignOut };

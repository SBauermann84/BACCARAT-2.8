import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, persistentLocalCache, doc, getDocFromServer, setLogLevel } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

let app: any = null;
let db: any = null;
let auth: any = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  
  // Silenciar logs e alertas de indisponibilidade de rede do SDK
  setLogLevel('silent');

  // Inicialização com cache local offline persistente para suportar operação offline impecável
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({})
  }, firebaseConfig.firestoreDatabaseId);
  
  auth = getAuth(app);

  // Validação assíncrona não-bloqueante e segura de conexão
  if (typeof window !== 'undefined' && navigator.onLine) {
    setTimeout(async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch {
        // Modo offline resiliente ativo automaticamente pelo SDK
      }
    }, 1000);
  }
} catch (error) {
  try {
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
  } catch (fbError) {
    console.warn("Firestore em modo offline local:", fbError);
  }
}

export { app, db, auth };

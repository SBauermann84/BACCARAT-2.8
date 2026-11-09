import { GameResult, GameType } from '../types';
import { db, auth } from '../lib/firebase';
import { collection, doc, setDoc, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';
import { safeStorage } from '../utils/safeStorage';

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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}


export interface DailyStatsRecord {
  id: string; // gameType_date_opNumber
  date: string; // YYYY-MM-DD
  gameType: GameType;
  initialBalance: number;
  finalBalance: number;
  netProfit: number;
  netLoss: number;
  totalOperations: number;
  winsCount: number;
  lossesCount: number;
  winPercentage: number;
  lossPercentage: number;
  totalRecoveries: number;
  recoveriesGale1: number;
  recoveriesGale2: number;
  recoveriesGale3: number;
  recoveriesGale4: number;
  recoveriesGale5: number;
  recoveriesUpperLevels: number;
  maxGaleUsed: number;
  avgGalePerOperation: number;
  winsNoGale: number;
  redsCount: number;
  maxWinStreak: number;
  maxLossStreak: number;
  totalDurationMs: number;
  formattedDuration: string;
  notes: string;
  lastUpdated: number;
  archivedOperations?: GameResult[];
  operationNumber?: number;
}

export const dailyStatsService = {
  onSyncCallback: null as ((records: DailyStatsRecord[]) => void) | null,

  registerSyncCallback(callback: (records: DailyStatsRecord[]) => void) {
    this.onSyncCallback = callback;
  },

  // Helper to format duration in milliseconds to a readable string (e.g., "2h 15m")
  formatDuration(ms: number): string {
    if (ms <= 0) return '0m';
    const totalMinutes = Math.floor(ms / (1000 * 60));
    if (totalMinutes < 60) {
      return `${totalMinutes}m`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  },

  // Calculate statistics from operations list of a specific day
  calculateDailyStats(
    date: string,
    gameType: GameType,
    dayOps: GameResult[],
    initialBalance: number,
    finalBalance: number,
    notes: string = "",
    maxGaleLevels: number = 3,
    operationNumber?: number
  ): DailyStatsRecord {
    // Sort oldest first for chronological accuracy
    const chronologicalOps = [...dayOps]
      .filter(h => h.isWin !== undefined)
      .sort((a, b) => a.timestamp - b.timestamp);

    const totalOperations = chronologicalOps.length;
    const winsCount = chronologicalOps.filter(h => h.isWin === true).length;
    const lossesCount = chronologicalOps.filter(h => h.isWin === false).length;

    const winPercentage = totalOperations > 0 ? Number(((winsCount / totalOperations) * 100).toFixed(2)) : 0;
    const lossPercentage = totalOperations > 0 ? Number(((lossesCount / totalOperations) * 100).toFixed(2)) : 0;

    // Gale simulation/analysis
    let currentGaleLevel = 0;
    const galesUsed: number[] = [];
    
    let recoveriesGale1 = 0;
    let recoveriesGale2 = 0;
    let recoveriesGale3 = 0;
    let recoveriesGale4 = 0;
    let recoveriesGale5 = 0;
    let recoveriesUpperLevels = 0;
    let winsNoGale = 0;
    let redsCount = 0;

    for (const h of chronologicalOps) {
      galesUsed.push(currentGaleLevel);

      if (h.isWin === true) {
        if (currentGaleLevel === 0) {
          winsNoGale++;
        } else if (currentGaleLevel === 1) {
          recoveriesGale1++;
        } else if (currentGaleLevel === 2) {
          recoveriesGale2++;
        } else if (currentGaleLevel === 3) {
          recoveriesGale3++;
        } else if (currentGaleLevel === 4) {
          recoveriesGale4++;
        } else if (currentGaleLevel === 5) {
          recoveriesGale5++;
        } else {
          recoveriesUpperLevels++;
        }
        currentGaleLevel = 0; // reset
      } else {
        if (currentGaleLevel >= maxGaleLevels - 1) {
          redsCount++;
          currentGaleLevel = 0; // reset on Red (progression lost)
        } else {
          currentGaleLevel++;
        }
      }
    }

    const totalRecoveries = recoveriesGale1 + recoveriesGale2 + recoveriesGale3 + recoveriesGale4 + recoveriesGale5 + recoveriesUpperLevels;
    const maxGaleUsed = galesUsed.length > 0 ? Math.max(...galesUsed) : 0;
    const avgGalePerOperation = galesUsed.length > 0 
      ? Number((galesUsed.reduce((sum, g) => sum + g, 0) / galesUsed.length).toFixed(2))
      : 0;

    // Streak calculations
    let maxWinStreak = 0;
    let currentWinStreak = 0;
    let maxLossStreak = 0;
    let currentLossStreak = 0;

    for (const h of chronologicalOps) {
      if (h.isWin === true) {
        currentWinStreak++;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        currentLossStreak = 0;
      } else {
        currentLossStreak++;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
        currentWinStreak = 0;
      }
    }

    // Duration calculation
    let totalDurationMs = 0;
    if (chronologicalOps.length >= 2) {
      const firstTime = chronologicalOps[0].timestamp;
      const lastTime = chronologicalOps[chronologicalOps.length - 1].timestamp;
      totalDurationMs = Math.max(0, lastTime - firstTime);
    }

    const netProfit = finalBalance > initialBalance ? Number((finalBalance - initialBalance).toFixed(2)) : 0;
    const netLoss = finalBalance < initialBalance ? Number((initialBalance - finalBalance).toFixed(2)) : 0;

    const suffix = operationNumber !== undefined ? `op${operationNumber}` : `ts${Date.now()}`;
    const recordId = `${gameType}_${date}_${suffix}`;

    return {
      id: recordId,
      date,
      gameType,
      initialBalance: Number(initialBalance.toFixed(2)),
      finalBalance: Number(finalBalance.toFixed(2)),
      netProfit,
      netLoss,
      totalOperations,
      winsCount,
      lossesCount,
      winPercentage,
      lossPercentage,
      totalRecoveries,
      recoveriesGale1,
      recoveriesGale2,
      recoveriesGale3,
      recoveriesGale4,
      recoveriesGale5,
      recoveriesUpperLevels,
      maxGaleUsed,
      avgGalePerOperation,
      winsNoGale,
      redsCount,
      maxWinStreak,
      maxLossStreak,
      totalDurationMs,
      formattedDuration: this.formatDuration(totalDurationMs),
      notes,
      lastUpdated: Date.now(),
      archivedOperations: chronologicalOps,
      operationNumber
    };
  },

  // Save record permanently (Dual: Firestore + LocalStorage fallback)
  async saveDailyStats(record: DailyStatsRecord): Promise<void> {
    const localKey = 'casino_daily_stats_v1';
    
    // 1. Save to LocalStorage for safety and instant rendering
    try {
      const stored = safeStorage.getItem(localKey);
      const recordsMap = stored ? JSON.parse(stored) : {};
      recordsMap[record.id] = record;
      safeStorage.setItem(localKey, JSON.stringify(recordsMap));
    } catch (err) {
      console.error("Erro ao salvar estatísticas no localStorage:", err);
    }

    // 2. Save to cloud Firestore if connected (background non-blocking)
    if (db) {
      const pathForWrite = `dailyStats/${record.id}`;
      (async () => {
        try {
          const docRef = doc(db, 'dailyStats', record.id);
          await setDoc(docRef, record);
          console.log(`Estatísticas de ${record.date} (${record.gameType}) salvas em nuvem no Firestore.`);
        } catch (err) {
          console.warn(`Erro de Firestore ao salvar estatísticas em ${pathForWrite}:`, err);
        }
      })();
    }
  },

  // Fetch all saved daily stats
  async getAllDailyStats(): Promise<DailyStatsRecord[]> {
    const localKey = 'casino_daily_stats_v1';
    
    // Load local stats first
    let localRecords: DailyStatsRecord[] = [];
    try {
      const stored = safeStorage.getItem(localKey);
      if (stored) {
        const recordsMap = JSON.parse(stored);
        localRecords = Object.values(recordsMap);
      }
    } catch (err) {
      console.error("Erro ao ler localStorage:", err);
    }

    // Sync / Load from cloud if available (background non-blocking)
    if (db) {
      const pathForGetDocs = 'dailyStats';
      (async () => {
        try {
          const querySnapshot = await getDocs(query(collection(db, 'dailyStats'), orderBy('date', 'desc')));
          const cloudRecords: DailyStatsRecord[] = [];
          querySnapshot.forEach((docSnap) => {
            cloudRecords.push(docSnap.data() as DailyStatsRecord);
          });

          if (cloudRecords.length > 0) {
            const storedNow = safeStorage.getItem(localKey);
            const currentLocal = storedNow ? JSON.parse(storedNow) : {};
            let hasChanged = false;

            // Merge local and cloud, cloud taking preference by lastUpdated timestamp
            cloudRecords.forEach(r => {
              if (!currentLocal[r.id] || (r.lastUpdated || 0) > (currentLocal[r.id].lastUpdated || 0)) {
                currentLocal[r.id] = r;
                hasChanged = true;
              }
            });

            if (hasChanged) {
              try {
                safeStorage.setItem(localKey, JSON.stringify(currentLocal));
              } catch (e) {
                console.error("Erro de sincronização local de estatísticas:", e);
              }

              const finalRecords = Object.values(currentLocal) as DailyStatsRecord[];
              const sortedRecords = finalRecords.sort((a, b) => b.date.localeCompare(a.date));
              
              if (this.onSyncCallback) {
                this.onSyncCallback(sortedRecords);
              }
            }
          }
        } catch (err) {
          console.warn(`Aviso de leitura no Firestore em segundo plano (${pathForGetDocs}):`, err);
        }
      })();
    }

    return localRecords.sort((a, b) => b.date.localeCompare(a.date));
  },

  // Delete a single daily stats record
  async deleteDailyStatsRecord(recordId: string): Promise<void> {
    const localKey = 'casino_daily_stats_v1';
    try {
      const stored = safeStorage.getItem(localKey);
      if (stored) {
        const recordsMap = JSON.parse(stored);
        delete recordsMap[recordId];
        safeStorage.setItem(localKey, JSON.stringify(recordsMap));
      }
    } catch (err) {
      console.error("Erro ao deletar estatística local:", err);
    }

    if (db) {
      const pathForDelete = `dailyStats/${recordId}`;
      (async () => {
        try {
          const docRef = doc(db, 'dailyStats', recordId);
          await deleteDoc(docRef);
          console.log(`Estatística ${recordId} excluída em nuvem no Firestore.`);
        } catch (err) {
          console.warn(`Erro ao deletar no Firestore (${pathForDelete}):`, err);
        }
      })();
    }
  },

  // Clear all saved daily stats
  async clearAllDailyStats(): Promise<void> {
    const localKey = 'casino_daily_stats_v1';
    try {
      localStorage.removeItem(localKey);
    } catch (err) {
      console.error("Erro ao limpar estatísticas locais:", err);
    }

    if (db) {
      const pathForDelete = 'dailyStats';
      (async () => {
        try {
          const querySnapshot = await getDocs(collection(db, 'dailyStats'));
          const deletePromises: Promise<void>[] = [];
          querySnapshot.forEach((docSnap) => {
            deletePromises.push(deleteDoc(docSnap.ref));
          });
          await Promise.all(deletePromises);
          console.log("Todas as estatísticas diárias em nuvem no Firestore foram excluídas.");
        } catch (err) {
          console.warn(`Erro ao limpar Firestore (${pathForDelete}):`, err);
        }
      })();
    }
  }
};

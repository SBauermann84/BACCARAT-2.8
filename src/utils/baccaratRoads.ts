export interface BaccaratHistoryItem {
  result: string | number;
}

export type BaccaratOutcome = 'P' | 'B' | 'T';

export interface BigRoadCell {
  winner: 'P' | 'B';
  tieCount: number;
  row: number;
  col: number;
}

export interface DerivedRoadCell {
  color: 'RED' | 'BLUE';
  row: number;
  col: number;
}

/**
 * Normalizes input result string to 'P', 'B', or 'T'
 */
export function parseBaccaratResult(res: any): BaccaratOutcome {
  if (!res) return 'P';
  const str = String(res).toUpperCase().trim();
  if (str.startsWith('B') || str.startsWith('BANQU') || str === 'RED' || str === 'VERMELHO') return 'B';
  if (str.startsWith('T') || str.startsWith('E') || str.startsWith('EMP') || str === 'GREEN' || str === 'VERDE') return 'T';
  return 'P'; // Default Player (Blue)
}

/**
 * Builds the Bead Plate matrix (6 rows x N cols) showing ALL history items
 */
export function buildBeadPlate(history: BaccaratHistoryItem[], rows = 6, minCols = 13) {
  const chrono = [...history].map(h => parseBaccaratResult(h.result));
  const neededCols = Math.ceil(chrono.length / rows);
  const maxCols = Math.max(minCols, neededCols);

  const grid: (BaccaratOutcome | null)[][] = Array.from({ length: rows }, () => Array(maxCols).fill(null));

  chrono.forEach((outcome, idx) => {
    const r = idx % rows;
    const c = Math.floor(idx / rows);
    if (r < rows && c < maxCols) {
      grid[r][c] = outcome;
    }
  });

  return { grid, maxCols };
}

/**
 * Builds the Big Road matrix and structural column data
 */
export function buildBigRoad(history: BaccaratHistoryItem[], rows = 6) {
  const chrono = [...history].map(h => parseBaccaratResult(h.result));
  
  // Array of placed cells
  const cells: BigRoadCell[] = [];
  
  // Helper 2D occupancy grid: occupancy[r][c] = boolean
  const occupied: boolean[][] = Array.from({ length: 100 }, () => Array(100).fill(false));
  // To quickly query cell by (r, c)
  const gridMap = new Map<string, BigRoadCell>();

  let lastWinner: 'P' | 'B' | null = null;
  let currentColumnStart = 0;
  let maxColReached = 0;
  let row = 0;
  let col = 0;

  // Track initial ties before first non-tie
  let pendingTiesAtStart = 0;

  chrono.forEach((outcome) => {
    if (outcome === 'T') {
      if (cells.length > 0) {
        cells[cells.length - 1].tieCount += 1;
      } else {
        pendingTiesAtStart += 1;
      }
      return;
    }

    // Outcome is 'P' or 'B'
    if (lastWinner === null) {
      // First non-tie
      lastWinner = outcome;
      row = 0;
      col = 0;
      currentColumnStart = 0;
    } else if (outcome === lastWinner) {
      // Same streak: try to go down
      if (row + 1 < rows && !occupied[row + 1][col]) {
        row++;
      } else {
        // Turn right (dragon tail)
        col++;
      }
    } else {
      // Different winner: new column at row 0
      lastWinner = outcome;
      currentColumnStart = currentColumnStart + 1;
      // Find row 0 in currentColumnStart or next available column
      col = currentColumnStart;
      while (occupied[0][col]) {
        col++;
      }
      currentColumnStart = col;
      row = 0;
    }

    occupied[row][col] = true;
    maxColReached = Math.max(maxColReached, col);

    const cell: BigRoadCell = {
      winner: outcome,
      tieCount: pendingTiesAtStart,
      row,
      col,
    };
    pendingTiesAtStart = 0;

    cells.push(cell);
    gridMap.set(`${row},${col}`, cell);
  });

  return { cells, gridMap, maxColReached, occupied };
}

/**
 * Computes derived road outputs ('RED' or 'BLUE') from Big Road
 * gap = 1 -> Big Eye Boy
 * gap = 2 -> Small Road
 * gap = 3 -> Cockroach Road
 */
export function computeDerivedRoadSignals(
  bigRoadCells: BigRoadCell[],
  bigRoadOccupied: boolean[][],
  gap: number
): ('RED' | 'BLUE')[] {
  const signals: ('RED' | 'BLUE')[] = [];

  // Helper to get column height in Big Road
  const getColHeight = (colIndex: number): number => {
    if (colIndex < 0) return 0;
    let height = 0;
    for (let r = 0; r < 50; r++) {
      if (bigRoadOccupied[r][colIndex]) {
        height++;
      } else {
        break;
      }
    }
    return height;
  };

  bigRoadCells.forEach((cell) => {
    const { row: r, col: c } = cell;

    // Check starting condition for derived road gap:
    // Gap 1 (Big Eye Boy): c == 1 && r >= 1, or c > 1
    // Gap 2 (Small Road): c == 2 && r >= 1, or c > 2
    // Gap 3 (Cockroach): c == 3 && r >= 1, or c > 3
    const isValidStart = (c === gap && r >= 1) || c > gap;
    if (!isValidStart) return;

    if (r === 0) {
      // Comparing column heights: col (c - 1) vs col (c - 1 - gap)
      const h1 = getColHeight(c - 1);
      const h2 = getColHeight(c - 1 - gap);
      if (h1 === h2) {
        signals.push('RED');
      } else {
        signals.push('BLUE');
      }
    } else {
      // Continuation cell: check occupancy in column (c - gap)
      const targetCol = c - gap;
      const hasCellAtSameRow = targetCol >= 0 && bigRoadOccupied[r][targetCol];

      if (hasCellAtSameRow) {
        signals.push('RED');
      } else {
        const hasCellAtRowAbove = targetCol >= 0 && bigRoadOccupied[r - 1][targetCol];
        if (hasCellAtRowAbove) {
          signals.push('BLUE'); // Changed direction at row - 1
        } else {
          signals.push('RED'); // Column ended even higher up
        }
      }
    }
  });

  return signals;
}

/**
 * Builds the 2D grid layout for a derived road ('RED' | 'BLUE')
 */
export function buildDerivedRoadGrid(
  signals: ('RED' | 'BLUE')[],
  rows = 6
) {
  const cells: DerivedRoadCell[] = [];
  const occupied: boolean[][] = Array.from({ length: 100 }, () => Array(100).fill(false));

  let lastColor: 'RED' | 'BLUE' | null = null;
  let currentColumnStart = 0;
  let row = 0;
  let col = 0;
  let maxCol = 0;

  signals.forEach((color) => {
    if (lastColor === null) {
      lastColor = color;
      row = 0;
      col = 0;
      currentColumnStart = 0;
    } else if (color === lastColor) {
      if (row + 1 < rows && !occupied[row + 1][col]) {
        row++;
      } else {
        col++;
      }
    } else {
      lastColor = color;
      currentColumnStart++;
      col = currentColumnStart;
      while (occupied[0][col]) {
        col++;
      }
      currentColumnStart = col;
      row = 0;
    }

    occupied[row][col] = true;
    maxCol = Math.max(maxCol, col);
    cells.push({ color, row, col });
  });

  return { cells, occupied, maxCol };
}

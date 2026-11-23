import {
  SimSnapshotSchema,
  generateWorld,
  type SimSnapshot,
} from "@sovereign/shared";

const DB_NAME = "sovereign";
const STORE_NAME = "saves";
const AUTOSAVE_KEY = "autosave";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAutosave(snapshot: SimSnapshot): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(snapshot, AUTOSAVE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** A save only makes sense if the world its seed produces is the one it was played on. */
function matchesWorld(snapshot: SimSnapshot): boolean {
  const world = generateWorld(snapshot.worldSeed);
  if (world.countries.length !== snapshot.state.nations.length) return false;
  return world.countries.every((c) => {
    const nation = snapshot.state.nations[c.id];
    return (
      nation !== undefined &&
      nation.name === c.name &&
      nation.region === c.region
    );
  });
}

/** Returns null if there is no save, it fails validation, or it belongs to an older map generator. */
export async function loadAutosave(): Promise<SimSnapshot | null> {
  const db = await openDb();
  const raw = await new Promise<unknown>((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(AUTOSAVE_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  const parsed = SimSnapshotSchema.safeParse(raw);
  if (!parsed.success) return null;
  return matchesWorld(parsed.data) ? parsed.data : null;
}

export async function clearAutosave(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(AUTOSAVE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

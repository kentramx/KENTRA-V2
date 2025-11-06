// Sistema de cola de mensajes usando IndexedDB
const DB_NAME = 'kentra-messages';
const STORE_NAME = 'pending-messages';
const DB_VERSION = 1;

export interface PendingMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: 'text' | 'image';
  imageUrl?: string | null;
  timestamp: number;
}

// Abrir o crear la base de datos
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

// Agregar mensaje a la cola
export const addToQueue = async (message: PendingMessage): Promise<void> => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(message);

    request.onsuccess = () => {
      console.log('Mensaje agregado a la cola:', message.id);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

// Obtener todos los mensajes pendientes
export const getPendingMessages = async (): Promise<PendingMessage[]> => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Eliminar un mensaje de la cola
export const removeFromQueue = async (messageId: string): Promise<void> => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(messageId);

    request.onsuccess = () => {
      console.log('Mensaje eliminado de la cola:', messageId);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

// Contar mensajes pendientes
export const countPendingMessages = async (): Promise<number> => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Limpiar toda la cola
export const clearQueue = async (): Promise<void> => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      console.log('Cola de mensajes limpiada');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

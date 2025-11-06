// Service Worker personalizado para Background Sync
const CACHE_NAME = 'kentra-v1';
const API_CACHE = 'kentra-api-v1';

// Instalar y activar el service worker
self.addEventListener('install', (event) => {
  console.log('Service Worker instalado');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activado');
  event.waitUntil(self.clients.claim());
});

// Interceptar peticiones de red
self.addEventListener('fetch', (event) => {
  // Solo cachear GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request).then((response) => {
        // No cachear respuestas no exitosas
        if (!response || response.status !== 200) {
          return response;
        }

        // Cachear la respuesta
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});

// Background Sync para mensajes
self.addEventListener('sync', (event) => {
  console.log('Evento de sincronización:', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncPendingMessages());
  }
});

// Función para sincronizar mensajes pendientes
async function syncPendingMessages() {
  console.log('Iniciando sincronización de mensajes pendientes...');
  
  try {
    // Abrir IndexedDB para obtener mensajes pendientes
    const db = await openIndexedDB();
    const messages = await getAllPendingMessages(db);
    
    console.log(`Encontrados ${messages.length} mensajes pendientes`);
    
    // Enviar cada mensaje
    for (const message of messages) {
      try {
        await sendMessage(message);
        await removePendingMessage(db, message.id);
        console.log(`Mensaje ${message.id} enviado exitosamente`);
      } catch (error) {
        console.error(`Error enviando mensaje ${message.id}:`, error);
        // No eliminar el mensaje si falló, se intentará en la próxima sincronización
      }
    }
    
    console.log('Sincronización completada');
  } catch (error) {
    console.error('Error en la sincronización:', error);
    throw error; // Propagar el error para que el navegador reintente
  }
}

// Función para enviar un mensaje a Supabase
async function sendMessage(message) {
  const supabaseUrl = 'https://jazjzwhbagwllensnkaz.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphemp6d2hiYWd3bGxlbnNua2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzODI0MDEsImV4cCI6MjA3Nzk1ODQwMX0.4w3SkvwsRp7KReYO859NdkqEKRl6fRMj68D_yImW6OE';
  
  const response = await fetch(`${supabaseUrl}/rest/v1/messages`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      conversation_id: message.conversationId,
      sender_id: message.senderId,
      content: message.content,
      message_type: message.messageType,
      image_url: message.imageUrl
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response;
}

// Funciones de IndexedDB
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('kentra-messages', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-messages')) {
        db.createObjectStore('pending-messages', { keyPath: 'id' });
      }
    };
  });
}

function getAllPendingMessages(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-messages'], 'readonly');
    const store = transaction.objectStore('pending-messages');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function removePendingMessage(db, messageId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-messages'], 'readwrite');
    const store = transaction.objectStore('pending-messages');
    const request = store.delete(messageId);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

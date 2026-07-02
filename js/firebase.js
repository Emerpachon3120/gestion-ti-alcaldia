// ─── firebase.js ──────────────────────────────────────────────
// Reemplaza api.js — usa Firebase Firestore como backend
// ──────────────────────────────────────────────────────────────

import { initializeApp }          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── Configuración Firebase ───────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyCnH_nnyuJu0TOZ1YvBzefeDBk2Y-2VWfQ',
  authDomain:        'gestion-ti-nemocon.firebaseapp.com',
  projectId:         'gestion-ti-nemocon',
  storageBucket:     'gestion-ti-nemocon.firebasestorage.app',
  messagingSenderId: '17698124379',
  appId:             '1:17698124379:web:472aaf43595068bb3ad42e',
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// Mapa: nombre de "sheet" → colección Firestore
const COLECCION = {
  Dependencias:    'dependencias',
  Oficinas:        'oficinas',
  Personas:        'personas',
  Equipos:         'equipos',
  Mantenimientos:  'mantenimientos',
  Backups:         'backups',
  Cronograma:      'cronograma',
  Incidencias:     'incidencias',
};

// ─── Leer colección completa ──────────────────────────────────
export async function apiGet(sheet) {
  const col = COLECCION[sheet];
  if (!col) throw new Error(`Colección desconocida: ${sheet}`);
  const snap = await getDocs(collection(db, col));
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}

// ─── Escribir / actualizar / eliminar documento ───────────────
export async function apiPost(sheet, action, data, keyField, keyValue) {
  const col = COLECCION[sheet];
  if (!col) throw new Error(`Colección desconocida: ${sheet}`);

  // ELIMINAR
  if (action === 'delete') {
    if (!keyValue) throw new Error('apiPost delete requiere keyValue');
    await deleteDoc(doc(db, col, String(keyValue)));
    return { ok: true };
  }

  // INSERTAR
  if (action === 'insert') {
    const id = keyValue || data.id || data.ID || data.serial || data.Serial;
    if (id) {
      await setDoc(doc(db, col, String(id)), {
        ...data,
        _updatedAt: serverTimestamp(),
      });
      return { id };
    } else {
      const ref = await addDoc(collection(db, col), {
        ...data,
        _updatedAt: serverTimestamp(),
      });
      return { id: ref.id };
    }
  }

  // ACTUALIZAR
  if (action === 'update') {
    if (!keyValue) throw new Error('apiPost update requiere keyValue');
    await updateDoc(doc(db, col, String(keyValue)), {
      ...data,
      _updatedAt: serverTimestamp(),
    });
    return { id: keyValue };
  }

  throw new Error(`Acción desconocida: ${action}`);
}

// ─── Eliminar documento (shorthand) ──────────────────────────
export async function apiDelete(sheet, id) {
  return apiPost(sheet, 'delete', {}, 'id', id);
}

// ─── Leer documento individual ────────────────────────────────
export async function apiGetDoc(sheet, id) {
  const col = COLECCION[sheet];
  if (!col) throw new Error(`Colección desconocida: ${sheet}`);
  const snap = await getDoc(doc(db, col, String(id)));
  if (!snap.exists()) return null;
  return { _id: snap.id, ...snap.data() };
}

// ─── Cargar todos los datos iniciales ────────────────────────
export async function cargarDatosDesdeFirestore() {
  const [deps, ofs, pers, eqs, mantsSheet, bksSheet, cronogramaSheet] =
    await Promise.all([
      apiGet('Dependencias'),
      apiGet('Oficinas'),
      apiGet('Personas'),
      apiGet('Equipos'),
      apiGet('Mantenimientos'),
      apiGet('Backups'),
      apiGet('Cronograma'),
    ]);
  return { deps, ofs, pers, eqs, mantsSheet, bksSheet, cronogramaSheet };
}

// Alias para compatibilidad
export { cargarDatosDesdeFirestore as cargarDatosDesdeSheets };

export { db };

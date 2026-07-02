// ─── firebase.js ──────────────────────────────────────────────
// Reemplaza api.js — usa Firebase Firestore como backend
// ──────────────────────────────────────────────────────────────

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
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
  query,
  where,
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
  Dependencias:   'dependencias',
  Oficinas:       'oficinas',
  Personas:       'personas',
  Equipos:        'equipos',
  Mantenimientos: 'mantenimientos',
  Backups:        'backups',
  Cronograma:     'cronograma',
  Incidencias:    'incidencias',
};

// ─── Leer colección completa ──────────────────────────────────
export async function apiGet(sheet) {
  const col = COLECCION[sheet];
  if (!col) throw new Error(`Colección desconocida: ${sheet}`);
  const snap = await getDocs(collection(db, col));
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}

// ─── Buscar documento por campo interno ──────────────────────
// Retorna el doc de Firestore cuyo campo `keyField` === `keyValue`
// Si no encuentra, retorna null
async function _buscarDoc(col, keyField, keyValue) {
  // Primero intentar acceso directo por ID del documento
  try {
    const directRef = doc(db, col, String(keyValue));
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) return directSnap;
  } catch(e) { /* no encontrado */ }

  // Si no, buscar por campo interno (documentos migrados desde Sheets)
  const q = query(collection(db, col), where(keyField, '==', String(keyValue)));
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0];

  // Buscar también por campo 'ID' mayúsculas (datos migrados)
  const q2 = query(collection(db, col), where('ID', '==', String(keyValue)));
  const snap2 = await getDocs(q2);
  if (!snap2.empty) return snap2.docs[0];

  return null;
}

// ─── Escribir / actualizar / eliminar documento ───────────────
export async function apiPost(sheet, action, data, keyField = 'id', keyValue) {
  const col = COLECCION[sheet];
  if (!col) throw new Error(`Colección desconocida: ${sheet}`);

  // ── ELIMINAR ──────────────────────────────────────────────
  if (action === 'delete') {
    if (!keyValue) throw new Error('apiPost delete requiere keyValue');
    const found = await _buscarDoc(col, keyField, keyValue);
    if (found) {
      await deleteDoc(found.ref);
      return { ok: true };
    }
    console.warn(`[Firebase] No se encontró doc para eliminar: ${col}/${keyValue}`);
    return { ok: false };
  }

  // ── INSERTAR ──────────────────────────────────────────────
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

  // ── ACTUALIZAR ────────────────────────────────────────────
  if (action === 'update') {
    if (!keyValue) throw new Error('apiPost update requiere keyValue');
    const found = await _buscarDoc(col, keyField, keyValue);
    if (found) {
      await updateDoc(found.ref, {
        ...data,
        _updatedAt: serverTimestamp(),
      });
      return { id: keyValue };
    }
    // Si no existe, crear
    await setDoc(doc(db, col, String(keyValue)), {
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

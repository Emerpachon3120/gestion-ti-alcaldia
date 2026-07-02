// ─── firebase.js ──────────────────────────────────────────────
// Reemplaza api.js — usa Firebase Firestore como backend
// Misma interfaz pública: apiGet, apiPost, cargarDatosDesdeSheets
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
  query,
  where,
  orderBy,
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
// Compatibilidad con apiGet(sheet)
export async function apiGet(sheet) {
  const col = COLECCION[sheet];
  if (!col) throw new Error(`Colección desconocida: ${sheet}`);

  const snap = await getDocs(collection(db, col));
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}

// ─── Escribir / actualizar documento ─────────────────────────
// Compatibilidad con apiPost(sheet, action, data, keyField, keyValue)
// action: 'insert' | 'update'
export async function apiPost(sheet, action, data, keyField, keyValue) {
  const col = COLECCION[sheet];
  if (!col) throw new Error(`Colección desconocida: ${sheet}`);

  if (action === 'insert') {
    // Usar keyValue como ID del documento si existe
    if (keyValue) {
      await setDoc(doc(db, col, String(keyValue)), {
        ...data,
        _updatedAt: serverTimestamp(),
      });
      return { id: keyValue };
    } else {
      const ref = await addDoc(collection(db, col), {
        ...data,
        _updatedAt: serverTimestamp(),
      });
      return { id: ref.id };
    }
  }

  if (action === 'update') {
    if (!keyValue) throw new Error('apiPost update requiere keyValue');
    const docRef = doc(db, col, String(keyValue));
    await updateDoc(docRef, {
      ...data,
      _updatedAt: serverTimestamp(),
    });
    return { id: keyValue };
  }

  throw new Error(`Acción desconocida: ${action}`);
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
// Misma firma que en api.js — retorna { deps, ofs, pers, eqs,
// mantsSheet, bksSheet, cronogramaSheet }
// Incidencias se carga por separado (viene de Firestore también)
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

// Alias para compatibilidad con el nombre antiguo
export { cargarDatosDesdeFirestore as cargarDatosDesdeSheets };

// ─── Exportar db por si algún módulo lo necesita directamente ─
export { db };

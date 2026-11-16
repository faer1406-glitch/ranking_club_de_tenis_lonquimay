/* ============================================================
   FIREBASE SDK
============================================================ */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";


import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";


import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


/* ============================================================
   CONFIGURACIÓN FIREBASE
============================================================ */

const firebaseConfig = {

  apiKey: "AIzaSyD49Let7bMQiOI-qlMD2CqeBF8KBIAysEk",

  authDomain: "ranking-club-tenis-lonquimay.firebaseapp.com",

  projectId: "ranking-club-tenis-lonquimay",

  storageBucket: "ranking-club-tenis-lonquimay.firebasestorage.app",

  messagingSenderId: "146624104646",

  appId: "1:146624104646:web:24ad6f8f54dc8da62a2fc7"

};


const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);

const db = getFirestore(firebaseApp);

const googleProvider = new GoogleAuthProvider();


/* ============================================================
   JUGADORES INICIALES
============================================================ */

// ======================================================
// NÓMINA OFICIAL INICIAL - CLUB DE TENIS LONQUIMAY
// ======================================================

// Usa la nómina oficial de la liga (definida más abajo).
const JUGADORES_INICIALES = [
  { nombre: "Alan Gamin", categoria: 1 },
  { nombre: "Diego Labrín", categoria: 1 },
  { nombre: "Claudio Díaz", categoria: 1 },
  { nombre: "Felipe Espinoza", categoria: 1 },
  { nombre: "Rodrigo Alday", categoria: 1 },
  { nombre: "Philip Bruna", categoria: 1 },

  { nombre: "Luis Figueroa", categoria: 2 },
  { nombre: "Luis Gatica", categoria: 2 },
  { nombre: "Juan Carlos Silva", categoria: 2 },
  { nombre: "Luis Osses", categoria: 2 },
  { nombre: "Gabriel Osorio", categoria: 2 },
  { nombre: "Cristian Durán", categoria: 2 },

  { nombre: "Daniel Carrasco", categoria: 3 },
  { nombre: "Danilo Mendoza", categoria: 3 },
  { nombre: "Daniel Leal", categoria: 3 },
  { nombre: "Waldo González", categoria: 3 },
  { nombre: "Ismael Ríos", categoria: 3 },
  { nombre: "Víctor Pailla", categoria: 3 },
  { nombre: "Rodrigo Breve", categoria: 3 },
  { nombre: "Roger Contreras", categoria: 3 },

  { nombre: "Paula Ortiz", categoria: 4 },
  { nombre: "Glenda Rivera", categoria: 4 },
  { nombre: "Fernando Uribe", categoria: 4 },
  { nombre: "Cristian Rüedi", categoria: 4 },

  { nombre: "Víctor Millán", categoria: 5 },
  { nombre: "Karina Mellado", categoria: 5 },
  { nombre: "Felipe Acuña", categoria: 5 },
  { nombre: "Gustavo Alarcón", categoria: 5 },
  { nombre: "Farid Ducom", categoria: 5 },
  { nombre: "Lissette Villalba", categoria: 5 }
];

async function inicializarJugadores() {
    // La carga inicial de jugadores solo puede ejecutarla un administrador.
  if (!usuarioActual || !esAdmin()) {
    return;
  }

  try {

    const jugadoresRef = collection(db, "jugadores");
    const snapshot = await getDocs(jugadoresRef);

    // Jugadores actualmente existentes
    const existentes = new Set();

    snapshot.forEach((documento) => {
      const datos = documento.data();

      if (datos.nombre) {
        existentes.add(
          datos.nombre
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
        );
      }
    });

    let creados = 0;

    for (const jugador of JUGADORES_INICIALES) {

      const nombreNormalizado = jugador.nombre
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      // Evita duplicados
      if (!existentes.has(nombreNormalizado)) {

        await addDoc(jugadoresRef, {
          nombre: jugador.nombre,
          categoria: jugador.categoria,
          activo: true,
          creadoEn: serverTimestamp()
        });

        existentes.add(nombreNormalizado);
        creados++;
      }
    }

    console.log(
      `Inicialización terminada. ${creados} jugadores nuevos creados.`
    );

    return creados;

  } catch (error) {

    console.error(
      "Error inicializando jugadores:",
      error
    );

    throw error;
  }
}

/* ============================================================
   VARIABLES
============================================================ */

let usuarioActual = null;

let perfilActual = null;

let jugadores = [];

let partidos = [];

let usuarios = [];

let partidoEnEdicion = null;

let unsubscribeJugadores = null;

let unsubscribePartidos = null;

let unsubscribeUsuarios = null;

let unsubscribeAuditoria = null;

let unsubscribeFechas = null;

let unsubscribeCierres = null;

let fechasLiga = [];

let cierres = [];

/* ============================================================
   CONFIGURACIÓN DE LA TEMPORADA / LIGA
============================================================ */

// N.º de categorías del club (1 = la más alta).
const NUM_CATEGORIAS = 6;

// Duración del ranking semestral (noviembre a abril).
const TEMPORADA = {
  inicio: "2026-11-01",
  fin: "2027-04-30"
};

// Canchas disponibles para las fechas de liga.
const NUM_CANCHAS = 4;


/* ============================================================
   DOM
============================================================ */

const el = id => document.getElementById(id);


/* ============================================================
   INICIO
============================================================ */

document.addEventListener("DOMContentLoaded", () => {


  el("btnGoogle")
    .addEventListener("click", loginGoogle);

  el("btnCerrarSesion")
    .addEventListener("click", cerrarSesion);

  el("btnCancelarPerfil")
    .addEventListener("click", cerrarSesion);

  el("btnCrearPerfil")
    .addEventListener("click", crearPerfil);

  el("tipoSet3")
    .addEventListener("change", actualizarRangoSet3);

  el("jugadorA")
    .addEventListener("change", () => cargarCategoria("A"));

  el("jugadorB")
    .addEventListener("change", () => cargarCategoria("B"));

  el("btnGuardarPartido")
    .addEventListener("click", guardarPartido);

  el("btnLimpiar")
    .addEventListener("click", limpiarFormularioPartido);

  el("btnBuscarRegistro")
    .addEventListener("click", buscarRegistro);

  el("btnCancelarEdicion")
    .addEventListener("click", cancelarEdicion);

  el("btnAnularPartido")
    .addEventListener("click", anularPartido);

  el("btnDescargarRanking")
    .addEventListener("click", descargarRankingExcel);

  el("formJugador")
  .addEventListener("submit", crearJugador);

  el("btnMostrarAdminJugadores")
    .addEventListener(
      "click",
      alternarAdministracionJugadores
    );

  el("tipoPartido")
    .addEventListener("change", actualizarTipoPartido);

  el("enfrentamientoLiga")
    .addEventListener("change", seleccionarEnfrentamiento);

  el("chkWalkover")
    .addEventListener("change", actualizarWalkover);

  el("formFechaLiga")
    .addEventListener("submit", crearFechaLiga);

  el("mesLiga")
    .addEventListener("change", () => {
      renderLiga();
      renderCategorias();
    });

  el("btnCerrarMes")
    .addEventListener("click", cerrarMes);

  el("btnSincronizarNomina")
    .addEventListener("click", sincronizarNomina);

  document
    .querySelectorAll(".tab-btn")
    .forEach(b =>
      b.addEventListener("click", () =>
        mostrarTab(b.dataset.tab)
      )
    );

  prepararMarcadores();

  el("fecha").value = fechaActual();

  el("mesLiga").value = fechaActual().slice(0, 7);

  el("fechaNuevaLiga").value = fechaActual();

  escucharAutenticacion();

});


/* ============================================================
   GOOGLE LOGIN
============================================================ */

async function loginGoogle() {

  ocultarMensaje("mensajeLogin");

  try {

    /*googleProvider.setCustomParameters({
      prompt: "select_account"
    });*/

    await signInWithPopup(
      auth,
      googleProvider
    );

  }

  catch (error) {

    console.error(error);

    mostrarMensaje(
      "mensajeLogin",
      "No fue posible iniciar sesión con Google.",
      "error"
    );

  }

}


/* ============================================================
   LOGOUT
============================================================ */

async function cerrarSesion() {

  try {

    await signOut(auth);

  }

  catch (error) {

    console.error(error);

  }

}


/* ============================================================
   AUTH STATE
============================================================ */

function escucharAutenticacion() {

  onAuthStateChanged(auth, async user => {

    usuarioActual = user;

    detenerListeners();

    if (!user) {

      perfilActual = null;

      mostrarSoloVista("login");

      return;
    }

    try {

      // ==================================================
      // INICIALIZAR NÓMINA DE JUGADORES
      // ==================================================
      // Comprueba los jugadores existentes en Firestore.
      // Agrega únicamente los que falten.
      // No duplica jugadores existentes.

      


      // ==================================================
      // BUSCAR PERFIL DEL USUARIO
      // ==================================================

      const perfilSnap = await getDoc(
        doc(db, "usuarios", user.uid)
      );


      // ==================================================
      // USUARIO NUEVO
      // ==================================================

      if (!perfilSnap.exists()) {

        await prepararNuevoPerfil(user);

        return;
      }


      // ==================================================
      // USUARIO CON PERFIL EXISTENTE
      // ==================================================

      perfilActual = {
        id: perfilSnap.id,
        ...perfilSnap.data()
      };


      // ==================================================
      // VERIFICAR SI LA CUENTA ESTÁ ACTIVA
      // ==================================================

      if (perfilActual.activo === false) {

        await signOut(auth);

        mostrarMensaje(
          "mensajeLogin",
          "Su cuenta se encuentra desactivada.",
          "error"
        );

        return;
      }


      // ==================================================
      // ABRIR APLICACIÓN
      // ==================================================

      abrirAplicacion();

    }

    catch (error) {

      console.error(
        "Error durante la autenticación/inicialización:",
        error
      );

      mostrarMensaje(
        "mensajeLogin",
        "No fue posible cargar el perfil.",
        "error"
      );

    }

  });

}

/* ============================================================
   PRIMER PERFIL
============================================================ */

async function prepararNuevoPerfil(user) {

  mostrarSoloVista("perfil");

  el("correoNuevoPerfil").textContent =
    user.email || "";

  await cargarJugadoresParaNuevoPerfil();

}


/* ============================================================
   JUGADORES PARA PRIMER PERFIL
============================================================ */

async function cargarJugadoresParaNuevoPerfil() {

  const select = el("jugadorNuevoPerfil");

  select.innerHTML =
    '<option value="">Seleccione jugador</option>';

  try {

    const snapshot = await getDocs(
      collection(db, "jugadores")
    );

    let lista = [];

    if (!snapshot.empty) {

      lista = snapshot.docs
        .map(d => ({
          id: d.id,
          ...d.data()
        }))
        .filter(j => j.activo !== false);

    }

    /*
      Si Firestore aún no tiene jugadores,
      mostramos la nómina inicial para poder
      crear el primer perfil.
    */

    if (lista.length === 0) {

      lista = JUGADORES_INICIALES.map((j, index) => ({
        id: `inicial-${index}`,
        ...j,
        temporal: true
      }));

    }

    lista
      .sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es")
      )
      .forEach(j => {

        const option = new Option(
          `${j.nombre} — Categoría ${j.categoria}`,
          j.id
        );

        option.dataset.nombre = j.nombre;
        option.dataset.categoria = j.categoria;
        option.dataset.temporal =
          j.temporal ? "true" : "false";

        select.add(option);

      });

  }

  catch (error) {

    console.error(error);

    /*
      En instalación inicial usamos la lista
      incorporada en el código.
    */

    JUGADORES_INICIALES
      .slice()
      .sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es")
      )
      .forEach((j, index) => {

        const option = new Option(
          `${j.nombre} — Categoría ${j.categoria}`,
          `inicial-${index}`
        );

        option.dataset.nombre = j.nombre;
        option.dataset.categoria = j.categoria;
        option.dataset.temporal = "true";

        select.add(option);

      });

  }

}


/* ============================================================
   CREAR PERFIL
============================================================ */

async function crearPerfil() {

  if (!usuarioActual) {
    return;
  }

  const select = el("jugadorNuevoPerfil");

  const option = select.selectedOptions[0];

  if (!select.value) {

    mostrarMensaje(
      "mensajePerfil",
      "Debe seleccionar su jugador.",
      "error"
    );

    return;

  }

  const jugadorNombre =
    option.dataset.nombre;

  const categoria =
    Number(option.dataset.categoria);

  try {

    /*
      Si estamos usando la lista inicial,
      primero creamos el jugador real.
    */

    let jugadorId = select.value;

    if (option.dataset.temporal === "true") {

      const jugadorRef = await addDoc(
        collection(db, "jugadores"),
        {
          nombre: jugadorNombre,
          categoria,
          activo: true,
          creadoEn: serverTimestamp()
        }
      );

      jugadorId = jugadorRef.id;

    }

    /*
      Todas las cuentas nacen como usuario.
      Nadie puede registrarse como admin.
    */

    await setDoc(
      doc(db, "usuarios", usuarioActual.uid),
      {
        nombreGoogle:
          usuarioActual.displayName || "",

        email:
          usuarioActual.email || "",

        foto:
          usuarioActual.photoURL || "",

        jugadorId,

        jugadorNombre,

        rol: "usuario",

        activo: true,

        creadoEn: serverTimestamp()
      }
    );

    /*
      Crear jugadores iniciales restantes
      si es la primera instalación.
    */

    await completarNominaInicial();

    perfilActual = {
      id: usuarioActual.uid,
      nombreGoogle:
        usuarioActual.displayName || "",
      email:
        usuarioActual.email || "",
      foto:
        usuarioActual.photoURL || "",
      jugadorId,
      jugadorNombre,
      rol: "usuario",
      activo: true
    };

    abrirAplicacion();

  }

  catch (error) {

    console.error(error);

    mostrarMensaje(
      "mensajePerfil",
      "No fue posible crear el perfil.",
      "error"
    );

  }

}


/* ============================================================
   COMPLETAR NÓMINA INICIAL
============================================================ */

async function completarNominaInicial() {

  const snapshot = await getDocs(
    collection(db, "jugadores")
  );

  const existentes = snapshot.docs.map(d =>
    normalizarTexto(
      d.data().nombre || ""
    )
  );

  for (const jugador of JUGADORES_INICIALES) {

    if (
      !existentes.includes(
        normalizarTexto(jugador.nombre)
      )
    ) {

      await addDoc(
        collection(db, "jugadores"),
        {
          nombre: jugador.nombre,
          categoria: jugador.categoria,
          activo: true,
          creadoEn: serverTimestamp()
        }
      );

    }

  }

}


/* ============================================================
   ABRIR APP
============================================================ */

function abrirAplicacion() {

  mostrarSoloVista("app");

  el("nombreUsuario").textContent =
    usuarioActual.displayName ||
    perfilActual.jugadorNombre ||
    "";

  el("correoUsuario").textContent =
    usuarioActual.email || "";

  el("rolActual").textContent =
    esAdmin()
      ? "ADMINISTRADOR"
      : "USUARIO";

  if (usuarioActual.photoURL) {

    el("fotoUsuario").src =
      usuarioActual.photoURL;

    el("fotoUsuario")
      .classList
      .remove("hidden");

  }

  else {

    el("fotoUsuario")
      .classList
      .add("hidden");

  }

  el("panelAdministrador")
    .classList
    .toggle(
      "hidden",
      !esAdmin()
    );

  if (esAdmin()) {

    el("textoPermisoPartido").textContent =
      "Modo administrador: puede registrar y corregir cualquier partido.";

  }

  else {

    el("textoPermisoPartido").textContent =
      `Jugador asociado: ${perfilActual.jugadorNombre}. Solo puede enviar un partido que haya ganado (o un walkover en que usted se presentó).`;

  }

  document
    .querySelectorAll(".solo-admin")
    .forEach(x =>
      x.classList.toggle("hidden", !esAdmin())
    );

  mostrarTab("registrar");

  escucharJugadores();

  escucharPartidos();

  escucharFechasLiga();

  escucharCierres();

  if (esAdmin()) {

    escucharUsuarios();

    escucharAuditoria();

  }

}


/* ============================================================
   VISTAS
============================================================ */

function mostrarSoloVista(tipo) {

  el("vistaLogin")
    .classList
    .add("hidden");

  el("vistaCrearPerfil")
    .classList
    .add("hidden");

  el("vistaAplicacion")
    .classList
    .add("hidden");

  el("zonaUsuario")
    .classList
    .add("hidden");

  if (tipo === "login") {

    el("vistaLogin")
      .classList
      .remove("hidden");

  }

  if (tipo === "perfil") {

    el("vistaCrearPerfil")
      .classList
      .remove("hidden");

  }

  if (tipo === "app") {

    el("vistaAplicacion")
      .classList
      .remove("hidden");

    el("zonaUsuario")
      .classList
      .remove("hidden");

  }

}


/* ============================================================
   ADMIN
============================================================ */

function esAdmin() {

  return (
    perfilActual &&
    perfilActual.rol === "admin"
  );

}


/* ============================================================
   JUGADORES EN TIEMPO REAL
============================================================ */

function escucharJugadores() {

  if (unsubscribeJugadores) {
    unsubscribeJugadores();
  }

  const q = query(
    collection(db, "jugadores"),
    orderBy("nombre")
  );

  unsubscribeJugadores =
    onSnapshot(q, snapshot => {

      jugadores = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      cargarSelectJugadores();

      if (esAdmin()) {
        renderJugadoresAdmin();
      }

      renderRanking();

      renderCategorias();

      el("estadoConexion").textContent =
        "Conectado";

      el("estadoConexion").className =
        "badge badge-ok";

    });

}


/* ============================================================
   SELECT JUGADORES
============================================================ */

function cargarSelectJugadores() {

  ["jugadorA", "jugadorB"]
    .forEach(id => {

      const select = el(id);

      const anterior = select.value;

      select.innerHTML =
        '<option value="">Seleccione jugador</option>';

      jugadores
        .filter(j => j.activo !== false)
        .forEach(j => {

          const option = new Option(
            j.nombre,
            j.id
          );

          option.dataset.nombre = j.nombre;
          option.dataset.categoria = j.categoria;

          select.add(option);

        });

      if (
        [...select.options]
          .some(o => o.value === anterior)
      ) {

        select.value = anterior;

      }

    });

  cargarCategoria("A");
  cargarCategoria("B");

}


/* ============================================================
   CATEGORÍA
============================================================ */

function cargarCategoria(lado) {

  const select =
    lado === "A"
      ? el("jugadorA")
      : el("jugadorB");

  const categoria =
    lado === "A"
      ? el("categoriaA")
      : el("categoriaB");

  const option =
    select.selectedOptions[0];

  categoria.value =
    option?.dataset?.categoria || "";

}


/* ============================================================
   MARCADORES
============================================================ */

function prepararMarcadores() {

  llenarNumeros("set1A", 7);
  llenarNumeros("set1B", 7);

  llenarNumeros("set2A", 7);
  llenarNumeros("set2B", 7);

  llenarNumeros("set3A", 7);
  llenarNumeros("set3B", 7);

}


function llenarNumeros(
  id,
  maximo,
  seleccionado = ""
) {

  const select = el(id);

  select.innerHTML =
    '<option value="">-</option>';

  for (
    let i = 0;
    i <= maximo;
    i++
  ) {

    const option =
      new Option(i, i);

    if (
      String(i) ===
      String(seleccionado)
    ) {
      option.selected = true;
    }

    select.add(option);

  }

}


/* ============================================================
   SET 3
============================================================ */

function actualizarRangoSet3() {

  const tipo =
    el("tipoSet3").value;

  const a =
    el("set3A").value;

  const b =
    el("set3B").value;

  const maximo =
    tipo === "super"
      ? 21
      : 7;

  llenarNumeros(
    "set3A",
    maximo,
    Number(a) <= maximo
      ? a
      : ""
  );

  llenarNumeros(
    "set3B",
    maximo,
    Number(b) <= maximo
      ? b
      : ""
  );

}


/* ============================================================
   OBTENER DATOS PARTIDO
============================================================ */

function obtenerDatosPartido() {

  const d =
    obtenerDatosPartidoBase();

  // En la liga vale la categoría con que se sorteó la fecha.
  if (d.tipo === "liga" && d.fechaLigaId) {

    const e =
      fechasLiga
        .find(f => f.id === d.fechaLigaId)
        ?.enfrentamientos?.[d.enfrentamientoIdx];

    if (e) {
      d.categoriaA = Number(e.categoria);
      d.categoriaB = Number(e.categoria);
    }

  }

  return d;

}


function obtenerDatosPartidoBase() {

  const optionA =
    el("jugadorA").selectedOptions[0];

  const optionB =
    el("jugadorB").selectedOptions[0];

  return {

    fecha:
      el("fecha").value,

    jugadorAId:
      el("jugadorA").value,

    jugadorA:
      optionA?.dataset?.nombre || "",

    categoriaA:
      Number(
        optionA?.dataset?.categoria || 0
      ),

    jugadorBId:
      el("jugadorB").value,

    jugadorB:
      optionB?.dataset?.nombre || "",

    categoriaB:
      Number(
        optionB?.dataset?.categoria || 0
      ),

    set1A:
      numeroSelect("set1A"),

    set1B:
      numeroSelect("set1B"),

    set2A:
      numeroSelect("set2A"),

    set2B:
      numeroSelect("set2B"),

    set3A:
      numeroSelect("set3A"),

    set3B:
      numeroSelect("set3B"),

    tipoSet3:
      el("tipoSet3").value,

    tipo:
      el("tipoPartido").value,

    fechaLigaId:
      el("tipoPartido").value === "liga"
        ? (el("enfrentamientoLiga").value.split("|")[0] || null)
        : null,

    enfrentamientoIdx:
      el("tipoPartido").value === "liga" &&
      el("enfrentamientoLiga").value
        ? Number(el("enfrentamientoLiga").value.split("|")[1])
        : null,

    walkover:
      el("chkWalkover").checked,

    woPresente:
      el("chkWalkover").checked
        ? el("woPresente").value
        : null

  };

}


/* ============================================================
   VALIDACIÓN
============================================================ */

function validarPartido(d) {

  if (!d.fecha) {
    return "Debe indicar la fecha.";
  }

  if (
    !d.jugadorAId ||
    !d.jugadorBId
  ) {
    return "Debe seleccionar ambos jugadores.";
  }

  if (
    d.jugadorAId ===
    d.jugadorBId
  ) {
    return "Un jugador no puede jugar contra sí mismo.";
  }

  const errorTipo =
    validarTipoPartido(d);

  if (errorTipo) {
    return errorTipo;
  }

  if (d.walkover) {

    if (!d.woPresente) {
      return "Walkover: indique qué jugador se presentó.";
    }

    return "";

  }

  if (
    d.set1A === null ||
    d.set1B === null ||
    d.set2A === null ||
    d.set2B === null
  ) {
    return "Debe completar los dos primeros sets.";
  }

  const errorSet1 =
    validarSetNormal(
      d.set1A,
      d.set1B
    );

  if (errorSet1) {
    return `Set 1: ${errorSet1}`;
  }

  const errorSet2 =
    validarSetNormal(
      d.set2A,
      d.set2B
    );

  if (errorSet2) {
    return `Set 2: ${errorSet2}`;
  }

  const ganaSet1A =
    d.set1A > d.set1B;

  const ganaSet2A =
    d.set2A > d.set2B;

  const necesitaTercero =
    ganaSet1A !== ganaSet2A;

  const tiene3A =
    d.set3A !== null;

  const tiene3B =
    d.set3B !== null;

  if (tiene3A !== tiene3B) {
    return "Debe ingresar el resultado completo del tercer set.";
  }

  if (
    necesitaTercero &&
    !tiene3A
  ) {
    return "El partido está 1-1 en sets. Debe registrar el tercer set.";
  }

  if (
    !necesitaTercero &&
    tiene3A
  ) {
    return "El partido terminó 2-0. No corresponde registrar tercer set.";
  }

  if (necesitaTercero) {

    if (d.tipoSet3 === "normal") {

      const errorSet3 =
        validarSetNormal(
          d.set3A,
          d.set3B
        );

      if (errorSet3) {
        return `Set 3: ${errorSet3}`;
      }

    }

    else {

      const errorSuper =
        validarSuperTieBreak(
          d.set3A,
          d.set3B
        );

      if (errorSuper) {
        return `Super tie-break: ${errorSuper}`;
      }

    }

  }

  return "";

}


/* ============================================================
   VALIDACIÓN SET NORMAL
============================================================ */

function validarSetNormal(a, b) {

  if (a === b) {
    return "el set no puede terminar empatado.";
  }

  const ganador =
    Math.max(a, b);

  const perdedor =
    Math.min(a, b);

  const valido =
    (
      ganador === 6 &&
      perdedor <= 4
    )
    ||
    (
      ganador === 7 &&
      (
        perdedor === 5 ||
        perdedor === 6
      )
    );

  if (!valido) {

    return (
      "marcador no válido. " +
      "Se admiten 6-0 a 6-4, 7-5 y 7-6."
    );

  }

  return "";

}


/* ============================================================
   SUPER TIE-BREAK
============================================================ */

function validarSuperTieBreak(a, b) {

  if (
    a === null ||
    b === null
  ) {
    return "debe completar ambos marcadores.";
  }

  if (a === b) {
    return "no puede terminar empatado.";
  }

  const ganador =
    Math.max(a, b);

  const perdedor =
    Math.min(a, b);

  if (ganador < 10) {
    return "el ganador debe alcanzar al menos 10 puntos.";
  }

  if (
    ganador - perdedor < 2
  ) {
    return "debe ganarse por diferencia mínima de 2 puntos.";
  }

  return "";

}


/* ============================================================
   CALCULAR PARTIDO
============================================================ */

function calcularResultado(d) {

  if (d.walkover) {

    const ganaA =
      d.woPresente === "A";

    const res = {
      setsA: 0,
      setsB: 0,
      juegosA: 0,
      juegosB: 0,
      ganador: ganaA ? d.jugadorA : d.jugadorB,
      ganadorId: ganaA ? d.jugadorAId : d.jugadorBId,
      perdedor: ganaA ? d.jugadorB : d.jugadorA
    };

    const pts =
      puntosPartido({ ...d, ...res });

    return {
      ...res,
      puntosGanador: ganaA ? pts.a : pts.b,
      puntosA: pts.a,
      puntosB: pts.b
    };

  }

  let setsA = 0;
  let setsB = 0;

  let juegosA =
    d.set1A +
    d.set2A;

  let juegosB =
    d.set1B +
    d.set2B;

  if (d.set1A > d.set1B) {
    setsA++;
  }
  else {
    setsB++;
  }

  if (d.set2A > d.set2B) {
    setsA++;
  }
  else {
    setsB++;
  }

  if (d.set3A !== null) {

    if (d.set3A > d.set3B) {
      setsA++;
    }
    else {
      setsB++;
    }

    /*
      El super tie-break decide un set,
      pero sus puntos no se cuentan como
      juegos ganados.
    */

    if (d.tipoSet3 === "normal") {

      juegosA += d.set3A;
      juegosB += d.set3B;

    }

  }

  const ganaA =
    setsA > setsB;

  const ganador =
    ganaA
      ? d.jugadorA
      : d.jugadorB;

  const ganadorId =
    ganaA
      ? d.jugadorAId
      : d.jugadorBId;

  const perdedor =
    ganaA
      ? d.jugadorB
      : d.jugadorA;

  const res = {
    setsA,
    setsB,
    juegosA,
    juegosB,
    ganador,
    ganadorId,
    perdedor
  };

  const pts =
    puntosPartido({ ...d, ...res });

  return {
    ...res,
    puntosGanador: ganaA ? pts.a : pts.b,
    puntosA: pts.a,
    puntosB: pts.b
  };

}


/* ============================================================
   PUNTAJE (SISTEMA NUEVO)
   Normal: 1 por jugar + 1 por set ganado.
   Liga:   doble (2 por presentarse + 2 por set ganado).
   Walkover: el que se presenta suma 3 (normal) o 6 (liga).
============================================================ */

function puntosPartido(p) {

  const mult =
    p.tipo === "liga" ? 2 : 1;

  if (p.walkover) {

    const g = 3 * mult;

    return p.ganadorId === p.jugadorAId
      ? { a: g, b: 0 }
      : { a: 0, b: g };

  }

  return {
    a: mult * (1 + Number(p.setsA || 0)),
    b: mult * (1 + Number(p.setsB || 0))
  };

}


/* ============================================================
   VALIDACIÓN SEGÚN TIPO DE PARTIDO
============================================================ */

function validarTipoPartido(d) {

  const editandoId =
    partidoEnEdicion?.idFirestore || null;

  if (d.tipo === "liga") {

    if (
      !d.fechaLigaId ||
      d.enfrentamientoIdx === null
    ) {
      return "Seleccione el partido de liga que corresponde.";
    }

    const yaCargado =
      partidos.find(p =>
        p.estado !== "anulado" &&
        p.fechaLigaId === d.fechaLigaId &&
        p.enfrentamientoIdx === d.enfrentamientoIdx &&
        p.idFirestore !== editandoId
      );

    if (yaCargado) {
      return `Ese partido de liga ya tiene resultado (N.º ${yaCargado.numeroRegistro}).`;
    }

    return "";

  }

  // Partido normal: un solo partido al mes contra la misma persona.

  const mes =
    d.fecha.slice(0, 7);

  const par =
    [d.jugadorAId, d.jugadorBId].sort().join("|");

  const repetido =
    partidos.find(p =>
      p.estado !== "anulado" &&
      p.tipo !== "liga" &&
      String(p.fecha || "").slice(0, 7) === mes &&
      [p.jugadorAId, p.jugadorBId].sort().join("|") === par &&
      p.idFirestore !== editandoId
    );

  if (repetido) {
    return `Estos jugadores ya jugaron un partido normal este mes (N.º ${repetido.numeroRegistro}). Solo se permite uno al mes contra la misma persona.`;
  }

  return "";

}


/* ============================================================
   GUARDAR PARTIDO
============================================================ */

async function guardarPartido() {

  ocultarMensaje("mensaje");

  const datos =
    obtenerDatosPartido();

  const error =
    validarPartido(datos);

  if (error) {

    mostrarMensaje(
      "mensaje",
      error,
      "error"
    );

    return;

  }

  const resultado =
    calcularResultado(datos);

  /*
    USUARIO NORMAL:
    debe ser el ganador.
  */

  if (!esAdmin()) {

    const correspondeGanador =
      perfilActual.jugadorId ===
      resultado.ganadorId;

    if (!correspondeGanador) {

      mostrarMensaje(
        "mensaje",
        "Solo el ganador del partido puede enviar el resultado.",
        "error"
      );

      return;

    }

  }

  try {

    if (partidoEnEdicion) {

      await actualizarPartido(
        datos,
        resultado
      );

    }

    else {

      await crearPartido(
        datos,
        resultado
      );

    }

  }

  catch (error) {

    console.error(error);

    mostrarMensaje(
      "mensaje",
      "No fue posible guardar el partido.",
      "error"
    );

  }

}


/* ============================================================
   NUEVO PARTIDO
============================================================ */

async function crearPartido(
  datos,
  resultado
) {

  const numeroRegistro =
    await obtenerCorrelativo();

  await addDoc(
    collection(db, "partidos"),
    {
      numeroRegistro,

      ...datos,

      ...resultado,

      estado: "vigente",

      informadoPorUid:
        usuarioActual.uid,

      informadoPorEmail:
        usuarioActual.email || "",

      informadoPorJugador:
        perfilActual.jugadorNombre || "",

      creadoEn:
        serverTimestamp(),

      modificadoEn:
        serverTimestamp()
    }
  );

  el("numeroRegistroVista").value =
    numeroRegistro;

  mostrarMensaje(
    "mensaje",
    `Partido guardado correctamente. N.º de registro ${numeroRegistro}.`,
    "ok"
  );

  limpiarMarcadores();

}


/* ============================================================
   CORRELATIVO
============================================================ */

async function obtenerCorrelativo() {

  const ref =
    doc(
      db,
      "sistema",
      "correlativos"
    );

  return await runTransaction(
    db,
    async transaction => {

      const snap =
        await transaction.get(ref);

      const actual =
        snap.exists()
          ? Number(
              snap.data().ultimoPartido || 0
            )
          : 0;

      const siguiente =
        actual + 1;

      transaction.set(
        ref,
        {
          ultimoPartido: siguiente
        },
        {
          merge: true
        }
      );

      return siguiente;

    }
  );

}


/* ============================================================
   ACTUALIZAR PARTIDO
============================================================ */

async function actualizarPartido(
  datos,
  resultado
) {

  if (!partidoEnEdicion) {
    return;
  }

  /*
    Usuarios normales solamente pueden corregir
    registros informados por ellos mismos.
    El administrador puede modificar cualquiera.
  */

  if (
    !esAdmin() &&
    partidoEnEdicion.informadoPorUid !==
      usuarioActual.uid
  ) {

    mostrarMensaje(
      "mensaje",
      "No tiene permiso para modificar este partido.",
      "error"
    );

    return;

  }

  const anterior =
    copiarDatosAuditoria(
      partidoEnEdicion
    );

  await updateDoc(
    doc(
      db,
      "partidos",
      partidoEnEdicion.idFirestore
    ),
    {
      ...datos,
      ...resultado,

      modificadoEn:
        serverTimestamp(),

      modificadoPorUid:
        usuarioActual.uid,

      modificadoPorEmail:
        usuarioActual.email || ""
    }
  );

  await addDoc(
    collection(db, "auditoria"),
    {
      accion:
        "CORRECCIÓN DE PARTIDO",

      numeroRegistro:
        partidoEnEdicion.numeroRegistro,

      usuarioUid:
        usuarioActual.uid,

      usuarioEmail:
        usuarioActual.email || "",

      anterior,

      nuevo: {
        ...datos,
        ...resultado
      },

      fecha:
        serverTimestamp()
    }
  );

  mostrarMensaje(
    "mensaje",
    `Partido N.º ${partidoEnEdicion.numeroRegistro} actualizado correctamente.`,
    "ok"
  );

  cancelarEdicion();

}


/* ============================================================
   PARTIDOS
============================================================ */

function escucharPartidos() {

  if (unsubscribePartidos) {
    unsubscribePartidos();
  }

  const q = query(
    collection(db, "partidos"),
    orderBy(
      "numeroRegistro",
      "desc"
    )
  );

  unsubscribePartidos =
    onSnapshot(q, snapshot => {

      partidos = snapshot.docs.map(d => ({
        idFirestore: d.id,
        ...d.data()
      }));

      renderPartidos();
      renderRanking();
      renderLiga();
      renderCategorias();
      cargarSelectEnfrentamientos();

    });

}


/* ============================================================
   TABLA PARTIDOS
============================================================ */

function renderPartidos() {

  const tbody =
    el("tablaPartidos");

  tbody.innerHTML = "";

  partidos.forEach(p => {

    const tr =
      document.createElement("tr");

    const valores = [

      p.numeroRegistro,

      p.fecha,

      p.jugadorA,

      p.categoriaA,

      marcadorPartido(p),

      p.jugadorB,

      p.categoriaB,

      p.ganador,

      `${puntosPartido(p).a}-${puntosPartido(p).b}`,

      p.informadoPorJugador ||
        p.informadoPorEmail ||
        "",

      p.estado || "vigente"

    ];

    valores.forEach(valor => {

      const td =
        document.createElement("td");

      td.textContent =
        valor ?? "";

      tr.appendChild(td);

    });

    tbody.appendChild(tr);

  });

}


/* ============================================================
   MARCADOR TEXTO
============================================================ */

function marcadorPartido(p) {

  if (p.walkover) {
    return `W.O. (se presentó ${p.ganador})` +
      (p.tipo === "liga" ? " · LIGA" : "");
  }

  let texto =
    `${p.set1A}-${p.set1B}` +
    " / " +
    `${p.set2A}-${p.set2B}`;

  if (
    p.set3A !== null &&
    p.set3A !== undefined
  ) {

    texto +=
      " / " +
      `${p.set3A}-${p.set3B}`;

    if (p.tipoSet3 === "super") {
      texto += " STB";
    }

  }

  if (p.tipo === "liga") {
    texto += " · LIGA";
  }

  return texto;

}


/* ============================================================
   BUSCAR PARTIDO
============================================================ */

async function buscarRegistro() {

  const numero =
    Number(
      el("buscarRegistro").value
    );

  if (!numero) {

    mostrarMensaje(
      "mensaje",
      "Ingrese un N.º de registro.",
      "error"
    );

    return;

  }

  try {

    const q = query(
      collection(db, "partidos"),
      where(
        "numeroRegistro",
        "==",
        numero
      ),
      limit(1)
    );

    const snapshot =
      await getDocs(q);

    if (snapshot.empty) {

      mostrarMensaje(
        "mensaje",
        `No existe el partido N.º ${numero}.`,
        "error"
      );

      return;

    }

    const d =
      snapshot.docs[0];

    const partido = {
      idFirestore: d.id,
      ...d.data()
    };

    if (
      !esAdmin() &&
      partido.informadoPorUid !==
        usuarioActual.uid
    ) {

      mostrarMensaje(
        "mensaje",
        "Solo puede corregir partidos informados desde su cuenta.",
        "error"
      );

      return;

    }

    cargarEdicion(partido);

  }

  catch (error) {

    console.error(error);

  }

}


/* ============================================================
   CARGAR EDICIÓN
============================================================ */

function cargarEdicion(p) {

  partidoEnEdicion = p;

  el("modoEdicion")
    .classList
    .remove("hidden");

  el("numeroEditando").textContent =
    p.numeroRegistro;

  el("numeroRegistroVista").value =
    p.numeroRegistro;

  el("fecha").value =
    p.fecha;

  el("tipoPartido").value =
    p.tipo === "liga" ? "liga" : "normal";

  cargarSelectEnfrentamientos();

  if (p.tipo === "liga") {
    el("enfrentamientoLiga").value =
      `${p.fechaLigaId}|${p.enfrentamientoIdx}`;
  }

  actualizarTipoPartido(false);

  el("chkWalkover").checked =
    !!p.walkover;

  el("woPresente").value =
    p.walkover
      ? (p.ganadorId === p.jugadorAId ? "A" : "B")
      : "A";

  actualizarWalkover();

  el("jugadorA").value =
    p.jugadorAId;

  cargarCategoria("A");

  el("jugadorB").value =
    p.jugadorBId;

  cargarCategoria("B");

  el("set1A").value =
    p.set1A;

  el("set1B").value =
    p.set1B;

  el("set2A").value =
    p.set2A;

  el("set2B").value =
    p.set2B;

  el("tipoSet3").value =
    p.tipoSet3 || "normal";

  actualizarRangoSet3();

  el("set3A").value =
    p.set3A ?? "";

  el("set3B").value =
    p.set3B ?? "";

  if (esAdmin()) {

    el("btnAnularPartido")
      .classList
      .remove("hidden");

  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


/* ============================================================
   CANCELAR EDICIÓN
============================================================ */

function cancelarEdicion() {

  partidoEnEdicion = null;

  el("modoEdicion")
    .classList
    .add("hidden");

  el("btnAnularPartido")
    .classList
    .add("hidden");

  el("numeroRegistroVista").value =
    "Se asignará automáticamente";

  limpiarFormularioPartido();

}


/* ============================================================
   ANULAR PARTIDO
============================================================ */

async function anularPartido() {

  if (
    !esAdmin() ||
    !partidoEnEdicion
  ) {
    return;
  }

  const confirmar =
    window.confirm(
      `¿Está seguro de anular el partido N.º ${partidoEnEdicion.numeroRegistro}?`
    );

  if (!confirmar) {
    return;
  }

  await updateDoc(
    doc(
      db,
      "partidos",
      partidoEnEdicion.idFirestore
    ),
    {
      estado: "anulado",

      modificadoEn:
        serverTimestamp(),

      modificadoPorUid:
        usuarioActual.uid,

      modificadoPorEmail:
        usuarioActual.email || ""
    }
  );

  await addDoc(
    collection(db, "auditoria"),
    {
      accion:
        "ANULACIÓN DE PARTIDO",

      numeroRegistro:
        partidoEnEdicion.numeroRegistro,

      usuarioUid:
        usuarioActual.uid,

      usuarioEmail:
        usuarioActual.email || "",

      fecha:
        serverTimestamp()
    }
  );

  mostrarMensaje(
    "mensaje",
    `Partido N.º ${partidoEnEdicion.numeroRegistro} anulado.`,
    "ok"
  );

  cancelarEdicion();

}


/* ============================================================
   RANKING
============================================================ */

function calcularRanking() {

  const mapa = {};

  jugadores
    .filter(j => j.activo !== false)
    .forEach(j => {

      mapa[j.id] = {
        jugadorId: j.id,
        nombre: j.nombre,
        categoria: Number(j.categoria),
        puntos: 0,
        pj: 0,
        pg: 0,
        pp: 0,
        sets: 0,
        juegos: 0,
        liga: 0
      };

    });

  partidos
    .filter(p =>
      p.estado !== "anulado" &&
      String(p.fecha || "") >= TEMPORADA.inicio &&
      String(p.fecha || "") <= TEMPORADA.fin
    )
    .forEach(p => {

      if (!mapa[p.jugadorAId]) {

        mapa[p.jugadorAId] = {
          jugadorId: p.jugadorAId,
          nombre: p.jugadorA,
          categoria: Number(p.categoriaA),
          puntos: 0,
          pj: 0,
          pg: 0,
          pp: 0,
          sets: 0,
          juegos: 0,
          liga: 0
        };

      }

      if (!mapa[p.jugadorBId]) {

        mapa[p.jugadorBId] = {
          jugadorId: p.jugadorBId,
          nombre: p.jugadorB,
          categoria: Number(p.categoriaB),
          puntos: 0,
          pj: 0,
          pg: 0,
          pp: 0,
          sets: 0,
          juegos: 0,
          liga: 0
        };

      }

      const a =
        mapa[p.jugadorAId];

      const b =
        mapa[p.jugadorBId];

      a.pj++;
      b.pj++;

      const pts =
        puntosPartido(p);

      a.puntos += pts.a;
      b.puntos += pts.b;

      if (p.tipo === "liga") {
        a.liga++;
        b.liga++;
      }

      a.sets +=
        Number(p.setsA || 0);

      b.sets +=
        Number(p.setsB || 0);

      a.juegos +=
        Number(p.juegosA || 0);

      b.juegos +=
        Number(p.juegosB || 0);

      if (
        p.ganadorId ===
        p.jugadorAId
      ) {

        a.pg++;
        b.pp++;

      }

      else {

        b.pg++;
        a.pp++;

      }

    });

  return Object
    .values(mapa)
    .sort((a, b) =>

      b.puntos - a.puntos

      ||

      b.sets - a.sets

      ||

      b.juegos - a.juegos

      ||

      a.nombre.localeCompare(
        b.nombre,
        "es"
      )

    );

}


/* ============================================================
   RENDER RANKING
============================================================ */

function renderRanking() {

  const tbody =
    el("tablaRanking");

  tbody.innerHTML = "";

  const ranking =
    calcularRanking();

  ranking.forEach(
    (j, index) => {

      const tr =
        document.createElement("tr");

      const valores = [

        index + 1,
        j.nombre,
        j.categoria,
        j.puntos,
        j.pj,
        j.pg,
        j.pp,
        j.liga,
        j.sets,
        j.juegos

      ];

      valores.forEach(valor => {

        const td =
          document.createElement("td");

        td.textContent = valor;

        tr.appendChild(td);

      });

      tbody.appendChild(tr);

    }
  );

}


/* ============================================================
   EXCEL
============================================================ */

function descargarRankingExcel() {

  if (
    typeof XLSX === "undefined"
  ) {

    mostrarMensaje(
      "mensaje",
      "No se pudo cargar el módulo de Excel.",
      "error"
    );

    return;

  }

  const ranking =
    calcularRanking();

  const datos =
    ranking.map(
      (j, index) => ({
        "Posición": index + 1,
        "Jugador": j.nombre,
        "Categoría": j.categoria,
        "Puntos": j.puntos,
        "Partidos jugados": j.pj,
        "Partidos ganados": j.pg,
        "Partidos perdidos": j.pp,
        "Partidos de liga": j.liga,
        "Sets ganados": j.sets,
        "Juegos ganados": j.juegos
      })
    );

  const hoja =
    XLSX.utils.json_to_sheet(datos);

  hoja["!cols"] = [
    { wch: 10 },
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 }
  ];

  const libro =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    libro,
    hoja,
    "RANKING"
  );

  XLSX.writeFile(
    libro,
    `Ranking_Club_Tenis_Lonquimay_${fechaActual()}.xlsx`
  );

}


/* ============================================================
   ABRIR / CERRAR ADMINISTRACIÓN DE JUGADORES
============================================================ */

function alternarAdministracionJugadores() {

  if (!esAdmin()) {
    return;
  }

  const panel =
    el("contenidoAdminJugadores");

  const boton =
    el("btnMostrarAdminJugadores");

  const estaOculto =
    panel.classList.contains("hidden");


  if (estaOculto) {

    panel.classList.remove("hidden");

    boton.textContent =
      "Cerrar administración de jugadores";

  } else {

    panel.classList.add("hidden");

    boton.textContent =
      "Administrar jugadores";

  }

}


/* ============================================================
   CREAR JUGADOR
   SOLO ADMINISTRADOR
============================================================ */

async function crearJugador(event) {

  event.preventDefault();

  ocultarMensaje("mensajeJugador");


  /* ---------------------------------------------------------
     SEGURIDAD
  --------------------------------------------------------- */

  if (!esAdmin()) {

    mostrarMensaje(
      "mensajeJugador",
      "Solo el administrador puede crear jugadores.",
      "error"
    );

    return;
  }


  /* ---------------------------------------------------------
     DATOS
  --------------------------------------------------------- */

  const nombre =
    el("nuevoNombre").value.trim();

  const categoria =
    Number(
      el("nuevaCategoria").value
    );


  /* ---------------------------------------------------------
     VALIDACIÓN NOMBRE
  --------------------------------------------------------- */

  if (!nombre) {

    mostrarMensaje(
      "mensajeJugador",
      "Debe ingresar el nombre del jugador.",
      "error"
    );

    return;
  }


  /* ---------------------------------------------------------
     VALIDACIÓN CATEGORÍA
  --------------------------------------------------------- */

  if (
    !(categoria >= 1 && categoria <= NUM_CATEGORIAS)
  ) {

    mostrarMensaje(
      "mensajeJugador",
      `Debe seleccionar una categoría entre 1 y ${NUM_CATEGORIAS}.`,
      "error"
    );

    return;
  }


  /* ---------------------------------------------------------
     CONTROL DE DUPLICADOS
  --------------------------------------------------------- */

  const nombreNormalizado =
    normalizarTexto(nombre);


  const jugadorDuplicado =
    jugadores.find(j =>

      normalizarTexto(
        j.nombre || ""
      ) === nombreNormalizado

    );


  if (jugadorDuplicado) {

    mostrarMensaje(
      "mensajeJugador",
      `El jugador "${jugadorDuplicado.nombre}" ya existe en la nómina.`,
      "error"
    );

    return;
  }


  /* ---------------------------------------------------------
     GUARDAR EN FIRESTORE
  --------------------------------------------------------- */

  try {

    await addDoc(

      collection(
        db,
        "jugadores"
      ),

      {

        nombre:
          nombre,

        categoria:
          categoria,

        activo:
          true,

        creadoPorUid:
          usuarioActual.uid,

        creadoPorEmail:
          usuarioActual.email || "",

        creadoEn:
          serverTimestamp()

      }

    );


    /* -------------------------------------------------------
       LIMPIAR FORMULARIO
    ------------------------------------------------------- */

    el("formJugador").reset();


    /* -------------------------------------------------------
       CONFIRMACIÓN
    ------------------------------------------------------- */

    mostrarMensaje(
      "mensajeJugador",
      `Jugador ${nombre} creado correctamente en Categoría ${categoria}.`,
      "ok"
    );


  } catch (error) {

    console.error(
      "Error al crear jugador:",
      error
    );


    mostrarMensaje(
      "mensajeJugador",
      "No fue posible crear el jugador.",
      "error"
    );

  }

}


/* ============================================================
   TABLA JUGADORES ADMIN
============================================================ */

function renderJugadoresAdmin() {

  if (!esAdmin()) {
    return;
  }

  const tbody =
    el("tablaJugadores");

  tbody.innerHTML = "";

  jugadores.forEach(j => {

    const tr =
      document.createElement("tr");

    const tdNombre =
      document.createElement("td");

    const inputNombre =
      document.createElement("input");

    inputNombre.value =
      j.nombre;

    tdNombre.appendChild(
      inputNombre
    );


    const tdCategoria =
      document.createElement("td");

    const selectCategoria =
      document.createElement("select");

    for (
      let categoria = 1;
      categoria <= NUM_CATEGORIAS;
      categoria++
    ) {

      const option =
        new Option(
          categoria,
          categoria
        );

      if (
        Number(j.categoria) ===
        categoria
      ) {
        option.selected = true;
      }

      selectCategoria.add(option);

    }

    tdCategoria.appendChild(
      selectCategoria
    );


    const tdEstado =
      document.createElement("td");

    tdEstado.textContent =
      j.activo === false
        ? "Inactivo"
        : "Activo";


    const tdAcciones =
      document.createElement("td");


    const btnGuardar =
      document.createElement("button");

    btnGuardar.textContent =
      "Guardar";

    btnGuardar.className =
      "btn btn-primary btn-small";

    btnGuardar.onclick =
      async () => {

        await updateDoc(
          doc(
            db,
            "jugadores",
            j.id
          ),
          {
            nombre:
              inputNombre.value.trim(),

            categoria:
              Number(
                selectCategoria.value
              ),

            modificadoEn:
              serverTimestamp()
          }
        );

      };


    const btnEstado =
      document.createElement("button");

    btnEstado.textContent =
      j.activo === false
        ? "Activar"
        : "Desactivar";

    btnEstado.className =
      j.activo === false
        ? "btn btn-success btn-small"
        : "btn btn-danger btn-small";

    btnEstado.onclick =
      async () => {

        await updateDoc(
          doc(
            db,
            "jugadores",
            j.id
          ),
          {
            activo:
              j.activo === false
          }
        );

      };


    tdAcciones.append(
      btnGuardar,
      document.createTextNode(" "),
      btnEstado
    );


    tr.append(
      tdNombre,
      tdCategoria,
      tdEstado,
      tdAcciones
    );

    tbody.appendChild(tr);

  });

}


/* ============================================================
   USUARIOS
============================================================ */

function escucharUsuarios() {

  if (!esAdmin()) {
    return;
  }

  if (unsubscribeUsuarios) {
    unsubscribeUsuarios();
  }

  unsubscribeUsuarios =
    onSnapshot(
      collection(db, "usuarios"),
      snapshot => {

        usuarios =
          snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
          }));

        renderUsuariosAdmin();

      }
    );

}


/* ============================================================
   TABLA USUARIOS ADMIN
============================================================ */

function renderUsuariosAdmin() {

  const tbody =
    el("tablaUsuarios");

  tbody.innerHTML = "";

  usuarios.forEach(u => {

    const tr =
      document.createElement("tr");


    const tdNombre =
      document.createElement("td");

    tdNombre.textContent =
      u.nombreGoogle || "";


    const tdEmail =
      document.createElement("td");

    tdEmail.textContent =
      u.email || "";


    const tdJugador =
      document.createElement("td");

    const selectJugador =
      document.createElement("select");

    selectJugador.add(
      new Option(
        "Sin jugador",
        ""
      )
    );

    jugadores.forEach(j => {

      const option =
        new Option(
          j.nombre,
          j.id
        );

      if (
        j.id ===
        u.jugadorId
      ) {
        option.selected = true;
      }

      selectJugador.add(option);

    });

    tdJugador.appendChild(
      selectJugador
    );


    const tdRol =
      document.createElement("td");

    const selectRol =
      document.createElement("select");

    selectRol.add(
      new Option(
        "Usuario",
        "usuario"
      )
    );

    selectRol.add(
      new Option(
        "Administrador",
        "admin"
      )
    );

    selectRol.value =
      u.rol || "usuario";

    tdRol.appendChild(
      selectRol
    );


    const tdActivo =
      document.createElement("td");

    const check =
      document.createElement("input");

    check.type = "checkbox";

    check.checked =
      u.activo !== false;

    tdActivo.appendChild(check);


    const tdGuardar =
      document.createElement("td");

    const boton =
      document.createElement("button");

    boton.textContent =
      "Guardar";

    boton.className =
      "btn btn-primary btn-small";

    boton.onclick =
      async () => {

        const jugador =
          jugadores.find(
            j =>
              j.id ===
              selectJugador.value
          );

        await updateDoc(
          doc(
            db,
            "usuarios",
            u.id
          ),
          {
            jugadorId:
              selectJugador.value || null,

            jugadorNombre:
              jugador
                ? jugador.nombre
                : null,

            rol:
              selectRol.value,

            activo:
              check.checked,

            modificadoEn:
              serverTimestamp(),

            modificadoPorUid:
              usuarioActual.uid
          }
        );

        window.alert(
          "Perfil actualizado."
        );

      };

    tdGuardar.appendChild(boton);


    tr.append(
      tdNombre,
      tdEmail,
      tdJugador,
      tdRol,
      tdActivo,
      tdGuardar
    );

    tbody.appendChild(tr);

  });

}


/* ============================================================
   AUDITORÍA
============================================================ */

function escucharAuditoria() {

  if (!esAdmin()) {
    return;
  }

  if (unsubscribeAuditoria) {
    unsubscribeAuditoria();
  }

  const q = query(
    collection(db, "auditoria"),
    orderBy(
      "fecha",
      "desc"
    ),
    limit(100)
  );

  unsubscribeAuditoria =
    onSnapshot(q, snapshot => {

      const tbody =
        el("tablaAuditoria");

      tbody.innerHTML = "";

      snapshot.docs.forEach(d => {

        const dato =
          d.data();

        const tr =
          document.createElement("tr");

        const fecha =
          dato.fecha?.toDate
            ? dato.fecha
                .toDate()
                .toLocaleString("es-CL")
            : "";

        [
          fecha,
          dato.accion || "",
          dato.numeroRegistro || "",
          dato.usuarioEmail || ""
        ]
          .forEach(valor => {

            const td =
              document.createElement("td");

            td.textContent = valor;

            tr.appendChild(td);

          });

        tbody.appendChild(tr);

      });

    });

}


/* ============================================================
   LIMPIAR
============================================================ */

function limpiarFormularioPartido() {

  el("fecha").value =
    fechaActual();

  el("jugadorA").value = "";
  el("jugadorB").value = "";

  el("categoriaA").value = "";
  el("categoriaB").value = "";

  el("tipoPartido").value = "normal";
  el("enfrentamientoLiga").value = "";
  actualizarTipoPartido();

  el("chkWalkover").checked = false;
  actualizarWalkover();

  limpiarMarcadores();

}


function limpiarMarcadores() {

  el("set1A").value = "";
  el("set1B").value = "";

  el("set2A").value = "";
  el("set2B").value = "";

  el("tipoSet3").value =
    "normal";

  actualizarRangoSet3();

  el("set3A").value = "";
  el("set3B").value = "";

}


/* ============================================================
   LISTENERS
============================================================ */

function detenerListeners() {

  if (unsubscribeJugadores) {
    unsubscribeJugadores();
    unsubscribeJugadores = null;
  }

  if (unsubscribePartidos) {
    unsubscribePartidos();
    unsubscribePartidos = null;
  }

  if (unsubscribeUsuarios) {
    unsubscribeUsuarios();
    unsubscribeUsuarios = null;
  }

  if (unsubscribeAuditoria) {
    unsubscribeAuditoria();
    unsubscribeAuditoria = null;
  }

  if (unsubscribeFechas) {
    unsubscribeFechas();
    unsubscribeFechas = null;
  }

  if (unsubscribeCierres) {
    unsubscribeCierres();
    unsubscribeCierres = null;
  }

}


/* ============================================================
   UTILIDADES
============================================================ */

function numeroSelect(id) {

  const valor =
    el(id).value;

  return valor === ""
    ? null
    : Number(valor);

}


function fechaActual() {

  const ahora =
    new Date();

  const y =
    ahora.getFullYear();

  const m =
    String(
      ahora.getMonth() + 1
    ).padStart(2, "0");

  const d =
    String(
      ahora.getDate()
    ).padStart(2, "0");

  return `${y}-${m}-${d}`;

}


function normalizarTexto(texto) {

  return String(texto)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .toLowerCase();

}


function copiarDatosAuditoria(objeto) {

  const copia = {};

  Object.entries(objeto)
    .forEach(([clave, valor]) => {

      /*
        Evitamos objetos Firestore complejos
        innecesarios en la auditoría.
      */

      if (
        valor === null ||
        typeof valor === "string" ||
        typeof valor === "number" ||
        typeof valor === "boolean"
      ) {

        copia[clave] = valor;

      }

    });

  return copia;

}


/* ============================================================
   MENSAJES
============================================================ */

function mostrarMensaje(
  id,
  texto,
  tipo
) {

  const caja = el(id);

  caja.textContent = texto;

  caja.className =
    `message ${tipo}`;

}


function ocultarMensaje(id) {

  const caja = el(id);

  caja.textContent = "";

  caja.className =
    "message hidden";

}


/* ============================================================
   PESTAÑAS
============================================================ */

function mostrarTab(nombre) {

  if (nombre === "admin" && !esAdmin()) {
    nombre = "registrar";
  }

  document
    .querySelectorAll("[data-tab-panel]")
    .forEach(x =>
      x.classList.toggle(
        "tab-oculta",
        x.dataset.tabPanel !== nombre
      )
    );

  document
    .querySelectorAll(".tab-btn")
    .forEach(b =>
      b.classList.toggle(
        "activa",
        b.dataset.tab === nombre
      )
    );

}


/* ============================================================
   FORMULARIO: TIPO DE PARTIDO / WALKOVER
============================================================ */

function actualizarTipoPartido(limpiarSeleccion = true) {

  const esLiga =
    el("tipoPartido").value === "liga";

  el("bloqueLiga")
    .classList
    .toggle("hidden", !esLiga);

  el("jugadorA").disabled = esLiga;
  el("jugadorB").disabled = esLiga;

  if (esLiga) {

    cargarSelectEnfrentamientos();

    if (limpiarSeleccion !== false) {
      seleccionarEnfrentamiento();
    }

  }

}


function actualizarWalkover() {

  const wo =
    el("chkWalkover").checked;

  el("bloqueWO")
    .classList
    .toggle("hidden", !wo);

  [
    "set1A", "set1B",
    "set2A", "set2B",
    "set3A", "set3B",
    "tipoSet3"
  ].forEach(id => {

    el(id).disabled = wo;

    if (wo && id !== "tipoSet3") {
      el(id).value = "";
    }

  });

}


function cargarSelectEnfrentamientos() {

  const select =
    el("enfrentamientoLiga");

  if (!select) {
    return;
  }

  const anterior =
    select.value;

  select.innerHTML =
    '<option value="">Seleccione partido de liga</option>';

  const editandoId =
    partidoEnEdicion?.idFirestore || null;

  fechasLiga.forEach(f => {

    (f.enfrentamientos || []).forEach((e, idx) => {

      const valor =
        `${f.id}|${idx}`;

      const cargado =
        partidoDeEnfrentamiento(f.id, idx);

      const esEdicion =
        cargado &&
        cargado.idFirestore === editandoId;

      if (cargado && !esEdicion) {
        return;
      }

      if (
        !esAdmin() &&
        perfilActual &&
        e.jugadorAId !== perfilActual.jugadorId &&
        e.jugadorBId !== perfilActual.jugadorId
      ) {
        return;
      }

      const option =
        new Option(
          `${f.fecha} · ${nombreFecha(f)} · Cat. ${e.categoria} · ` +
          `${e.jugadorA} vs ${e.jugadorB} (${e.hora}, cancha ${e.cancha})`,
          valor
        );

      select.add(option);

    });

  });

  if (
    [...select.options]
      .some(o => o.value === anterior)
  ) {
    select.value = anterior;
  }

}


function seleccionarEnfrentamiento() {

  const valor =
    el("enfrentamientoLiga").value;

  if (!valor) {
    return;
  }

  const [fechaId, idxTxt] =
    valor.split("|");

  const f =
    fechasLiga.find(x => x.id === fechaId);

  const e =
    f?.enfrentamientos?.[Number(idxTxt)];

  if (!e) {
    return;
  }

  el("fecha").value = f.fecha;

  asegurarOpcionJugador("jugadorA", e.jugadorAId, e.jugadorA, e.categoria);
  asegurarOpcionJugador("jugadorB", e.jugadorBId, e.jugadorB, e.categoria);

  el("jugadorA").value = e.jugadorAId;
  el("jugadorB").value = e.jugadorBId;

  cargarCategoria("A");
  cargarCategoria("B");

  // En la liga vale la categoría que tenía el jugador al sortear la fecha.
  el("categoriaA").value = e.categoria;
  el("categoriaB").value = e.categoria;

}


function asegurarOpcionJugador(idSelect, id, nombre, categoria) {

  const select = el(idSelect);

  if (![...select.options].some(o => o.value === id)) {

    const option =
      new Option(nombre, id);

    option.dataset.nombre = nombre;
    option.dataset.categoria = categoria;

    select.add(option);

  }

}


/* ============================================================
   LIGA: DATOS EN TIEMPO REAL
============================================================ */

function escucharFechasLiga() {

  if (unsubscribeFechas) {
    unsubscribeFechas();
  }

  const q = query(
    collection(db, "fechasLiga"),
    orderBy("fecha")
  );

  unsubscribeFechas =
    onSnapshot(q, snapshot => {

      fechasLiga = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      renderLiga();
      renderCategorias();
      cargarSelectEnfrentamientos();

    }, error => {

      console.error("Error leyendo fechasLiga:", error);

      el("listaFechasLiga").innerHTML =
        '<p class="message error">No se pudieron leer las fechas de liga. Revise las reglas de Firestore (colección fechasLiga).</p>';

    });

}


function escucharCierres() {

  if (unsubscribeCierres) {
    unsubscribeCierres();
  }

  unsubscribeCierres =
    onSnapshot(
      collection(db, "cierres"),
      snapshot => {

        cierres = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        renderCategorias();

      },
      error => {
        console.error("Error leyendo cierres:", error);
      }
    );

}


function partidoDeEnfrentamiento(fechaId, idx) {

  return partidos.find(p =>
    p.estado !== "anulado" &&
    p.fechaLigaId === fechaId &&
    Number(p.enfrentamientoIdx) === Number(idx)
  ) || null;

}


function nombreFecha(f) {

  return f.nombre
    ? `Fecha ${f.numero} – ${f.nombre}`
    : `Fecha ${f.numero}`;

}


/* ============================================================
   LIGA: CREAR FECHA Y SORTEAR
============================================================ */

function sortearFecha(horaInicio, duracionMin) {

  const enfrentamientos = [];

  const libres = [];

  for (let c = 1; c <= NUM_CATEGORIAS; c++) {

    const lista =
      mezclar(
        jugadores.filter(j =>
          j.activo !== false &&
          Number(j.categoria) === c
        )
      );

    for (let i = 0; i + 1 < lista.length; i += 2) {

      enfrentamientos.push({
        categoria: c,
        jugadorAId: lista[i].id,
        jugadorA: lista[i].nombre,
        jugadorBId: lista[i + 1].id,
        jugadorB: lista[i + 1].nombre
      });

    }

    if (lista.length % 2 === 1) {

      const j =
        lista[lista.length - 1];

      libres.push({
        categoria: c,
        jugadorId: j.id,
        nombre: j.nombre
      });

    }

  }

  // Bloques de 4 partidos simultáneos (uno por cancha).

  enfrentamientos.forEach((e, i) => {

    e.cancha =
      (i % NUM_CANCHAS) + 1;

    e.hora =
      sumarMinutos(
        horaInicio,
        Math.floor(i / NUM_CANCHAS) * duracionMin
      );

  });

  return { enfrentamientos, libres };

}


async function crearFechaLiga(event) {

  event.preventDefault();

  ocultarMensaje("mensajeLiga");

  if (!esAdmin()) {
    return;
  }

  const fecha =
    el("fechaNuevaLiga").value;

  const numero =
    Number(el("numeroNuevaLiga").value);

  const nombre =
    el("nombreNuevaLiga").value.trim();

  const horaInicio =
    el("horaNuevaLiga").value;

  const duracionMin =
    Number(el("duracionNuevaLiga").value);

  if (!fecha || !horaInicio || !duracionMin) {

    mostrarMensaje(
      "mensajeLiga",
      "Complete fecha, hora de inicio y duración del bloque.",
      "error"
    );

    return;

  }

  const mes =
    fecha.slice(0, 7);

  if (cierres.some(c => c.id === mes)) {

    mostrarMensaje(
      "mensajeLiga",
      `El mes ${mes} ya está cerrado. No se pueden agregar fechas.`,
      "error"
    );

    return;

  }

  if (
    fechasLiga.some(f =>
      f.mes === mes &&
      Number(f.numero) === numero
    )
  ) {

    mostrarMensaje(
      "mensajeLiga",
      `Ya existe la Fecha ${numero} de ${mes}.`,
      "error"
    );

    return;

  }

  const sorteo =
    sortearFecha(horaInicio, duracionMin);

  if (sorteo.enfrentamientos.length === 0) {

    mostrarMensaje(
      "mensajeLiga",
      "No hay jugadores suficientes para sortear.",
      "error"
    );

    return;

  }

  try {

    const ref = await addDoc(
      collection(db, "fechasLiga"),
      {
        mes,
        numero,
        nombre,
        fecha,
        horaInicio,
        duracionMin,
        ...sorteo,
        creadoPorEmail: usuarioActual.email || "",
        creadoEn: serverTimestamp()
      }
    );

    await addDoc(
      collection(db, "auditoria"),
      {
        accion: "CREACIÓN Y SORTEO FECHA DE LIGA",
        numeroRegistro: `${mes} F${numero}`,
        fechaLigaId: ref.id,
        usuarioUid: usuarioActual.uid,
        usuarioEmail: usuarioActual.email || "",
        fecha: serverTimestamp()
      }
    );

    el("mesLiga").value = mes;

    el("nombreNuevaLiga").value = "";

    mostrarMensaje(
      "mensajeLiga",
      `Fecha ${numero} creada: ${sorteo.enfrentamientos.length} partidos sorteados.`,
      "ok"
    );

  }

  catch (error) {

    console.error(error);

    mostrarMensaje(
      "mensajeLiga",
      "No fue posible crear la fecha. Revise las reglas de Firestore (colección fechasLiga).",
      "error"
    );

  }

}


async function resortearFecha(f) {

  if (!esAdmin()) {
    return;
  }

  if (
    (f.enfrentamientos || [])
      .some((e, i) => partidoDeEnfrentamiento(f.id, i))
  ) {

    window.alert("Esta fecha ya tiene resultados cargados. Anule esos partidos antes de volver a sortear.");

    return;

  }

  if (!window.confirm(`¿Volver a sortear ${nombreFecha(f)} (${f.fecha})?`)) {
    return;
  }

  const sorteo =
    sortearFecha(f.horaInicio, Number(f.duracionMin));

  await updateDoc(
    doc(db, "fechasLiga", f.id),
    {
      ...sorteo,
      modificadoEn: serverTimestamp()
    }
  );

}


async function eliminarFecha(f) {

  if (!esAdmin()) {
    return;
  }

  if (
    (f.enfrentamientos || [])
      .some((e, i) => partidoDeEnfrentamiento(f.id, i))
  ) {

    window.alert("Esta fecha tiene resultados cargados. Anule esos partidos antes de eliminarla.");

    return;

  }

  if (!window.confirm(`¿Eliminar ${nombreFecha(f)} (${f.fecha})?`)) {
    return;
  }

  await deleteDoc(
    doc(db, "fechasLiga", f.id)
  );

  await addDoc(
    collection(db, "auditoria"),
    {
      accion: "ELIMINACIÓN FECHA DE LIGA",
      numeroRegistro: `${f.mes} F${f.numero}`,
      usuarioUid: usuarioActual.uid,
      usuarioEmail: usuarioActual.email || "",
      fecha: serverTimestamp()
    }
  );

}


function cargarResultadoLiga(f, idx) {

  mostrarTab("registrar");

  cancelarEdicion();

  el("tipoPartido").value = "liga";

  cargarSelectEnfrentamientos();

  el("enfrentamientoLiga").value =
    `${f.id}|${idx}`;

  actualizarTipoPartido(false);

  seleccionarEnfrentamiento();

  window.scrollTo({ top: 0, behavior: "smooth" });

}


/* ============================================================
   LIGA: VISTA
============================================================ */

function renderLiga() {

  const cont =
    el("listaFechasLiga");

  if (!cont) {
    return;
  }

  const mes =
    el("mesLiga").value;

  const delMes =
    fechasLiga
      .filter(f => f.mes === mes)
      .sort((a, b) =>
        Number(a.numero) - Number(b.numero)
      );

  cont.innerHTML = "";

  if (delMes.length === 0) {

    cont.innerHTML =
      '<p class="note">No hay fechas de liga programadas para este mes.</p>';

    return;

  }

  delMes.forEach(f => {

    const card =
      document.createElement("div");

    card.className = "fecha-liga";

    const cargados =
      (f.enfrentamientos || [])
        .filter((e, i) => partidoDeEnfrentamiento(f.id, i))
        .length;

    const head =
      document.createElement("div");

    head.className = "fecha-liga-head";

    const titulo =
      document.createElement("div");

    titulo.innerHTML =
      `<strong></strong><div class="small-muted"></div>`;

    titulo.querySelector("strong").textContent =
      nombreFecha(f);

    titulo.querySelector("div").textContent =
      `${formatearFecha(f.fecha)} · desde las ${f.horaInicio} · ` +
      `${cargados}/${(f.enfrentamientos || []).length} resultados`;

    head.appendChild(titulo);

    if (esAdmin()) {

      const acciones =
        document.createElement("div");

      const b1 =
        document.createElement("button");

      b1.className = "btn btn-light btn-small";
      b1.textContent = "Volver a sortear";
      b1.onclick = () => resortearFecha(f);

      const b2 =
        document.createElement("button");

      b2.className = "btn btn-danger btn-small";
      b2.textContent = "Eliminar";
      b2.onclick = () => eliminarFecha(f);

      acciones.append(b1, document.createTextNode(" "), b2);

      head.appendChild(acciones);

    }

    card.appendChild(head);

    const wrap =
      document.createElement("div");

    wrap.className = "table-scroll";

    const tabla =
      document.createElement("table");

    tabla.innerHTML =
      "<thead><tr><th>Hora</th><th>Cancha</th><th>Cat.</th>" +
      "<th>Jugador A</th><th>Jugador B</th><th>Resultado</th><th></th></tr></thead>";

    const tbody =
      document.createElement("tbody");

    (f.enfrentamientos || []).forEach((e, idx) => {

      const tr =
        document.createElement("tr");

      const p =
        partidoDeEnfrentamiento(f.id, idx);

      [
        e.hora,
        e.cancha,
        e.categoria,
        e.jugadorA,
        e.jugadorB,
        p ? marcadorPartido(p).replace(" · LIGA", "") : "Pendiente"
      ].forEach(v => {

        const td =
          document.createElement("td");

        td.textContent = v;

        tr.appendChild(td);

      });

      const tdAccion =
        document.createElement("td");

      const participa =
        perfilActual &&
        (
          e.jugadorAId === perfilActual.jugadorId ||
          e.jugadorBId === perfilActual.jugadorId
        );

      if (!p && (esAdmin() || participa)) {

        const b =
          document.createElement("button");

        b.className = "btn btn-primary btn-small";
        b.textContent = "Cargar resultado";
        b.onclick = () => cargarResultadoLiga(f, idx);

        tdAccion.appendChild(b);

      }

      if (p) {
        tdAccion.textContent = `N.º ${p.numeroRegistro}`;
      }

      tr.appendChild(tdAccion);

      if (p) {
        tr.classList.add("fila-ok");
      }

      tbody.appendChild(tr);

    });

    tabla.appendChild(tbody);

    wrap.appendChild(tabla);

    card.appendChild(wrap);

    if ((f.libres || []).length) {

      const libres =
        document.createElement("p");

      libres.className = "note";

      libres.textContent =
        "Libres (categoría impar, cuentan como presentes): " +
        f.libres
          .map(l => `${l.nombre} (Cat. ${l.categoria})`)
          .join(", ");

      card.appendChild(libres);

    }

    cont.appendChild(card);

  });

}


/* ============================================================
   CATEGORÍAS: TABLA MENSUAL Y MOVIMIENTOS
============================================================ */

function calcularCategoriasMes(mes) {

  const fechasMes =
    fechasLiga.filter(f => f.mes === mes);

  const filas = {};

  const fila = (id, nombre, categoria) => {

    if (!filas[id]) {

      const j =
        jugadores.find(x => x.id === id);

      filas[id] = {
        jugadorId: id,
        nombre: j?.nombre || nombre,
        categoria: Number(categoria),
        convocadas: 0,
        presentes: 0,
        pendientes: 0,
        puntos: 0,
        sets: 0,
        juegos: 0
      };

    }

    return filas[id];

  };

  fechasMes.forEach(f => {

    (f.enfrentamientos || []).forEach((e, idx) => {

      const a = fila(e.jugadorAId, e.jugadorA, e.categoria);
      const b = fila(e.jugadorBId, e.jugadorB, e.categoria);

      a.convocadas++;
      b.convocadas++;

      const p =
        partidoDeEnfrentamiento(f.id, idx);

      if (!p) {
        a.pendientes++;
        b.pendientes++;
        return;
      }

      const pts =
        puntosPartido(p);

      // Si el partido se cargó con los jugadores en otro orden.
      const invertido =
        p.jugadorAId !== e.jugadorAId;

      a.puntos += invertido ? pts.b : pts.a;
      b.puntos += invertido ? pts.a : pts.b;

      a.sets += Number(invertido ? p.setsB : p.setsA) || 0;
      b.sets += Number(invertido ? p.setsA : p.setsB) || 0;

      a.juegos += Number(invertido ? p.juegosB : p.juegosA) || 0;
      b.juegos += Number(invertido ? p.juegosA : p.juegosB) || 0;

      if (p.walkover) {

        if (p.ganadorId === a.jugadorId) {
          a.presentes++;
        }
        else {
          b.presentes++;
        }

      }

      else {

        a.presentes++;
        b.presentes++;

      }

    });

    (f.libres || []).forEach(l => {

      const x =
        fila(l.jugadorId, l.nombre, l.categoria);

      x.convocadas++;
      x.presentes++;

    });

  });

  const porCategoria = [];

  for (let c = 1; c <= NUM_CATEGORIAS; c++) {

    const lista =
      Object.values(filas)
        .filter(x => x.categoria === c);

    if (lista.length === 0) {
      continue;
    }

    lista.forEach(x => {
      x.inactivo =
        x.convocadas > 0 &&
        x.presentes === 0 &&
        x.pendientes === 0;
    });

    const orden = (a, b) =>
      b.puntos - a.puntos ||
      b.sets - a.sets ||
      b.juegos - a.juegos ||
      a.nombre.localeCompare(b.nombre, "es");

    const activos =
      lista
        .filter(x => !x.inactivo)
        .sort(orden);

    const inactivos =
      lista
        .filter(x => x.inactivo)
        .sort(orden);

    const suben =
      c > 1
        ? activos.slice(0, 2)
        : [];

    const cuposBaja =
      Math.max(0, 2 - inactivos.length);

    const candidatosBaja =
      activos.filter(x => !suben.includes(x));

    const bajanActivos =
      c < NUM_CATEGORIAS && cuposBaja > 0
        ? candidatosBaja.slice(-cuposBaja)
        : [];

    lista.forEach(x => {

      x.movimiento = "=";
      x.motivo = "";

      if (suben.includes(x)) {
        x.movimiento = "sube";
        x.motivo = "Top 2";
      }

      if (bajanActivos.includes(x)) {
        x.movimiento = "baja";
        x.motivo = "Últimos 2";
      }

      if (x.inactivo && c < NUM_CATEGORIAS) {
        x.movimiento = "baja";
        x.motivo = "No se presentó";
      }

    });

    porCategoria.push({
      categoria: c,
      filas: [...activos, ...inactivos]
    });

  }

  const pendientes =
    fechasMes.reduce((acc, f) =>
      acc + (f.enfrentamientos || [])
        .filter((e, i) => !partidoDeEnfrentamiento(f.id, i))
        .length,
    0);

  return {
    fechasMes,
    porCategoria,
    pendientes
  };

}


function renderCategorias() {

  const cont =
    el("tablasCategorias");

  if (!cont || !el("mesLiga")) {
    return;
  }

  const mes =
    el("mesLiga").value;

  el("mesCategoriasTitulo").textContent =
    nombreMes(mes);

  const cierre =
    cierres.find(c => c.id === mes);

  cont.innerHTML = "";

  let tablas;

  if (cierre) {

    tablas = cierre.tablas || [];

    el("estadoMes").textContent =
      `Mes cerrado el ${cierre.cerradoEn?.toDate ? cierre.cerradoEn.toDate().toLocaleDateString("es-CL") : ""} por ${cierre.cerradoPorEmail || ""}. Movimientos ya aplicados.`;

    el("estadoMes").className = "message ok";

    el("btnCerrarMes").disabled = true;

  }

  else {

    const calc =
      calcularCategoriasMes(mes);

    tablas = calc.porCategoria;

    if (calc.fechasMes.length === 0) {

      el("estadoMes").textContent =
        "Este mes no tiene fechas de liga. No hay movimientos.";

      el("estadoMes").className = "message";

      el("btnCerrarMes").disabled = true;

    }

    else {

      el("estadoMes").textContent =
        `Vista previa (mes abierto) · ${calc.fechasMes.length} fecha(s)` +
        (calc.pendientes
          ? ` · ${calc.pendientes} partido(s) sin resultado`
          : " · todos los resultados cargados");

      el("estadoMes").className =
        calc.pendientes ? "message error" : "message ok";

      el("btnCerrarMes").disabled = false;

    }

  }

  if (tablas.length === 0) {

    cont.innerHTML =
      '<p class="note">Sin datos de liga para este mes.</p>';

    return;

  }

  tablas.forEach(t => {

    const bloque =
      document.createElement("div");

    bloque.className = "categoria-bloque";

    const h =
      document.createElement("h3");

    h.textContent =
      `Categoría ${t.categoria}`;

    bloque.appendChild(h);

    const wrap =
      document.createElement("div");

    wrap.className = "table-scroll";

    const tabla =
      document.createElement("table");

    tabla.innerHTML =
      "<thead><tr><th>Pos.</th><th>Jugador</th><th>Fechas</th>" +
      "<th>Pts liga</th><th>Sets</th><th>Juegos</th><th>Movimiento</th></tr></thead>";

    const tbody =
      document.createElement("tbody");

    t.filas.forEach((x, i) => {

      const tr =
        document.createElement("tr");

      const mov =
        x.movimiento === "sube"
          ? `▲ Sube a ${x.categoria - 1}ª`
          : x.movimiento === "baja"
            ? `▼ Baja a ${x.categoria + 1}ª (${x.motivo})`
            : "= Se mantiene";

      [
        i + 1,
        x.nombre,
        `${x.presentes}/${x.convocadas}` + (x.pendientes ? ` (${x.pendientes} pend.)` : ""),
        x.puntos,
        x.sets,
        x.juegos,
        mov
      ].forEach(v => {

        const td =
          document.createElement("td");

        td.textContent = v;

        tr.appendChild(td);

      });

      if (x.movimiento === "sube") {
        tr.classList.add("fila-sube");
      }

      if (x.movimiento === "baja") {
        tr.classList.add("fila-baja");
      }

      tbody.appendChild(tr);

    });

    tabla.appendChild(tbody);

    wrap.appendChild(tabla);

    bloque.appendChild(wrap);

    cont.appendChild(bloque);

  });

}


/* ============================================================
   CIERRE DE MES (ADMIN)
============================================================ */

async function cerrarMes() {

  if (!esAdmin()) {
    return;
  }

  const mes =
    el("mesLiga").value;

  if (cierres.some(c => c.id === mes)) {

    window.alert("Este mes ya fue cerrado.");

    return;

  }

  const calc =
    calcularCategoriasMes(mes);

  if (calc.fechasMes.length === 0) {
    return;
  }

  const movimientos = [];

  calc.porCategoria.forEach(t =>
    t.filas.forEach(x => {

      if (x.movimiento === "=") {
        return;
      }

      movimientos.push({
        jugadorId: x.jugadorId,
        nombre: x.nombre,
        de: x.categoria,
        a: x.movimiento === "sube"
          ? x.categoria - 1
          : x.categoria + 1,
        motivo: x.motivo
      });

    })
  );

  let texto =
    `Cerrar ${nombreMes(mes)} y aplicar ${movimientos.length} movimiento(s):\n\n` +
    movimientos
      .map(m => `• ${m.nombre}: ${m.de}ª → ${m.a}ª (${m.motivo})`)
      .join("\n");

  if (calc.pendientes) {
    texto +=
      `\n\nATENCIÓN: hay ${calc.pendientes} partido(s) sin resultado. ` +
      "Esos partidos no suman puntos. Si alguien no se presentó, cárguelo como walkover antes de cerrar.";
  }

  texto += "\n\nEsta acción cambia las categorías de los jugadores. ¿Continuar?";

  if (!window.confirm(texto)) {
    return;
  }

  try {

    const tablas =
      calc.porCategoria.map(t => ({
        categoria: t.categoria,
        filas: t.filas.map(x => ({
          jugadorId: x.jugadorId,
          nombre: x.nombre,
          categoria: x.categoria,
          convocadas: x.convocadas,
          presentes: x.presentes,
          pendientes: x.pendientes,
          puntos: x.puntos,
          sets: x.sets,
          juegos: x.juegos,
          movimiento: x.movimiento,
          motivo: x.motivo
        }))
      }));

    await setDoc(
      doc(db, "cierres", mes),
      {
        mes,
        movimientos,
        tablas,
        cerradoPorUid: usuarioActual.uid,
        cerradoPorEmail: usuarioActual.email || "",
        cerradoEn: serverTimestamp()
      }
    );

    for (const m of movimientos) {

      await updateDoc(
        doc(db, "jugadores", m.jugadorId),
        {
          categoria: m.a,
          modificadoEn: serverTimestamp()
        }
      );

    }

    await addDoc(
      collection(db, "auditoria"),
      {
        accion: "CIERRE DE MES (SUBEN/BAJAN)",
        numeroRegistro: mes,
        usuarioUid: usuarioActual.uid,
        usuarioEmail: usuarioActual.email || "",
        movimientos,
        fecha: serverTimestamp()
      }
    );

    window.alert(`${nombreMes(mes)} cerrado. Categorías actualizadas.`);

  }

  catch (error) {

    console.error(error);

    window.alert("No fue posible cerrar el mes. Revise las reglas de Firestore (colección cierres).");

  }

}


/* ============================================================
   UTILIDADES LIGA
============================================================ */

function mezclar(lista) {

  const a = lista.slice();

  for (let i = a.length - 1; i > 0; i--) {

    const r = new Uint32Array(1);

    crypto.getRandomValues(r);

    const j = r[0] % (i + 1);

    [a[i], a[j]] = [a[j], a[i]];

  }

  return a;

}


function sumarMinutos(hora, minutos) {

  const [h, m] =
    hora.split(":").map(Number);

  const total =
    h * 60 + m + minutos;

  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

}


function formatearFecha(iso) {

  if (!iso) {
    return "";
  }

  const [y, m, d] =
    iso.split("-").map(Number);

  return new Date(y, m - 1, d)
    .toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });

}


function nombreMes(mes) {

  if (!mes) {
    return "";
  }

  const [y, m] =
    mes.split("-").map(Number);

  const txt =
    new Date(y, m - 1, 1)
      .toLocaleDateString("es-CL", {
        month: "long",
        year: "numeric"
      });

  return txt.charAt(0).toUpperCase() + txt.slice(1);

}



/* ============================================================
   NÓMINA OFICIAL LIGA 2026–27 (SINCRONIZAR)
   Crea a los que faltan, corrige categorías y reactiva.
============================================================ */

const NOMINA_LIGA = [
  { nombre: "Alan Gamin", categoria: 1 },
  { nombre: "Diego Labrín", categoria: 1 },
  { nombre: "Claudio Díaz", categoria: 1 },
  { nombre: "Felipe Espinoza", categoria: 1 },
  { nombre: "Rodrigo Alday", categoria: 1 },
  { nombre: "Philip Bruna", categoria: 1 },

  { nombre: "Luis Figueroa", categoria: 2 },
  { nombre: "Luis Gatica", categoria: 2 },
  { nombre: "Juan Carlos Silva", categoria: 2 },
  { nombre: "Luis Osses", categoria: 2 },
  { nombre: "Gabriel Osorio", categoria: 2 },
  { nombre: "Cristian Durán", categoria: 2 },

  { nombre: "Daniel Carrasco", categoria: 3 },
  { nombre: "Danilo Mendoza", categoria: 3 },
  { nombre: "Daniel Leal", categoria: 3 },
  { nombre: "Waldo González", categoria: 3 },
  { nombre: "Ismael Ríos", categoria: 3 },
  { nombre: "Víctor Pailla", categoria: 3, alias: ["Tochito Pailla"] },
  { nombre: "Rodrigo Breve", categoria: 3 },
  { nombre: "Roger Contreras", categoria: 3 },

  { nombre: "Paula Ortiz", categoria: 4 },
  { nombre: "Glenda Rivera", categoria: 4 },
  { nombre: "Fernando Uribe", categoria: 4 },
  { nombre: "Cristian Rüedi", categoria: 4 },

  { nombre: "Víctor Millán", categoria: 5 },
  { nombre: "Karina Mellado", categoria: 5 },
  { nombre: "Felipe Acuña", categoria: 5 },
  { nombre: "Gustavo Alarcón", categoria: 5 },
  { nombre: "Farid Ducom", categoria: 5 },
  { nombre: "Lissette Villalba", categoria: 5 }
];


async function sincronizarNomina() {

  if (!esAdmin()) {
    return;
  }

  const usados = new Set();

  const crear = [];

  const cambiar = [];

  NOMINA_LIGA.forEach(n => {

    const claves =
      [n.nombre, ...(n.alias || [])]
        .map(normalizarTexto);

    const existente =
      jugadores.find(j =>
        !usados.has(j.id) &&
        claves.includes(normalizarTexto(j.nombre || ""))
      );

    if (!existente) {
      crear.push(n);
      return;
    }

    usados.add(existente.id);

    const cambios = {};

    if (Number(existente.categoria) !== n.categoria) {
      cambios.categoria = n.categoria;
    }

    if (normalizarTexto(existente.nombre) !== normalizarTexto(n.nombre)) {
      cambios.nombre = n.nombre;
    }

    if (existente.activo === false) {
      cambios.activo = true;
    }

    if (Object.keys(cambios).length) {
      cambiar.push({ jugador: existente, cambios });
    }

  });

  const sobran =
    jugadores.filter(j =>
      j.activo !== false &&
      !usados.has(j.id)
    );

  if (!crear.length && !cambiar.length && !sobran.length) {

    window.alert("La nómina ya está al día. No hay cambios.");

    return;

  }

  const texto =
    "ACTUALIZAR NÓMINA LIGA 2026–27\n\n" +
    (crear.length
      ? `Jugadores nuevos (${crear.length}):\n` +
        crear.map(n => `• ${n.nombre} → ${n.categoria}ª`).join("\n") + "\n\n"
      : "") +
    (cambiar.length
      ? `Cambios (${cambiar.length}):\n` +
        cambiar.map(c =>
          `• ${c.jugador.nombre}: ` +
          [
            c.cambios.nombre ? `nombre → ${c.cambios.nombre}` : "",
            c.cambios.categoria ? `${c.jugador.categoria}ª → ${c.cambios.categoria}ª` : "",
            c.cambios.activo ? "reactivar" : ""
          ].filter(Boolean).join(", ")
        ).join("\n") + "\n\n"
      : "") +
    "¿Aplicar?";

  if (
    (crear.length || cambiar.length) &&
    !window.confirm(texto)
  ) {
    return;
  }

  try {

    for (const n of crear) {

      await addDoc(
        collection(db, "jugadores"),
        {
          nombre: n.nombre,
          categoria: n.categoria,
          activo: true,
          creadoPorUid: usuarioActual.uid,
          creadoPorEmail: usuarioActual.email || "",
          creadoEn: serverTimestamp()
        }
      );

    }

    for (const c of cambiar) {

      await updateDoc(
        doc(db, "jugadores", c.jugador.id),
        {
          ...c.cambios,
          modificadoEn: serverTimestamp()
        }
      );

    }

    let desactivados = 0;

    if (
      sobran.length &&
      window.confirm(
        `Estos jugadores activos NO están en la nómina de la liga:\n\n` +
        sobran.map(j => `• ${j.nombre} (${j.categoria}ª)`).join("\n") +
        "\n\n¿Desactivarlos? (sus partidos se conservan)"
      )
    ) {

      for (const j of sobran) {

        await updateDoc(
          doc(db, "jugadores", j.id),
          {
            activo: false,
            modificadoEn: serverTimestamp()
          }
        );

        desactivados++;

      }

    }

    await addDoc(
      collection(db, "auditoria"),
      {
        accion: "ACTUALIZACIÓN NÓMINA LIGA",
        numeroRegistro: `${crear.length} nuevos · ${cambiar.length} cambios · ${desactivados} desactivados`,
        usuarioUid: usuarioActual.uid,
        usuarioEmail: usuarioActual.email || "",
        fecha: serverTimestamp()
      }
    );

    mostrarMensaje(
      "mensajeJugador",
      `Nómina actualizada: ${crear.length} nuevos, ${cambiar.length} cambios, ${desactivados} desactivados.`,
      "ok"
    );

  }

  catch (error) {

    console.error(error);

    mostrarMensaje(
      "mensajeJugador",
      "No fue posible actualizar la nómina.",
      "error"
    );

  }

}

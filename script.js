const API_URL =
  "https://script.google.com/macros/s/AKfycbxTzDAVPVbAJoqjMrJT2qRW--xB-ExcHCvM2zqNlC6lDS53N3Lcbt0r6iuEOzKx3Uba/exec"; // <--- ENGANXA LA URL AQUÍ

let modoActual = "login";

// Canviar entre pestanyes de Login i Registre
function canviarTab(modo) {
  modoActual = modo;
  const btn = document.getElementById("btn-principal");
  const tLogin = document.getElementById("tab-login");
  const tRegistre = document.getElementById("tab-registre");

  if (modo === "login") {
    btn.innerText = "Entrar a l'Olimpíada";
    tLogin.classList.replace("text-slate-400", "text-indigo-600");
    tRegistre.classList.replace("text-indigo-600", "text-slate-400");
  } else {
    btn.innerText = "Crear compte nou";
    tRegistre.classList.replace("text-slate-400", "text-indigo-600");
    tLogin.classList.replace("text-indigo-600", "text-slate-400");
  }
}

// Funció principal d'enviament
async function executarAccio() {
  const nom = document.getElementById("nom-input").value.trim();
  const pass = document.getElementById("pass-input").value.trim();

  if (!nom || !pass) return alert("Si us plau, omple tots els camps");

  const btn = document.getElementById("btn-principal");
  btn.disabled = true;
  btn.innerText = "Connectant...";

  try {
    const resposta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: modoActual, nom: nom, pass: pass }),
    });

    const dades = await resposta.json();

    if (dades.success) {
      if (modoActual === "registre") {
        alert("✨ Usuari creat amb èxit! Ja pots iniciar sessió.");
        canviarTab("login");
      } else {
        // --- LOGIN CORRECTE ---

        // 1. Guardem les dades de l'usuari (nom, avatar, punts)
        const usuariLogin = dades.usuari;

        // 2. Carreguem l'historial d'activitats que ve del full "Progres"
        // Si no en té cap encara, assignem un array buit []
        estat.completats = usuariLogin.completats || [];

        // 3. Persistència: Guardem al navegador perquè no calgui fer login cada cop que refresquem
        localStorage.setItem("olimpic_user", JSON.stringify(usuariLogin));

        // 4. Arrancat de l'interfície
        iniciarApp(usuariLogin);
      }
    } else {
      alert("⚠️ " + dades.message);
    }
  } catch (error) {
    alert("Error de connexió. Revisa la URL de l'API.");
    console.error(error);
  } finally {
    btn.disabled = false;
    canviarTab(modoActual);
  }
}

function iniciarApp(user) {
  estat.userActiu = user;
  // Carreguem els punts que venen de la base de dades a l'estat global
  estat.punts = user.punts || 0;
  // Carreguem els exercicis completats
  estat.completats = user.completats || [];

  document.getElementById("modal-login").classList.add("hidden");
  document.getElementById("user-nom").innerText = user.nom;

  const avatarUrl =
    user.avatar && user.avatar.trim() !== ""
      ? user.avatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nom)}&background=6366f1&color=fff&bold=true`;

  document.getElementById("user-icon").innerHTML =
    `<img src="${avatarUrl}" class="w-full h-full object-cover rounded-full" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.nom)}&background=ef4444&color=fff'">`;

  // Carreguem les dades del Sheet i després actualitzem pantalles
  carregarDadesContables().then(() => {
    actualitzarDashboard();
    mostrarSeccio("dashboard");
  });
}

// Afegim l'objecte d'estat per controlar l'app--------------------------------------------------------------------------------------------------------
let estat = {
  userActiu: null,
  pgc: [],
  preguntes: [],
  temaActiu: null,
  preguntaActual: null,
  assentament: [], // Aquí guardarem el que l'usuari va escrivint
  completats: [],
  punts: 0,
};

// Modifiquem la funció iniciarApp que ja tenies
async function iniciarApp(user) {
  estat.userActiu = user;
  document.getElementById("modal-login").classList.add("hidden");
  document.getElementById("user-nom").innerText = user.nom;
  document.getElementById("user-icon").innerHTML =
    `<img src="${user.avatar}" class="w-full h-full object-cover">`;

  await carregarDadesContables();
  mostrarSeccio("dashboard");
}

async function carregarDadesContables() {
  try {
    const res = await fetch(API_URL);
    const dades = await res.json();

    // Estructurem les dades assegurant-nos que l'ID sigui el "DNI" de l'exercici
    estat.preguntes = dades.preguntes.map((p) => ({
      ...p,
      id: String(p.id), // Ens assegurem que l'ID enviat pel code.gs és un text
      descripcio: p.descripcio || "",
    }));

    estat.pgc = dades.pgc;

    generarMenuTemes();
    generarDatalistPGC();
  } catch (e) {
    console.error("Error alineant dades del Sheet:", e);
  }
}

// Navegació entre Dashboard i Exercici
function mostrarSeccio(id) {
  const seccions = ["seccio-dashboard", "seccio-exercici", "seccio-progres"];

  seccions.forEach((s) => {
    const el = document.getElementById(s);
    if (el) {
      el.classList.toggle("hidden", s !== `seccio-${id}`);
    }
  });

  // Si la secció és 'progres', executem la funció per pintar les dades
  if (id === "progres") {
    mostrarProgres();
  }
}

function generarMenuTemes() {
  const menu = document.getElementById("menu-temes");
  if (!menu) return;

  const temes = [...new Set(estat.preguntes.map((p) => p.tema))];

  menu.innerHTML = temes
    .map((tema) => {
      const preguntesDelTema = estat.preguntes.filter((p) => p.tema === tema);

      return `
      <li class="mb-4">
        <details class="group" open>
          <summary class="flex items-center justify-between px-4 py-2 rounded-xl cursor-pointer hover:bg-slate-800 transition text-indigo-300 font-black text-[10px] uppercase tracking-widest list-none">
            <span class="flex items-center gap-2">
              <span class="group-open:rotate-90 transition-transform italic text-indigo-500">▶</span>
              ${tema}
            </span>
          </summary>
          
          <ul class="mt-2 space-y-1">
            ${preguntesDelTema
              .map((p, index) => {
                // CORRECCIÓ CRÍTICA: Forçar String per a una comparació segura
                const feta = estat.completats
                  .map(String)
                  .includes(String(p.id));

                // Codi a substituir dins de preguntesDelTema.map:
                return `
               <li class="ml-4 mb-1">
              <button onclick="seleccionarPreguntaDirecta('${p.id}')" 
              class="w-full text-left px-3 py-3 rounded-xl transition group
              ${feta ? "bg-emerald-500/5 border border-emerald-500/20" : "hover:bg-indigo-500/10 border border-transparent"}">
        
              <div class="flex items-start gap-3">
              <span class="mt-0.5">${feta ? "✅" : "⚪"}</span>
              <div class="flex flex-col">
              <span class="text-[11px] font-black uppercase tracking-wider ${feta ? "text-emerald-400" : "text-indigo-200 group-hover:text-white"}">
              Exercici ${p.id}
              </span>
               <span class="text-[10px] leading-tight text-slate-400 font-medium mt-1 group-hover:text-slate-300">
              ${p.descripcio} </span>
              </div>
             </div>
              </button>
               </li>`;
              })
              .join("")}
          </ul>
        </details>
      </li>
    `;
    })
    .join("");
}

// AQUESTA FUNCIÓ ÉS LA QUE FA QUE EL MENÚ FUNCIONI EN CLICAR--------------------------------------------------------------
function seleccionarPreguntaDirecta(id) {
  // 1. Busquem la pregunta assegurant que comparem text amb text
  const pregunta = estat.preguntes.find((p) => String(p.id) === String(id));

  if (pregunta) {
    // 2. Actualitzem l'objecte sencer, no només el tema
    estat.temaActiu = pregunta.tema;
    estat.preguntaActual = pregunta;

    // 3. Forcem que la interfície s'actualitzi
    mostrarSeccio("exercici");
    mostrarPregunta();

    // Opcional: fem scroll a dalt perquè l'usuari vegi el nou enunciat
    window.scrollTo(0, 0);
  } else {
    console.error("Error: No s'ha trobat l'ID " + id + " a la base de dades.");
  }
}

// Funció generar llista suggerida ------------------------------------------------------------------------------------

function generarDatalistPGC() {
  // Creem un element <datalist> dinàmicament
  let dl = document.getElementById("pgc-list");
  if (!dl) {
    dl = document.createElement("datalist");
    dl.id = "pgc-list";
    document.body.appendChild(dl);
  }

  dl.innerHTML = estat.pgc
    .map((c) => `<option value="${c.codi}">${c.nom}</option>`)
    .join("");
}

// Funció generar les preguntes  ------------------------------------------------------------------------------------

function carregarTema(nomTema) {
  estat.temaActiu = nomTema;
  // Filtrem totes les preguntes d'aquell tema
  const preguntesTema = estat.preguntes.filter((p) => p.tema === nomTema);

  if (preguntesTema.length > 0) {
    // Comencem per la primera
    estat.preguntaActual = preguntesTema[0];
    mostrarPregunta();
    mostrarSeccio("exercici");
  }
}

function mostrarPregunta() {
  const p = estat.preguntaActual;
  if (!p) return;

  // Busquem els botons per ID
  const btnValidar = document.getElementById("btn-validar");
  const btnSeguent = document.getElementById("btn-seguent");

  // Si no es troben els botons a l'HTML, la funció s'atura sense donar error de consola
  if (!btnValidar || !btnSeguent) return;

  const jaFeta = estat.completats.includes(p.id);

  if (jaFeta) {
    // Si ja està feta, el botó de validar s'amaga i el de següent és verd
    btnValidar.classList.add("hidden");
    btnSeguent.innerText = "Següent Exercici ➡️";
    btnSeguent.className =
      "bg-emerald-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg shadow-emerald-100";
  } else {
    // Si no està feta, es pot validar o saltar (botó gris)
    btnValidar.classList.remove("hidden");
    btnSeguent.innerText = "Saltar Exercici ⏭️";
    btnSeguent.className =
      "bg-slate-200 text-slate-500 px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-300 transition border border-slate-300";
  }

  // Actualitzem l'enunciat i info
  document.getElementById("txt-enunciat").innerText = p.enunciat;
  document.getElementById("info-pregunta").innerText = p.tema;

  // Reset de la taula
  estat.assentament = [];
  afegirFila();
  renderTaula();
}

// Funcionalitat de les respostes  ---
// Afegeix una fila buida a l'objecte d'estat i actualitza la taula
function afegirFila() {
  estat.assentament.push({ codi: "", nom: "", deure: 0, haver: 0 });
  renderTaula();
}

// Funció per esborrar una línia específica
function eliminarLinia(index) {
  estat.assentament.splice(index, 1);
  renderTaula();
}

// Quan l'usuari canvia una dada a la taula
function updateLinia(index, camp, valor) {
  let linia = estat.assentament[index];
  linia[camp] = valor;

  // Si l'usuari ha escrit el codi, busquem el nom al PGC automàticament
  if (camp === "codi") {
    const compteTrobat = estat.pgc.find((c) => c.codi === valor);
    linia.nom = compteTrobat ? compteTrobat.nom : "Compte no trobat";
  }

  renderTaula();
}

// Dibuixa la taula a l'HTML basant-se en l'objecte 'estat.assentament'
function renderTaula() {
  const body = document.getElementById("diari-body");
  if (!body) return;

  let totalDeure = 0;
  let totalHaver = 0;

  body.innerHTML = estat.assentament
    .map((linia, idx) => {
      totalDeure += parseFloat(linia.deure || 0);
      totalHaver += parseFloat(linia.haver || 0);

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
            <td class="p-2">
                <input type="text" list="pgc-list" value="${linia.codi}" 
                    onchange="updateLinia(${idx}, 'codi', this.value)"
                    class="w-full p-2 outline-none font-bold text-indigo-600 bg-transparent focus:border-b focus:border-indigo-300">
            </td>
            <td class="p-2 text-slate-500 text-xs">${linia.nom}</td>
            <td class="p-2">
                <input type="number" value="${linia.deure || ""}" placeholder="0.00"
                    onchange="updateLinia(${idx}, 'deure', this.value)" 
                    class="w-full text-right p-2 outline-none text-emerald-700 font-bold bg-transparent">
            </td>
            <td class="p-2">
                <input type="number" value="${linia.haver || ""}" placeholder="0.00"
                    onchange="updateLinia(${idx}, 'haver', this.value)" 
                    class="w-full text-right p-2 outline-none text-sky-700 font-bold bg-transparent">
            </td>
            <td class="p-2 text-center">
                <button onclick="eliminarLinia(${idx})" class="text-slate-300 hover:text-rose-500 transition">✕</button>
            </td>
        </tr>`;
    })
    .join("");

  // Actualitzem els totals a la part inferior
  document.getElementById("total-deure").innerText =
    totalDeure.toFixed(2) + " €";
  document.getElementById("total-haver").innerText =
    totalHaver.toFixed(2) + " €";
  renderMajors();
}
// Lògica de validació ---------------------------------------------------------------------------------------------------------------
async function validarAssentament() {
  const solucioEsperada = estat.preguntaActual.solucio;
  const assentamentUsuari = estat.assentament.filter(
    (line) => line.codi !== "",
  );

  // 1. Càlcul de totals amb arrodoniment per seguretat
  const totalD = assentamentUsuari.reduce(
    (acc, l) => acc + parseFloat(l.deure || 0),
    0,
  );
  const totalH = assentamentUsuari.reduce(
    (acc, l) => acc + parseFloat(l.haver || 0),
    0,
  );

  // Comparem amb un marge d'error mínim per evitar problemes de decimals
  if (Math.abs(totalD - totalH) > 0.01 || totalD === 0) {
    alert("⚠️ L'assentament no quadra o està buit.");
    return;
  }

  // 2. Simplificació i normalització de les claus per a la comparació
  // Forcem 2 decimals (.toFixed(2)) a tot arreu perquè la comparació sigui idèntica
  const simplificar = (arr) =>
    arr
      .map(
        (l) =>
          `${l.codi}|${parseFloat(l.deure).toFixed(2)}|${parseFloat(l.haver).toFixed(2)}`,
      )
      .sort();

  const userKeys = simplificar(assentamentUsuari);
  const solKeys = simplificar(solucioEsperada);

  console.log("Usuari:", userKeys); // Per depurar a la consola si falla
  console.log("Solució:", solKeys);

  const esCorrecte = JSON.stringify(userKeys) === JSON.stringify(solKeys);

  if (esCorrecte) {
    const idActual = String(estat.preguntaActual.id);

    if (!estat.completats.includes(idActual)) {
      estat.completats.push(idActual);

      // Enviem les dades al Google Sheet
      try {
        await fetch(API_URL, {
          method: "POST",
          mode: "no-cors", // Evita errors de CORS al bloquejar la resposta
          body: JSON.stringify({
            action: "registrarActivitat",
            nom: estat.userActiu.nom,
            idActivitat: idActual,
            tema: estat.preguntaActual.tema,
            punts: 10,
          }),
        });

        // Actualitzem punts locals
        estat.punts = (parseInt(estat.punts) || 0) + 10;
        actualitzarDashboard();
      } catch (e) {
        console.error("Error en el registre remot:", e);
      }

      generarMenuTemes();
    }

    mostrarExit(); // Mostra la medalla i passa a la següent

    document.getElementById("btn-validar").classList.add("hidden");
    document.getElementById("btn-seguent").classList.remove("hidden");
  } else {
    alert(
      "❌ Hi ha algun error en els comptes o els imports. Revisa l'enunciat!",
    );
  }
}

// FUNCIÓ AUXILIAR PER AL SCROLL AUTOMÀTIC------------------------------------------------
function ferScrollAlSegüent(idCompletat) {
  const menu = document.getElementById("menu-temes");
  if (!menu) return;

  const botons = menu.querySelectorAll("button");
  let trobatIndex = -1;

  botons.forEach((btn, i) => {
    // Busquem el botó que hem clicat (per ID)
    if (btn.getAttribute("onclick").includes(`'${idCompletat}'`)) {
      trobatIndex = i;
    }
  });

  // Si hi ha un exercici següent, fem scroll fins a ell
  if (trobatIndex !== -1 && botons[trobatIndex + 1]) {
    const següentBtn = botons[trobatIndex + 1];
    següentBtn.scrollIntoView({ behavior: "smooth", block: "center" });

    // Feedback visual: un petit parpelleig
    següentBtn.classList.add(
      "ring-2",
      "ring-indigo-400",
      "ring-offset-2",
      "ring-offset-slate-900",
    );
    setTimeout(() => {
      següentBtn.classList.remove(
        "ring-2",
        "ring-indigo-400",
        "ring-offset-2",
        "ring-offset-slate-900",
      );
    }, 2000);
  }
}

// Afegim una variable a l'estat per als punts---------------------------------------------------------------------------------------
estat.punts = 0;

function mostrarExit() {
  reproduirSoExit();
  const medalla = document.getElementById("medalla-container");
  medalla.classList.remove("hidden");

  setTimeout(() => {
    medalla.classList.add("hidden");
    // CORRECCIÓ DEL NOM:
    carregarSegüentPregunta();
  }, 3000);
}

async function registrarPunts(punts) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "guardarPunts",
        nom: estat.userActiu.nom,
        punts: punts,
      }),
    });
    const dades = await res.json();
    if (dades.success) {
      estat.punts = dades.nousPunts;
      actualitzarDashboard();
    }
  } catch (e) {
    console.error("Error guardant punts", e);
  }
}

function actualitzarDashboard() {
  // 1. Actualitzar Punts (Lògica que ja tenies)
  const elPunts = document.querySelector(
    "#seccio-dashboard .text-3xl.font-black.text-slate-800",
  );
  if (elPunts) {
    elPunts.innerText = estat.punts || 0;
  }

  // 2. Càlcul de Progrés Real (Basat en exercicis completats)
  const totalPreguntes = estat.preguntes.length;
  const fetes = estat.completats.length;
  const percentatge =
    totalPreguntes > 0 ? Math.round((fetes / totalPreguntes) * 100) : 0;

  // Actualitzem la barra visual (si tens l'ID al teu HTML)
  const barra = document.getElementById("barra-progres-dashboard");
  if (barra) {
    barra.style.width = `${percentatge}%`;
  }

  // 3. Actualitzar el Rang (Millorat amb més categories)
  const elRang = document.querySelector("#seccio-dashboard .text-indigo-600");
  if (elRang) {
    if (percentatge >= 90) elRang.innerText = "Llegendari (A+)";
    else if (percentatge >= 50) elRang.innerText = "Expert (B)";
    else if (percentatge > 0) elRang.innerText = "Aprenent (C)";
    else elRang.innerText = "Novell";
  }

  // 4. Actualització de l'Avatar (Evitar imatges trencades)
  actualitzarAvatarVisual();
}

// Funció de suport per a l'avatar
function actualitzarAvatarVisual() {
  const user = estat.userActiu;
  if (!user) return;

  const userIconContainer = document.getElementById("user-icon");
  if (userIconContainer) {
    // Si l'avatar falla o està buit, usem UI-Avatars amb el nom de l'usuari
    const avatarUrl =
      user.avatar && user.avatar.includes("http")
        ? user.avatar
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nom)}&background=6366f1&color=fff&bold=true`;

    userIconContainer.innerHTML = `
      <img src="${avatarUrl}" 
           class="w-full h-full object-cover rounded-full" 
           onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.nom)}&background=ef4444&color=fff'">`;
  }
}

//--- Render de Majors -----------------------------------------------------------

function renderMajors() {
  const container = document.getElementById("majors-container");
  if (!container) return;

  // 1. Agrupem els moviments per compte
  const movimentsPerCompte = {};

  estat.assentament.forEach((linia) => {
    if (!linia.codi) return;
    if (!movimentsPerCompte[linia.codi]) {
      movimentsPerCompte[linia.codi] = {
        nom: linia.nom,
        deure: [],
        haver: [],
      };
    }
    if (parseFloat(linia.deure) > 0)
      movimentsPerCompte[linia.codi].deure.push(parseFloat(linia.deure));
    if (parseFloat(linia.haver) > 0)
      movimentsPerCompte[linia.codi].haver.push(parseFloat(linia.haver));
  });

  // 2. Generem l'HTML per a cada "T"
  container.innerHTML = Object.keys(movimentsPerCompte)
    .map((codi) => {
      const dades = movimentsPerCompte[codi];
      const totalD = dades.deure.reduce((a, b) => a + b, 0);
      const totalH = dades.haver.reduce((a, b) => a + b, 0);
      const saldo = totalD - totalH;

      return `
            <div class="bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div class="bg-slate-800 text-white p-2 text-center text-[10px] font-black uppercase tracking-widest">
                    (${codi}) ${dades.nom}
                </div>
                <div class="grid grid-cols-2 min-h-[100px]">
                    <div class="border-r border-slate-200 p-2">
                        <div class="text-[9px] text-slate-400 font-bold mb-1">DEURE</div>
                        ${dades.deure.map((v) => `<div class="text-xs text-emerald-600 font-bold">${v.toFixed(2)}</div>`).join("")}
                    </div>
                    <div class="p-2 text-right">
                        <div class="text-[9px] text-slate-400 font-bold mb-1">HAVER</div>
                        ${dades.haver.map((v) => `<div class="text-xs text-sky-600 font-bold">${v.toFixed(2)}</div>`).join("")}
                    </div>
                </div>
                <div class="border-t border-slate-100 p-2 bg-slate-50 flex justify-between items-center">
                    <span class="text-[9px] font-black text-slate-400">SALDO</span>
                    <span class="text-xs font-black ${saldo >= 0 ? "text-emerald-700" : "text-rose-700"}">
                        ${Math.abs(saldo).toFixed(2)} € ${saldo >= 0 ? "(D)" : "(H)"}
                    </span>
                </div>
            </div>
        `;
    })
    .join("");
}

function carregarSegüentPregunta() {
  // 1. ELIMINAR OBSTACLES: Si la medalla d'èxit està a la pantalla, la tanquem
  // per començar el nou exercici amb la pantalla neta.
  const medalla = document.getElementById("medalla-container");
  if (medalla) medalla.classList.add("hidden");

  // 2. BUSCAR ON SOM: Busquem la posició de l'exercici actual a la llista total (1 al 13)
  const indexTotal = estat.preguntes.findIndex(
    (p) => String(p.id) === String(estat.preguntaActual.id),
  );

  // 3. DECIDIR EL SEGÜENT PAS:
  if (indexTotal !== -1 && indexTotal < estat.preguntes.length - 1) {
    // Si NO és l'últim exercici, agafem el següent de la llista
    const següent = estat.preguntes[indexTotal + 1];

    // Fem servir la funció de càrrega que ja tens, que actualitza l'enunciat i buida la taula
    seleccionarPreguntaDirecta(següent.id);
  } else {
    // Si era l'últim (el 13), avisem i tornem al Dashboard
    alert("🎉 Felicitats! Has completat tots els exercicis de l'Olimpíada.");
    mostrarSeccio("dashboard");
  }
}

function mostrarProgres() {
  const container = document.getElementById("llista-progres-temes");
  if (!container) return;

  // Actualitzem els títols del header de la pàgina
  const títolHeader = document.getElementById("info-pregunta");
  const subTítolHeader = document.getElementById("progres-tema");
  if (títolHeader) títolHeader.innerText = "El Meu Rendiment";
  if (subTítolHeader) subTítolHeader.innerText = "Estadístiques per tema";

  const temes = [...new Set(estat.preguntes.map((p) => p.tema))];

  container.innerHTML = temes
    .map((tema) => {
      const preguntesTema = estat.preguntes.filter((p) => p.tema === tema);
      const fetesTema = preguntesTema.filter((p) =>
        estat.completats.map(String).includes(String(p.id)),
      ).length;

      const percentTema =
        preguntesTema.length > 0
          ? Math.round((fetesTema / preguntesTema.length) * 100)
          : 0;

      return `
      <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition">
        <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">${tema}</h3>
        <div class="flex items-end justify-between mb-2">
          <span class="text-3xl font-black text-slate-800">${percentTema}%</span>
          <span class="text-[10px] font-bold text-slate-500">${fetesTema} / ${preguntesTema.length} Exercicis</span>
        </div>
        <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div class="h-full bg-indigo-500 transition-all duration-1000" style="width: ${percentTema}%"></div>
        </div>
      </div>
    `;
    })
    .join("");
}

function reproduirSoExit() {
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine"; // So suau
  oscillator.frequency.setValueAtTime(523.25, context.currentTime); // Nota Do (C5)
  oscillator.frequency.exponentialRampToValueAtTime(
    880,
    context.currentTime + 0.1,
  ); // Puja a La (A5)

  gain.gain.setValueAtTime(0.1, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + 0.5);
}

function logout() {
  // Esborrem les dades de sessió guardades al navegador
  localStorage.removeItem("olimpic_user");
  // Recarreguem la pàgina per tornar al formulari de login
  location.reload();
}

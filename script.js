
// --- Configurar Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyBd25hLnwk72yO9E7ovKkB6Ba5RA0F_3aI",
  authDomain: "redecol-74a1b.firebaseapp.com",
  projectId: "redecol-74a1b",
  storageBucket: "redecol-74a1b.appspot.com",
  messagingSenderId: "286437914537",
  appId: "1:286437914537:web:151e8791eed28189fef6b8",
  measurementId: "G-M9MJ2LJ010"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

let map, marcadorReciclador, trayectoriaPolyline, watchID;
let rutaReciclador = [];
let grabandoRecorrido = false;
let grabacionActual = [];
let photoStream = null;
let polylinesCSV = [];
let marcadoresFotos = [];
let usuarioActual = null;
let estadoActual = "Disponible";

// --- Inicializar Mapa ---
function initMap() {
  const centro = { lat: 7.0652, lng: -73.8514 };
  map = new google.maps.Map(document.getElementById("map"), {
    center: centro,
    zoom: 14,
  });
  trayectoriaPolyline = new google.maps.Polyline({
    path: [],
    geodesic: true,
    strokeColor: "#2196f3",
    strokeOpacity: 1.0,
    strokeWeight: 4,
    map: map,
  });
}
window.initMap = initMap;

// --- Control de roles ---
function ajustarVistaPorRol() {
  const rol = document.getElementById('rol').value;
  // Solo el admin puede ver todas las trayectorias
  const btnTodas = document.getElementById('btnTodasTrayectorias');
  if (btnTodas) btnTodas.style.display = rol === "admin" ? "inline-block" : "none";
}
window.ajustarVistaPorRol = ajustarVistaPorRol;

// Al cargar la página, ajustar la vista por rol
window.onload = function() {
  ajustarVistaPorRol();
  if (window.initMap) initMap();
  cargarUsuarios();
  mostrarEstado();
};

// --- Registro de Usuarios ---
document.getElementById("registroForm").addEventListener("submit", function(e) {
  e.preventDefault();
  const data = {
    nombre: document.getElementById("nombre").value.trim(),
    nit: document.getElementById("nit").value.trim(),
    direccion: document.getElementById("direccion").value.trim(),
    sector: document.getElementById("sector").value.trim(),
    telefono: document.getElementById("telefono").value.trim(),
    correo: document.getElementById("correo").value.trim()
  };
  db.collection("usuarios").add(data).then(() => {
    alert("Usuario registrado correctamente");
    cargarUsuarios();
    this.reset();
  });
});

function cargarUsuarios() {
  db.collection("usuarios").get().then(snapshot => {
    const tbody = document.querySelector("#tablaUsuarios tbody");
    tbody.innerHTML = "";
    snapshot.forEach(doc => {
      const d = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${d.nombre}</td><td>${d.nit}</td><td>${d.direccion}</td><td>${d.sector}</td><td>${d.telefono}</td><td>${d.correo}</td>`;
      tbody.appendChild(tr);
    });
  });
}

// --- Control de Seguimiento ---
function iniciarSeguimiento() {
  const nombre = document.getElementById("nombreReciclador").value.trim() || "anonimo";
  usuarioActual = nombre;
  if (!navigator.geolocation) return alert("Geolocalización no disponible.");

  rutaReciclador = [];
  grabacionActual = [];
  trayectoriaPolyline.setPath([]);

  document.getElementById('iniciarSeguimiento').disabled = true;
  document.getElementById('detenerSeguimiento').disabled = false;

  watchID = navigator.geolocation.watchPosition(async (pos) => {
    const ubicacion = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      timestamp: new Date(),
      altitud: pos.coords.altitude || 0
    };
    rutaReciclador.push(ubicacion);
    if (grabandoRecorrido) grabacionActual.push(ubicacion);
    trayectoriaPolyline.getPath().push(new google.maps.LatLng(ubicacion.lat, ubicacion.lng));
    map.setCenter(ubicacion);
    await db.collection("rutas").doc(nombre).collection("ubicaciones").add(ubicacion);
  }, err => {
    console.error("Error geo:", err);
    alert("No se pudo obtener ubicación.");
    detenerSeguimiento();
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
}
window.iniciarSeguimiento = iniciarSeguimiento;

function detenerSeguimiento() {
  if (watchID) {
    navigator.geolocation.clearWatch(watchID);
    document.getElementById('iniciarSeguimiento').disabled = false;
    document.getElementById('detenerSeguimiento').disabled = true;
    alert("Seguimiento detenido.");
    if (grabandoRecorrido && grabacionActual.length > 0) {
      guardarGrabacion();
    }
  }
}
window.detenerSeguimiento = detenerSeguimiento;

// --- GRABAR RECORRIDO ---
function toggleGrabarRecorrido() {
  grabandoRecorrido = !grabandoRecorrido;
  document.getElementById("grabarRecorrido").textContent = grabandoRecorrido ? "■ Detener Grabación" : "⏺️ Grabar Recorrido";
  if (!grabandoRecorrido && grabacionActual.length > 0) {
    guardarGrabacion();
  }
  if (grabandoRecorrido) {
    grabacionActual = [];
  }
}

function guardarGrabacion() {
  const nombre = usuarioActual || document.getElementById("nombreReciclador").value.trim() || "anonimo";
  if (grabacionActual.length === 0) return;
  const meta = {
    nombre,
    fecha: new Date(),
    puntos: grabacionActual
  };
  db.collection("recorridosGrabados").add(meta).then(() => {
    alert("Grabación de recorrido guardada correctamente.");
    grabacionActual = [];
  });
}
window.toggleGrabarRecorrido = toggleGrabarRecorrido;

// --- ESTADO DEL SERVICIO ---
function cambiarEstado(estado) {
  estadoActual = estado;
  mostrarEstado();
  const nombre = document.getElementById("nombreReciclador").value.trim() || "anonimo";
  db.collection("estados").doc(nombre).set({
    estado,
    timestamp: new Date()
  });
}
function mostrarEstado() {
  document.getElementById('estadoActual').textContent = `Estado actual: ${estadoActual}`;
}
window.cambiarEstado = cambiarEstado;

// --- VISUALIZACIÓN DE RUTAS ---
function verMiRuta() {
  const nombre = usuarioActual || document.getElementById("nombreReciclador").value.trim();
  if (!nombre) return alert("Debe ingresar su nombre o ID.");
  mostrarTrayectoria(nombre);
}

function mostrarTrayectoria(nombre) {
  if (!nombre) {
    alert("Ingrese el nombre o ID del reciclador.");
    return;
  }
  db.collection("rutas").doc(nombre).collection("ubicaciones")
    .orderBy("timestamp").get().then(snapshot => {
      const path = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        path.push(new google.maps.LatLng(d.lat, d.lng));
      });
      if (path.length === 0) {
        alert("No hay datos de trayectoria para este reciclador.");
        return;
      }
      trayectoriaPolyline.setPath(path);
      const bounds = new google.maps.LatLngBounds();
      path.forEach(p => bounds.extend(p));
      map.fitBounds(bounds);
    });
}
window.mostrarTrayectoria = mostrarTrayectoria;
window.verMiRuta = verMiRuta;

// --- VER TODAS LAS TRAYECTORIAS (ADMIN) ---
function mostrarTodasTrayectorias() {
  // Limpia trayectorias anteriores
  map && map.data && map.data.forEach((f) => map.data.remove(f));
  db.collection("rutas").get().then(snapshot => {
    snapshot.forEach(doc => {
      doc.ref.collection("ubicaciones").orderBy("timestamp").get().then(subsnap => {
        const path = [];
        subsnap.forEach(subdoc => {
          const d = subdoc.data();
          path.push({lat: d.lat, lng: d.lng});
        });
        if (path.length > 0) {
          const poly = new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: '#' + Math.floor(Math.random()*16777215).toString(16), // color aleatorio
            strokeOpacity: 0.7,
            strokeWeight: 4,
            map: map,
          });
        }
      });
    });
  });
}
window.mostrarTodasTrayectorias = mostrarTodasTrayectorias;

// --- CARGAR RUTA DESDE CSV (VARIAS) ---
function cargarRutaDesdeCSV() {
  const input = document.getElementById('inputArchivoCSV');
  const files = input.files;
  if (!files.length) return alert("Selecciona al menos un archivo CSV");

  // Limpiar rutas previas
  polylinesCSV.forEach(poly => poly.setMap(null));
  polylinesCSV = [];
  let rutasHtml = "";

  Array.from(files).forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const csv = e.target.result;
      const lines = csv.split('\n').filter(l => l.trim().length > 0);
      const path = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length < 2) continue;
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          path.push({ lat, lng });
        }
      }

      if (path.length) {
        const poly = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: "#" + Math.floor(Math.random()*16777215).toString(16),
          strokeOpacity: 1.0,
          strokeWeight: 4,
          map: map,
        });
        polylinesCSV.push(poly);

        const bounds = new google.maps.LatLngBounds();
        path.forEach(p => bounds.extend(p));
        map.fitBounds(bounds);

        rutasHtml += `<span>Ruta ${idx+1}: ${file.name}</span><br>`;
      }
      document.getElementById("csvRutasCargadas").innerHTML = rutasHtml;
    };
    reader.readAsText(file);
  });
}

// --- SEGUIMIENTO EN VIVO ---
function verEnVivo() {
  const nombre = document.getElementById("nombreReciclador").value.trim();
  if (!nombre) return alert("Ingrese nombre del reciclador");

  if (marcadorReciclador) marcadorReciclador.setMap(null);
  marcadorReciclador = new google.maps.Marker({
    map,
    title: nombre,
    icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
  });

  db.collection("rutas").doc(nombre).collection("ubicaciones")
    .orderBy("timestamp", "desc").limit(1).onSnapshot(snap => {
      snap.forEach(doc => {
        const data = doc.data();
        const pos = new google.maps.LatLng(data.lat, data.lng);
        marcadorReciclador.setPosition(pos);
        map.setCenter(pos);
      });
    });
}
window.verEnVivo = verEnVivo;

// --- CÁMARA Y FOTOS EN RUTA ---
function toggleCamera() {
  if (photoStream) return stopCamera();
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(stream => {
    photoStream = stream;
    document.getElementById("cameraFeed").srcObject = stream;
    document.getElementById("cameraContainer").style.display = "block";
  }).catch(err => alert("No se pudo activar cámara"));
}
function stopCamera() {
  if (photoStream) {
    photoStream.getTracks().forEach(track => track.stop());
    document.getElementById("cameraFeed").srcObject = null;
    document.getElementById("cameraContainer").style.display = "none";
    photoStream = null;
  }
}
window.toggleCamera = toggleCamera;

function takePicture() {
  const video = document.getElementById("cameraFeed");
  const canvas = document.getElementById("photoCanvas");
  const context = canvas.getContext("2d");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0);
  const imgData = canvas.toDataURL("image/png");

  const img = new Image();
  img.src = imgData;
  document.getElementById("photoPreview").innerHTML = "";
  document.getElementById("photoPreview").appendChild(img);

  // Obtener ubicación GPS al tomar la foto
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const altitud = pos.coords.altitude || 0;
    guardarFoto(imgData, lat, lng, altitud);
  }, () => {
    guardarFoto(imgData, null, null, null); // Sin ubicación
  });

  // Mostrar botón para WhatsApp
  const whatsappContainer = document.getElementById("whatsappBtnContainer");
  whatsappContainer.innerHTML = `
    <a href="https://wa.me/573123387813?text=Hola,%20adjunto%20foto%20de%20la%20ruta%20REDECOL." target="_blank">
      <button style="background:#25d366;color:white;">Enviar foto por WhatsApp</button>
    </a>
  `;
}

function guardarFoto(imgData, lat, lng, altitud) {
  const nombre = usuarioActual || document.getElementById("nombreReciclador").value.trim() || "anonimo";
  const nombreArchivo = `${nombre}_${Date.now()}.png`;
  storage.ref("fotos/" + nombreArchivo).putString(imgData, 'data_url').then(() => {
    db.collection("fotos").add({
      nombre,
      url: "fotos/" + nombreArchivo,
      lat,
      lng,
      altitud,
      timestamp: new Date()
    });
    alert("Foto guardada correctamente");
  });
}
window.takePicture = takePicture;

// --- VER FOTOS EN EL MAPA ---
function mostrarFotosEnMapa() {
  // Limpia marcadores anteriores
  marcadoresFotos.forEach(m => m.setMap(null));
  marcadoresFotos = [];
  db.collection("fotos").get().then(snapshot => {
    snapshot.forEach(doc => {
      const d = doc.data();
      if (d.lat && d.lng) {
        storage.ref(d.url).getDownloadURL().then(url => {
          const marker = new google.maps.Marker({
            map,
            position: { lat: d.lat, lng: d.lng },
            icon: {
              url,
              scaledSize: new google.maps.Size(40, 40)
            },
            title: d.nombre
          });
          marcadoresFotos.push(marker);
        });
      }
    });
  });
}
window.mostrarFotosEnMapa = mostrarFotosEnMapa;

// --- VER TODAS LAS FOTOS ---
function mostrarTodasFotos() {
  db.collection("fotos").orderBy("timestamp", "desc").get().then(snapshot => {
    let html = "";
    snapshot.forEach(doc => {
      const d = doc.data();
      storage.ref(d.url).getDownloadURL().then(url => {
        html += `<div style="display:inline-block; margin:8px;">
          <img src="${url}" width="100"><br>
          <span>${d.nombre}<br>${d.lat ? `(${d.lat.toFixed(4)},${d.lng.toFixed(4)})` : ''}<br>${d.timestamp ? new Date(d.timestamp.seconds*1000).toLocaleString() : ''}</span>
        </div>`;
        document.getElementById("photoPreview").innerHTML = html;
      });
    });
  });
}
window.mostrarTodasFotos = mostrarTodasFotos;

// --- GENERAR REPORTE PDF ---
function generarReportePDF() {
  import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js").then(jsPDFModule => {
    const { jsPDF } = jsPDFModule;
    const doc = new jsPDF();
    const nombre = usuarioActual || document.getElementById("nombreReciclador").value || "anonimo";
    let totalKm = 0;

    doc.setFontSize(16);
    doc.text("Reporte de Ruta - REDECOL E.S.P.", 20, 20);
    doc.setFontSize(12);
    doc.text("Reciclador: " + nombre, 20, 30);

    // Dirección (última conocida)
    db.collection("usuarios").where("nombre", "==", nombre).get().then(snap => {
      let direccion = "";
      if (!snap.empty) {
        direccion = snap.docs[0].data().direccion || "";
        doc.text("Dirección: " + direccion, 20, 40);
      }
      // Recorrido
      let y = 55;
      if (rutaReciclador.length === 0) {
        doc.text("No hay puntos registrados en la sesión.", 20, y);
      } else {
        for (let i = 0; i < rutaReciclador.length; i++) {
          const p = rutaReciclador[i];
          if (i > 0) {
            totalKm += calcularDistancia(rutaReciclador[i-1], p);
          }
          doc.text(
            `${i + 1}. ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)} | Alt: ${p.altitud ? p.altitud.toFixed(2) : '--'}m | ${new Date(p.timestamp).toLocaleString()}`,
            20, y
          );
          y += 8;
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
        }
        doc.text(`Kilómetros recorridos: ${(totalKm/1000).toFixed(2)} km`, 20, y+10);
      }
      // Añadir miniaturas de fotos
      db.collection("fotos").where("nombre", "==", nombre).orderBy("timestamp", "desc").get().then(fotosSnap => {
        let fy = y + 25;
        if (!fotosSnap.empty) {
          doc.text("Fotos tomadas en la ruta:", 20, fy);
          fy += 10;
          let index = 0;
          fotosSnap.forEach(docFoto => {
            storage.ref(docFoto.data().url).getDownloadURL().then(urlFoto => {
              let img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = function() {
                doc.addImage(img, "PNG", 20, fy, 40, 30);
                doc.text(new Date(docFoto.data().timestamp.seconds*1000).toLocaleString(), 65, fy+15);
                fy += 35;
                if (index === fotosSnap.size-1) doc.save("reporte_reciclador.pdf");
              };
              img.src = urlFoto;
            });
            index++;
          });
        } else {
          doc.save("reporte_reciclador.pdf");
        }
      });
    });
  });
}
window.generarReportePDF = generarReportePDF;

function calcularDistancia(a, b) {
  // Haversine formula
  const R = 6371000;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLat = lat2 - lat1;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  return R * c;
}

// --- DESCARGAR RUTA CSV ---
function descargarRutaCSV() {
  if (!rutaReciclador.length) return alert("No hay datos para exportar.");
  let csv = "Latitud,Longitud,Altitud,Timestamp\n";
  rutaReciclador.forEach(p => {
    csv += `${p.lat},${p.lng},${p.altitud || ''},${new Date(p.timestamp).toISOString()}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ruta.csv";
  a.click();
}
window.descargarRutaCSV = descargarRutaCSV;

// --- DESCARGAR TRAYECTORIA IMAGEN ---
function descargarTrayectoriaImagen() {
  setTimeout(() => {
    html2canvas(document.getElementById("map")).then(canvas => {
      const link = document.createElement("a");
      link.download = "trayectoria.png";
      link.href = canvas.toDataURL();
      link.click();
    });
  }, 1000);
}
window.descargarTrayectoriaImagen = descargarTrayectoriaImagen;

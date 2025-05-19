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
let photoStream = null;

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
};

// --- Iniciar seguimiento ---
function iniciarSeguimiento() {
  const nombre = document.getElementById("nombreReciclador").value.trim() || "anonimo";
  if (!navigator.geolocation) return alert("Geolocalización no disponible.");

  document.getElementById('iniciarSeguimiento').disabled = true;
  document.getElementById('detenerSeguimiento').disabled = false;

  watchID = navigator.geolocation.watchPosition(async (pos) => {
    const ubicacion = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      timestamp: new Date()
    };
    rutaReciclador.push(ubicacion);
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
  }
}
window.detenerSeguimiento = detenerSeguimiento;

function toggleGrabarRecorrido() {
  grabandoRecorrido = !grabandoRecorrido;
  document.getElementById("grabarRecorrido").textContent = grabandoRecorrido ? "■ Detener Grabación" : "⏺️ Grabar Recorrido";
}
window.toggleGrabarRecorrido = toggleGrabarRecorrido;

function cargarRutaDesdeCSV() {
  const input = document.getElementById('inputArchivoCSV');
  if (!input.files.length) return alert("Selecciona un archivo CSV");

  const reader = new FileReader();
  reader.onload = function(e) {
    const csv = e.target.result;
    const lines = csv.split('\n').filter(l => l.trim().length > 0);
    const path = [];

    // Salta cabecera
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < 2) continue;
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        path.push({ lat, lng });
      }
    }

    // Limpia rutas anteriores
    if (window.csvPolyline) window.csvPolyline.setMap(null);

    window.csvPolyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#ff9800",
      strokeOpacity: 1.0,
      strokeWeight: 4,
      map: map,
    });

    if (path.length) {
      const bounds = new google.maps.LatLngBounds();
      path.forEach(p => bounds.extend(p));
      map.fitBounds(bounds);
    }
  };
  reader.readAsText(input.files[0]);
}

function mostrarTrayectoria(nombre) {
  db.collection("rutas").doc(nombre).collection("ubicaciones")
    .orderBy("timestamp").get().then(snapshot => {
      const path = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        path.push(new google.maps.LatLng(d.lat, d.lng));
      });
      const poly = new google.maps.Polyline({ path, strokeColor: "#f44336", strokeOpacity: 1, strokeWeight: 4, map });
      const bounds = new google.maps.LatLngBounds();
      path.forEach(p => bounds.extend(p));
      map.fitBounds(bounds);
    });
}
window.mostrarTrayectoria = mostrarTrayectoria;

window.mostrarTodasTrayectorias = () => alert("Función no implementada aún.");
window.cambiarEstado = estado => alert(`Estado cambiado a: ${estado}`);

// --- Ver en vivo ---
function verEnVivo() {
  const nombre = document.getElementById("nombreReciclador").value.trim();
  if (!nombre) return alert("Ingrese nombre del reciclador");

  const marker = new google.maps.Marker({
    map,
    title: nombre,
    icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
  });

  db.collection("rutas").doc(nombre).collection("ubicaciones")
    .orderBy("timestamp", "desc").limit(1).onSnapshot(snap => {
      snap.forEach(doc => {
        const data = doc.data();
        const pos = new google.maps.LatLng(data.lat, data.lng);
        marker.setPosition(pos);
        map.setCenter(pos);
      });
    });
}
window.verEnVivo = verEnVivo;

// --- Cámara ---
function toggleCamera() {
  if (photoStream) return stopCamera();
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(stream => {
    photoStream = stream;
    document.getElementById("cameraFeed").srcObject = stream;
    document.getElementById("cameraContainer").style.display = "block";
  }).catch(err => alert("No se pudo activar cámara"));
}
function stopCamera() {
  photoStream.getTracks().forEach(track => track.stop());
  document.getElementById("cameraFeed").srcObject = null;
  document.getElementById("cameraContainer").style.display = "none";
  photoStream = null;
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

  // Mostrar botón para WhatsApp
  const whatsappContainer = document.getElementById("whatsappBtnContainer");
  whatsappContainer.innerHTML = `
    <a href="https://wa.me/573123387813?text=Hola,%20adjunto%20foto%20de%20la%20ruta%20REDECOL." target="_blank">
      <button style="background:#25d366;color:white;">Enviar foto por WhatsApp</button>
    </a>
  `;

  const nombre = document.getElementById("nombreReciclador").value.trim() || "anonimo";
  const nombreArchivo = `${nombre}_${Date.now()}.png`;
  storage.ref("fotos/" + nombreArchivo).putString(imgData, 'data_url').then(() => {
    db.collection("fotos").add({
      nombre,
      url: "fotos/" + nombreArchivo,
      timestamp: new Date()
    });
    alert("Foto guardada correctamente");
  });
}
window.takePicture = takePicture;

function mostrarTodasFotos() {
  db.collection("fotos").get().then(snapshot => {
    let html = "";
    snapshot.forEach(doc => {
      const d = doc.data();
      storage.ref(d.url).getDownloadURL().then(url => {
        html += `<img src="${url}" width="100">`;
        document.getElementById("photoPreview").innerHTML = html;
      });
    });
  });
}
window.mostrarTodasFotos = mostrarTodasFotos;

function mostrarFotosEnMapa() {
  db.collection("fotos").get().then(snapshot => {
    snapshot.forEach(doc => {
      const d = doc.data();
      storage.ref(d.url).getDownloadURL().then(url => {
        new google.maps.Marker({
          map,
          position: { lat: 7.0652, lng: -73.8514 }, // Coordenada simulada
          icon: url,
          title: d.nombre
        });
      });
    });
  });
}
window.mostrarFotosEnMapa = mostrarFotosEnMapa;

// --- Generar reporte PDF ---
function generarReportePDF() {
  import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js").then(jsPDFModule => {
    const { jsPDF } = jsPDFModule;
    const doc = new jsPDF();
    const nombre = document.getElementById("nombreReciclador").value || "anonimo";

    doc.setFontSize(16);
    doc.text("Reporte de Ruta - REDECOL E.S.P.", 20, 20);
    doc.setFontSize(12);
    doc.text("Reciclador: " + nombre, 20, 30);
    doc.text("Puntos registrados: " + rutaReciclador.length, 20, 40);

    let y = 60;
    rutaReciclador.forEach((p, i) => {
      doc.text(`${i + 1}. ${p.lat}, ${p.lng} - ${new Date(p.timestamp).toLocaleString()}`, 20, y);
      y += 8;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save("reporte_reciclador.pdf");
  });
}
window.generarReportePDF = generarReportePDF;

function descargarRutaCSV() {
  if (!rutaReciclador.length) return alert("No hay datos para exportar.");
  let csv = "Latitud,Longitud,Timestamp\n";
  rutaReciclador.forEach(p => {
    csv += `${p.lat},${p.lng},${new Date(p.timestamp).toISOString()}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ruta.csv";
  a.click();
}
window.descargarRutaCSV = descargarRutaCSV;

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

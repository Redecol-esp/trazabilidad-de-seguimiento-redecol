// --- Configuración Firebase ---
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

// --- Variables globales ---
let map;
let marcadorReciclador;
let trayectoriaPolyline;
let watchID;
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

// --- Iniciar seguimiento ---
function iniciarSeguimiento() {
  const nombre = document.getElementById("nombreReciclador").value.trim() || "anonimo";
  if (!navigator.geolocation) return alert("Geolocalización no disponible.");

  document.getElementById('iniciarSeguimiento').disabled = true;
  document.getElementById('detenerSeguimiento').disabled = false;

  watchID = navigator.geolocation.watchPosition(
    async (pos) => {
      const ubicacion = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: new Date()
      };
      rutaReciclador.push(ubicacion);
      trayectoriaPolyline.getPath().push(new google.maps.LatLng(ubicacion.lat, ubicacion.lng));
      map.setCenter(ubicacion);
      await db.collection("rutas").doc(nombre).collection("ubicaciones").add(ubicacion);
    },
    (err) => {
      console.error("Error de geolocalización:", err);
      alert("No se pudo obtener ubicación.");
      detenerSeguimiento();
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}
window.iniciarSeguimiento = iniciarSeguimiento;

// --- Detener seguimiento ---
function detenerSeguimiento() {
  if (watchID) {
    navigator.geolocation.clearWatch(watchID);
    document.getElementById('iniciarSeguimiento').disabled = false;
    document.getElementById('detenerSeguimiento').disabled = true;
    alert("Seguimiento detenido.");
  }
}
window.detenerSeguimiento = detenerSeguimiento;

// --- Grabar Recorrido ---
function toggleGrabarRecorrido() {
  grabandoRecorrido = !grabandoRecorrido;
  document.getElementById("grabarRecorrido").textContent = grabandoRecorrido ? "■ Detener Grabación" : "⏺️ Grabar Recorrido";
}
window.toggleGrabarRecorrido = toggleGrabarRecorrido;

// --- Mostrar Ruta Propia ---
function cargarRuta() {
  if (!rutaReciclador.length) return alert("No hay ruta aún.");
  const bounds = new google.maps.LatLngBounds();
  rutaReciclador.forEach(p => bounds.extend(new google.maps.LatLng(p.lat, p.lng)));
  map.fitBounds(bounds);
}
window.cargarRuta = cargarRuta;

// --- Mostrar Trayectoria Individual ---
function mostrarTrayectoria(nombre) {
  if (!rutaReciclador.length) return alert("No hay trayectoria.");

  const path = rutaReciclador.map(p => new google.maps.LatLng(p.lat, p.lng));
  const poly = new google.maps.Polyline({
    path,
    strokeColor: "#f44336",
    strokeOpacity: 1,
    strokeWeight: 4,
    map
  });

  const bounds = new google.maps.LatLngBounds();
  path.forEach(p => bounds.extend(p));
  map.fitBounds(bounds);
}
window.mostrarTrayectoria = mostrarTrayectoria;

window.mostrarTodasTrayectorias = () => alert("Función no implementada aún.");
window.cambiarEstado = estado => alert(`Estado cambiado a: ${estado}`);

// --- Ver en vivo ---
function verEnVivo() {
  const nombre = document.getElementById("nombreReciclador").value.trim();
  if (!nombre) return alert("Ingrese nombre del reciclador");

  const marker = new google.maps.Marker({ map, title: nombre, icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png" });

  db.collection("rutas").doc(nombre).collection("ubicaciones")
    .orderBy("timestamp", "desc")
    .limit(1)
    .onSnapshot(snap => {
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

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(stream => {
      photoStream = stream;
      document.getElementById("cameraFeed").srcObject = stream;
      document.getElementById("cameraContainer").style.display = "block";
    })
    .catch(err => alert("No se pudo activar cámara"));
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
}
window.takePicture = takePicture;

// --- Descargar CSV ---
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

// --- Descargar Imagen Trayectoria ---
function descargarTrayectoriaImagen() {
  html2canvas(document.getElementById("map")).then(canvas => {
    const link = document.createElement("a");
    link.download = "trayectoria.png";
    link.href = canvas.toDataURL();
    link.click();
  });
}
window.descargarTrayectoriaImagen = descargarTrayectoriaImagen;

// --- Funciones no implementadas ---
window.mostrarFotosEnMapa = () => alert("Aún no implementado.");
window.mostrarTodasFotos = () => alert("Aún no implementado.");
window.generarReportePDF = () => alert("Aún no implementado.");

// Inicialización de Firebase
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID",
  measurementId: "TU_MEASUREMENT_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// Variables globales
let map;
let marcadorReciclador;
let rutaReciclador = [];
let trayectoriaPolyline;
let seguimientoActivo = false;
let watchID;
let grabandoRecorrido = false;
let rutaGrabada = [];

// Elementos del DOM
document.addEventListener("DOMContentLoaded", () => {
  const cameraContainer = document.getElementById('cameraContainer');
  const cameraFeed = document.getElementById('cameraFeed');
  const takePhoto = document.getElementById('takePhoto');
  const photoCanvas = document.getElementById('photoCanvas');
  const photoPreview = document.getElementById('photoPreview');
  let photoStream = null;

  // Inicialización del mapa
  function initMap() {
    const ubicacionInicial = { lat: 7.0652, lng: -73.8514 }; // Barrancabermeja
    map = new google.maps.Map(document.getElementById("map"), {
      center: ubicacionInicial,
      zoom: 13,
    });
  }

  // Seguimiento GPS
  function iniciarSeguimiento() {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización.");
      return;
    }

    const nombreReciclador = document.getElementById('nombreReciclador').value.trim() || "anonimo";
    seguimientoActivo = true;
    document.getElementById('iniciarSeguimiento').disabled = true;
    document.getElementById('detenerSeguimiento').disabled = false;

    watchID = navigator.geolocation.watchPosition(
      (pos) => {
        const nuevaUbicacion = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp
        };

        rutaReciclador.push(nuevaUbicacion);
        if (grabandoRecorrido) {
          rutaGrabada.push(nuevaUbicacion);
        }

        if (map) map.setCenter(nuevaUbicacion);

        // Guardar en Firebase
        enviarUbicacionAFirebase(nombreReciclador, nuevaUbicacion);
      },
      (err) => {
        console.error("Error al obtener la ubicación:", err);
        alert("No se pudo obtener la ubicación.");
        detenerSeguimiento();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }

  function detenerSeguimiento() {
    if (watchID) {
      navigator.geolocation.clearWatch(watchID);
      seguimientoActivo = false;
      document.getElementById('iniciarSeguimiento').disabled = false;
      document.getElementById('detenerSeguimiento').disabled = true;
      alert("Seguimiento detenido.");
    }
  }

  function toggleGrabarRecorrido() {
    grabandoRecorrido = !grabandoRecorrido;
    document.getElementById('grabarRecorrido').textContent = grabandoRecorrido ? '■ Detener Grabación' : '⏺️ Grabar Recorrido';
    if (!grabandoRecorrido) {
      console.log("Recorrido Grabado:", rutaGrabada);
      rutaGrabada = [];
    }
  }

  // Visualización de rutas
  function cargarRuta() {
    if (!rutaReciclador.length) {
      alert("No hay ruta registrada aún.");
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    rutaReciclador.forEach(p => bounds.extend(new google.maps.LatLng(p.lat, p.lng)));
    map.fitBounds(bounds);
  }

  function mostrarTrayectoria(nombre) {
    if (!rutaReciclador.length) {
      alert("No hay trayectoria registrada para este reciclador.");
      return;
    }

    const path = rutaReciclador.map(p => new google.maps.LatLng(p.lat, p.lng));
    const polilinea = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: "#f44336",
      strokeOpacity: 1.0,
      strokeWeight: 3,
      map: map,
    });

    const bounds = new google.maps.LatLngBounds();
    path.forEach(p => bounds.extend(p));
    map.fitBounds(bounds);
  }

  // Guardar en Firebase
  async function enviarUbicacionAFirebase(nombreReciclador, ubicacion) {
    try {
      await db.collection("rutas").doc(nombreReciclador).collection("ubicaciones").add({
        lat: ubicacion.lat,
        lng: ubicacion.lng,
        timestamp: new Date()
      });
      console.log("Ubicación guardada en Firebase:", ubicacion);
    } catch (error) {
      console.error("Error al guardar en Firebase:", error);
    }
  }

  // Leer en vivo desde Firebase
  function verEnVivo() {
    const nombreReciclador = document.getElementById('nombreReciclador').value.trim();
    if (!nombreReciclador) {
      alert("Por favor ingresa el nombre o ID del reciclador para ver en vivo.");
      return;
    }

    const marcadorLive = new google.maps.Marker({
      map: map,
      title: "Ubicación en Vivo",
      icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
    });

    db.collection("rutas").doc(nombreReciclador).collection("ubicaciones")
      .orderBy("timestamp", "desc")
      .limit(1)
      .onSnapshot((snapshot) => {
        snapshot.forEach((doc) => {
          const data = doc.data();
          const pos = { lat: data.lat, lng: data.lng };
          marcadorLive.setPosition(pos);
          map.setCenter(pos);
        });
      }, (error) => {
        console.error("Error leyendo de Firebase:", error);
      });
  }

  // Exponer funciones al ámbito global
  window.initMap = initMap;
  window.iniciarSeguimiento = iniciarSeguimiento;
  window.detenerSeguimiento = detenerSeguimiento;
  window.toggleGrabarRecorrido = toggleGrabarRecorrido;
  window.cargarRuta = cargarRuta;
  window.mostrarTrayectoria = mostrarTrayectoria;
  window.verEnVivo = verEnVivo;
});

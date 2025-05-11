// Inicialización de Firebase
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

// Variables globales
let map;
let rutaReciclador = [];
let trayectoriaPolyline;
let seguimientoActivo = false;
let watchID;
let grabandoRecorrido = false;
let rutaGrabada = [];
let marcadoresRecicladores = {};

document.addEventListener("DOMContentLoaded", () => {
  const cameraContainer = document.getElementById('cameraContainer');
  const cameraFeed = document.getElementById('cameraFeed');
  const takePhoto = document.getElementById('takePhoto');
  const photoCanvas = document.getElementById('photoCanvas');
  const photoPreview = document.getElementById('photoPreview');
  let photoStream = null;

  // Inicializar el mapa
  window.initMap = function () {
    const ubicacionInicial = { lat: 7.0652, lng: -73.8514 };
    map = new google.maps.Map(document.getElementById("map"), {
      center: ubicacionInicial,
      zoom: 13,
    });
  };

  // Función para enviar a Firebase
  async function enviarUbicacionAFirebase(nombreReciclador, ubicacion) {
    try {
      await db.collection("rutas").doc(nombreReciclador).collection("ubicaciones").add({
        lat: ubicacion.lat,
        lng: ubicacion.lng,
        timestamp: new Date()
      });
    } catch (error) {
      console.error("Error al guardar en Firebase:", error);
    }
  }

  // Seguimiento en el celular
  window.iniciarSeguimiento = function () {
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

        // Dibujar la trayectoria en el mapa
        if (!trayectoriaPolyline) {
          trayectoriaPolyline = new google.maps.Polyline({
            path: [],
            geodesic: true,
            strokeColor: "#00bcd4",
            strokeOpacity: 1.0,
            strokeWeight: 3,
            map: map
          });
        }

        trayectoriaPolyline.getPath().push(new google.maps.LatLng(nuevaUbicacion.lat, nuevaUbicacion.lng));
        map.setCenter(nuevaUbicacion);

        // Enviar a Firebase
        enviarUbicacionAFirebase(nombreReciclador, nuevaUbicacion);
      },
      (err) => {
        console.error("Error al obtener la ubicación:", err);
        alert("No se pudo obtener la ubicación.");
        window.detenerSeguimiento();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  window.detenerSeguimiento = function () {
    if (watchID) {
      navigator.geolocation.clearWatch(watchID);
      seguimientoActivo = false;
      document.getElementById('iniciarSeguimiento').disabled = false;
      document.getElementById('detenerSeguimiento').disabled = true;
      alert("Seguimiento detenido.");
    }
  };

  window.toggleGrabarRecorrido = function () {
    grabandoRecorrido = !grabandoRecorrido;
    document.getElementById('grabarRecorrido').textContent = grabandoRecorrido ? '■ Detener Grabación' : '⏺️ Grabar Recorrido';
    if (!grabandoRecorrido) {
      console.log("Recorrido grabado:", rutaGrabada);
      rutaGrabada = [];
    }
  };

  // Ver mi ruta
  window.cargarRuta = function () {
    if (!rutaReciclador.length) {
      alert("No hay ruta registrada aún.");
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    rutaReciclador.forEach(p => bounds.extend(new google.maps.LatLng(p.lat, p.lng)));
    map.fitBounds(bounds);
  };

  // Ver trayectoria individual
  window.mostrarTrayectoria = function (nombre) {
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
  };

  window.mostrarTodasTrayectorias = function () {
    alert("Función mostrarTodasTrayectorias aún no implementada.");
  };

  // Ver ubicación en vivo de un reciclador
  window.verEnVivo = function () {
    const nombreReciclador = document.getElementById('nombreReciclador').value.trim();
    if (!nombreReciclador) {
      alert("Por favor ingresa el nombre o ID del reciclador.");
      return;
    }

    const marcadorLive = new google.maps.Marker({
      map: map,
      title: nombreReciclador,
      icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
    });

    db.collection("rutas").doc(nombreReciclador).collection("ubicaciones")
      .orderBy("timestamp", "desc")
      .limit(1)
      .onSnapshot(snapshot => {
        snapshot.forEach(doc => {
          const data = doc.data();
          const pos = { lat: data.lat, lng: data.lng };
          marcadorLive.setPosition(pos);
          map.setCenter(pos);
        });
      });
  };

  // Ver todos en vivo
  window.verTodosEnVivo = function () {
    db.collection("rutas").get().then(snapshot => {
      snapshot.forEach(doc => {
        const nombre = doc.id;

        db.collection("rutas").doc(nombre).collection("ubicaciones")
          .orderBy("timestamp", "desc").limit(1)
          .onSnapshot(subSnap => {
            subSnap.forEach(subDoc => {
              const data = subDoc.data();
              const pos = { lat: data.lat, lng: data.lng };

              if (marcadoresRecicladores[nombre]) {
                marcadoresRecicladores[nombre].setPosition(pos);
              } else {
                marcadoresRecicladores[nombre] = new google.maps.Marker({
                  map: map,
                  title: nombre,
                  position: pos,
                  icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
                });
              }
            });
          });
      });
    });
  };

  // Otras funciones vacías (para evitar errores en botones que aún no están implementados)
  window.toggleCamera = () => alert("Cámara aún no implementada.");
  window.takePicture = () => alert("Foto aún no implementada.");
  window.mostrarFotosEnMapa = () => alert("Fotos en el mapa aún no implementadas.");
  window.mostrarTodasFotos = () => alert("Todas las fotos aún no implementadas.");
  window.generarReportePDF = () => alert("Reporte PDF aún no implementado.");
  window.descargarRutaXLSX = () => alert("Descarga Excel aún no implementada.");
  window.descargarTrayectoriaImagen = () => alert("Descarga de imagen aún no implementada.");
  window.cambiarEstado = (estado) => alert(`Estado cambiado a: ${estado}`);
});

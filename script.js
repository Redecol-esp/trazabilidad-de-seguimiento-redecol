let map;
let marcadorReciclador;
let rutaReciclador = [];
let trayectoriaPolyline;
let seguimientoActivo = false;
let watchID;
let grabandoRecorrido = false;
let rutaGrabada = [];

// Elementos de cámara
let cameraContainer = document.getElementById('cameraContainer');
let cameraFeed = document.getElementById('cameraFeed');
let takePhoto = document.getElementById('takePhoto');
let photoCanvas = document.getElementById('photoCanvas');
let photoPreview = document.getElementById('photoPreview');
let photoStream = null;

// Colecciones de Firebase
const RUTAS_COLLECTION = 'rutas';
const USUARIOS_COLLECTION = 'usuarios';
const FOTOS_COLLECTION = 'fotos';

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

function mostrarTodasTrayectorias() {
    mostrarTrayectoria("todos");
}

// Estado del servicio
function cambiarEstado(estado) {
    alert(`Estado del reciclador cambiado a: ${estado}`);
}

// Funciones faltantes para evitar errores
function mostrarFotosEnMapa() {
    alert("Función mostrarFotosEnMapa aún no implementada.");
}

function mostrarTodasFotos() {
    alert("Función mostrarTodasFotos aún no implementada.");
}

function generarReportePDF() {
    alert("Función generarReportePDF aún no implementada.");
}

// Cámara
function toggleCamera() {
    if (photoStream) {
        stopCamera();
    } else {
        startCamera();
    }
}

function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('La cámara no es compatible con este navegador.');
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            photoStream = stream;
            cameraFeed.srcObject = stream;
            cameraContainer.style.display = 'block';
            takePhoto.onclick = takePicture;
        })
        .catch(error => {
            console.error('Error al acceder a la cámara:', error);
            alert('No se pudo acceder a la cámara.');
        });
}

function stopCamera() {
    if (photoStream) {
        photoStream.getTracks().forEach(track => track.stop());
        cameraFeed.srcObject = null;
        cameraContainer.style.display = 'none';
        photoStream = null;
    }
}

function takePicture() {
    const context = photoCanvas.getContext('2d');
    photoCanvas.width = cameraFeed.videoWidth;
    photoCanvas.height = cameraFeed.videoHeight;
    context.drawImage(cameraFeed, 0, 0, cameraFeed.videoWidth, cameraFeed.videoHeight);

    const imageDataURL = photoCanvas.toDataURL('image/png');
    displayPhotoPreview(imageDataURL);
}

function displayPhotoPreview(imageDataURL) {
    const img = document.createElement('img');
    img.src = imageDataURL;
    photoPreview.innerHTML = '';
    photoPreview.appendChild(img);
}

// Exportar CSV
function descargarRutaCSV() {
    if (!rutaReciclador.length) {
        alert("No hay datos de ruta para descargar.");
        return;
    }

    let csvContent = "Latitud,Longitud,Timestamp\n";
    rutaReciclador.forEach(loc => {
        csvContent += `${loc.lat},${loc.lng},${loc.timestamp}\n`;
    });

    downloadFile("ruta.csv", "text/csv;charset=utf-8;", csvContent);
}

function downloadFile(filename, contentType, content) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = filename;
    a.click();
}

// GUARDAR en Firebase
async function enviarUbicacionAFirebase(nombreReciclador, ubicacion) {
    try {
        await db.collection("rutas").doc(nombreReciclador).set({
            ...ubicacion,
            timestamp: new Date()
        });
        console.log("Ubicación guardada en Firebase:", ubicacion);
    } catch (error) {
        console.error("Error al guardar en Firebase:", error);
    }
}

// LEER en vivo desde Firebase
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

    db.collection("rutas").doc(nombreReciclador)
      .onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            const pos = { lat: data.lat, lng: data.lng };
            marcadorLive.setPosition(pos);
            map.setCenter(pos);
        } else {
            console.warn("No hay datos en Firebase para este reciclador.");
        }
      }, (error) => {
        console.error("Error leyendo de Firebase:", error);
      });
}

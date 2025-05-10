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

// Seguimiento en vivo
function verEnVivo() {
    if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalización.");
        return;
    }

    if (!map) {
        alert("El mapa aún no ha sido inicializado.");
        return;
    }

    const iconoVerde = {
        url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
    };

    const marcadorLive = new google.maps.Marker({
        map: map,
        title: "Ubicación en Vivo",
        icon: iconoVerde
    });

    navigator.geolocation.watchPosition(
        (position) => {
            const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            marcadorLive.setPosition(pos);
            map.setCenter(pos);
        },
        (error) => {
            console.error("Error de geolocalización en vivo:", error);
            alert("No se pudo obtener ubicación en vivo.");
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
}



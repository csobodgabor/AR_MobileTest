const info = document.getElementById("info");
const startButton = document.getElementById("startButton");
const video = document.getElementById("camera");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

let isRunning = false;
let orientation = { alpha: 0, beta: 0, gamma: 0 };
let absoluteOrientation = { alpha: 0, beta: 0, gamma: 0, absolute: false };
let position = { lat: 0, lon: 0, accuracy: 0 };

// Canvas méret beállítása és újraméretezés kezelése
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// 🎥 Kamera indítása
async function startCamera() {
  try {
    const constraints = {
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });
  } catch (e) {
    console.error("Kamera hiba:", e);
    info.innerText = "Nem sikerült elérni a kamerát: " + e.message;
    throw e;
  }
}

// 🧭 Giroszkóp/orientáció indítása
async function startOrientation() {
  try {
    // iOS engedély kérése
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Az orientációs engedély megtagadva');
      }
    }
    
    // Relatív orientáció eseménykezelő
    const handleOrientation = (e) => {
      orientation.alpha = e.alpha || 0;
      orientation.beta = e.beta || 0;
      orientation.gamma = e.gamma || 0;
    };
    
    // Abszolút orientáció eseménykezelő
    const handleAbsoluteOrientation = (e) => {
      absoluteOrientation.alpha = e.alpha || 0;
      absoluteOrientation.beta = e.beta || 0;
      absoluteOrientation.gamma = e.gamma || 0;
      absoluteOrientation.absolute = e.absolute || false;
    };
    
    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('deviceorientationabsolute', handleAbsoluteOrientation);
    
    // Teszt hogy működik-e
    setTimeout(() => {
      if (orientation.alpha === 0 && orientation.beta === 0 && orientation.gamma === 0) {
        console.warn("Az orientációs adatok nem érkeznek meg");
      }
      if (absoluteOrientation.alpha === 0 && absoluteOrientation.beta === 0 && absoluteOrientation.gamma === 0) {
        console.warn("Az abszolút orientációs adatok nem érkeznek meg");
      }
    }, 1000);
    
  } catch (e) {
    console.error("Orientáció hiba:", e);
    info.innerText = "Orientáció hiba: " + e.message;
  }
}

// 📍 GPS indítása
function startGPS() {
  if (!navigator.geolocation) {
    console.error("Geolocation nem támogatott");
    info.innerText = "A böngésző nem támogatja a geolocation API-t.";
    return;
  }
  
  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000
  };
  
  navigator.geolocation.watchPosition(
    (pos) => {
      position.lat = pos.coords.latitude;
      position.lon = pos.coords.longitude;
      position.accuracy = pos.coords.accuracy;
    },
    (err) => {
      console.error("GPS hiba:", err);
      switch(err.code) {
        case err.PERMISSION_DENIED:
          info.innerText = "GPS engedély megtagadva";
          break;
        case err.POSITION_UNAVAILABLE:
          info.innerText = "GPS pozíció nem elérhető";
          break;
        case err.TIMEOUT:
          info.innerText = "GPS időtúllépés";
          break;
        default:
          info.innerText = "Ismeretlen GPS hiba: " + err.message;
          break;
      }
    },
    options
  );
}

// Északi irányhoz mért eltérés számítása
function getCompassHeading() {
  if (absoluteOrientation.absolute && absoluteOrientation.alpha !== null) {
    // Ha van abszolút orientáció, azt használjuk
    return absoluteOrientation.alpha;
  } else if (orientation.alpha !== null) {
    // Egyébként a relatív orientációt használjuk (kevésbé pontos)
    return orientation.alpha;
  }
  return null;
}

// Iránytű rajzolása
function drawCompass(ctx, x, y, radius, heading) {
  if (heading === null) return;
  
  ctx.save();
  ctx.translate(x, y);
  
  // Iránytű kör
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, 2 * Math.PI);
  ctx.stroke();
  
  // Északi irány jelölése (piros)
  ctx.strokeStyle = "rgba(255,0,0,0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -radius + 5);
  ctx.lineTo(0, -radius + 15);
  ctx.stroke();
  
  // "N" betű
  ctx.fillStyle = "rgba(255,0,0,0.9)";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("N", 0, -radius + 25);
  
  // Eszköz irányának mutatása (zöld nyíl)
  ctx.rotate(-heading * Math.PI / 180);
  ctx.strokeStyle = "rgba(0,255,0,0.9)";
  ctx.fillStyle = "rgba(0,255,0,0.9)";
  ctx.lineWidth = 3;
  
  // Nyíl
  ctx.beginPath();
  ctx.moveTo(0, -radius + 10);
  ctx.lineTo(-5, -radius + 20);
  ctx.lineTo(0, -radius + 15);
  ctx.lineTo(5, -radius + 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  ctx.restore();
}

// 🔄 AR render loop (teszt objektum)
function loop() {
  if (!isRunning) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Egyszerű zöld kocka a képernyő közepén, ami forgás közben mozog
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const size = 50 + 20 * Math.sin(Date.now() / 500);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((orientation.alpha || 0) * Math.PI / 180);
  ctx.strokeStyle = "rgba(0,255,0,0.8)";
  ctx.lineWidth = 4;
  ctx.strokeRect(-size/2, -size/2, size, size);
  
  // Kereszt a közepén
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(10, 0);
  ctx.moveTo(0, -10);
  ctx.lineTo(0, 10);
  ctx.stroke();
  
  ctx.restore();

  // Iránytű rajzolása a jobb felső sarokban
  const compassX = canvas.width - 80;
  const compassY = 80;
  const compassRadius = 40;
  const heading = getCompassHeading();
  drawCompass(ctx, compassX, compassY, compassRadius, heading);

  // Információs szöveg frissítése
  const hasGPS = position.lat !== 0 || position.lon !== 0;
  const hasOrientation = orientation.alpha !== 0 || orientation.beta !== 0 || orientation.gamma !== 0;
  const hasAbsoluteOrientation = absoluteOrientation.alpha !== 0 || absoluteOrientation.beta !== 0 || absoluteOrientation.gamma !== 0;
  
  let infoText = 
    `📍 GPS: ${hasGPS ? `${position.lat.toFixed(5)}, ${position.lon.toFixed(5)} (±${position.accuracy?.toFixed(0)}m)` : 'Várakozás...'}\n` +
    `🧭 Relatív orientáció: ${hasOrientation ? `α:${orientation.alpha.toFixed(1)}° β:${orientation.beta.toFixed(1)}° γ:${orientation.gamma.toFixed(1)}°` : 'Várakozás...'}\n`;
  
  if (hasAbsoluteOrientation) {
    infoText += `🧭 Abszolút orientáció: α:${absoluteOrientation.alpha.toFixed(1)}° β:${absoluteOrientation.beta.toFixed(1)}° γ:${absoluteOrientation.gamma.toFixed(1)}°\n`;
    infoText += `${absoluteOrientation.absolute ? '✅' : '⚠️'} Abszolút mérés: ${absoluteOrientation.absolute ? 'Igen' : 'Nem'}\n`;
  } else {
    infoText += `🧭 Abszolút orientáció: Várakozás...\n`;
  }
  
  if (heading !== null) {
    infoText += `🧭 Északi eltérés: ${heading.toFixed(1)}°`;
  } else {
    infoText += `🧭 Északi eltérés: Nem elérhető`;
  }
  
  info.innerText = infoText;

  requestAnimationFrame(loop);
}

// 🎬 Indítás gomb esemény
startButton.addEventListener('click', async () => {
  try {
    startButton.disabled = true;
    startButton.innerText = 'Indítás...';
    
    // Párhuzamos indítás
    await Promise.all([
      startCamera(),
      startOrientation()
    ]);
    
    startGPS();
    
    startButton.style.display = 'none';
    isRunning = true;
    loop();
    
  } catch (error) {
    console.error('Indítási hiba:', error);
    startButton.disabled = false;
    startButton.innerText = 'AR indítása';
    info.innerText = 'Hiba történt: ' + error.message;
  }
});

// Takarítás oldal elhagyásakor
window.addEventListener('beforeunload', () => {
  isRunning = false;
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }
});
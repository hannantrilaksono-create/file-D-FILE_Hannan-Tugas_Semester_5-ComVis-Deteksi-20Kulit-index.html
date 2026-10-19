// ====== Elemen DOM ======
const fileInput = document.getElementById("fileInput");
const camBtn = document.getElementById("camBtn");
const stopBtn = document.getElementById("stopBtn");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const placeholder = document.getElementById("placeholder");
const overlayToggle = document.getElementById("overlayToggle");

const percentEl = document.getElementById("percent");
const swatchEl = document.getElementById("swatch");
const rgbTextEl = document.getElementById("rgbText");
const categoryEl = document.getElementById("category");
const matchEl = document.getElementById("match");

let stream = null;
let animId = null;
let currentImage = null;

// ====== Deteksi piksel kulit ======
// Menggunakan ruang warna YCbCr + aturan RGB agar tone kulit
// coklat / sawo matang tetap terdeteksi.
function isSkin(r, g, b) {
  const y  = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

  const ycbcrOk = cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
  const rgbOk =
    r > 40 && r > g && g > b &&
    (r - Math.min(g, b)) > 15 &&
    Math.abs(r - g) > 8;

  return y > 30 && ycbcrOk && rgbOk;
}

// ====== Klasifikasi berdasarkan kecerahan rata-rata ======
function classify(r, g, b) {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum > 180) return { name: "Kuning Langsat (Terang)", indonesia: false };
  if (lum > 130) return { name: "Sawo Matang", indonesia: true };
  if (lum > 85)  return { name: "Coklat", indonesia: true };
  return { name: "Coklat Tua / Gelap", indonesia: true };
}

// ====== Analisis frame pada canvas ======
function analyze() {
  const { width, height } = canvas;
  const frame = ctx.getImageData(0, 0, width, height);
  const d = frame.data;

  let count = 0, sr = 0, sg = 0, sb = 0;
  const showOverlay = overlayToggle.checked;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (isSkin(r, g, b)) {
      count++;
      sr += r; sg += g; sb += b;
      if (showOverlay) {
        // campur dengan hijau agar area kulit terlihat
        d[i]     = r * 0.4;
        d[i + 1] = g * 0.4 + 150;
        d[i + 2] = b * 0.4;
      }
    }
  }

  if (showOverlay) ctx.putImageData(frame, 0, 0);

  const total = width * height;
  const pct = (count / total) * 100;
  percentEl.textContent = pct.toFixed(1) + "%";

  if (count < total * 0.005) {
    swatchEl.style.background = "#eee";
    rgbTextEl.textContent = "-";
    categoryEl.textContent = "Kulit tidak terdeteksi";
    setMatch(null);
    return;
  }

  const ar = Math.round(sr / count);
  const ag = Math.round(sg / count);
  const ab = Math.round(sb / count);

  swatchEl.style.background = `rgb(${ar}, ${ag}, ${ab})`;
  rgbTextEl.textContent = `RGB(${ar}, ${ag}, ${ab})`;

  const result = classify(ar, ag, ab);
  categoryEl.textContent = result.name;
  setMatch(result.indonesia);
}

function setMatch(value) {
  matchEl.className = "badge";
  if (value === null) {
    matchEl.textContent = "-";
  } else if (value) {
    matchEl.textContent = "Sesuai (Coklat / Sawo Matang)";
    matchEl.classList.add("yes");
  } else {
    matchEl.textContent = "Kurang sesuai";
    matchEl.classList.add("no");
  }
}

// ====== Tampilkan canvas ======
function showCanvas() {
  canvas.style.display = "block";
  placeholder.style.display = "none";
}

// ====== Mode gambar ======
function drawImage(img) {
  const maxW = 640;
  const scale = Math.min(1, maxW / img.width);
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  showCanvas();
  analyze();
}

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  stopCamera();

  const img = new Image();
  img.onload = () => {
    currentImage = img;
    drawImage(img);
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
});

// Analisis ulang jika toggle overlay diubah (mode gambar)
overlayToggle.addEventListener("change", () => {
  if (currentImage && !stream) drawImage(currentImage);
});

// ====== Mode kamera ======
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
    });
    video.srcObject = stream;
    await video.play();

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    showCanvas();

    camBtn.disabled = true;
    stopBtn.disabled = false;
    loop();
  } catch (err) {
    alert("Tidak bisa mengakses kamera: " + err.message);
  }
}

function loop() {
  // Balik horizontal (efek cermin) supaya kiri-kanan terlihat natural seperti selfie
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  analyze();
  animId = requestAnimationFrame(loop);
}

function stopCamera() {
  if (animId) cancelAnimationFrame(animId);
  animId = null;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  camBtn.disabled = false;
  stopBtn.disabled = true;
}

camBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
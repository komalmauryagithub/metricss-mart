(function () {
  const CAPTURE_SIZE = 160;
  const HASH_GRID_SIZE = 8;
  const HISTOGRAM_BUCKETS = 4;

  let activeStream = null;
  let modalElement = null;
  let videoElement = null;
  let statusElement = null;
  let captureButton = null;
  let cancelButton = null;
  let currentReject = null;
  let activeCaptureHandler = null;


  function stopCamera() {
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      activeStream = null;
    }

    if (videoElement) {
      videoElement.srcObject = null;
    }
  }

  function setStatus(message, type = "neutral") {
    if (!statusElement) return;
    statusElement.textContent = message || "";
    statusElement.dataset.type = type;
  }

  function closeModal() {
    if (captureButton && activeCaptureHandler) {
      captureButton.removeEventListener("click", activeCaptureHandler);
      activeCaptureHandler = null;
    }

    stopCamera();
    if (modalElement) {
      modalElement.classList.add("hidden");
      modalElement.setAttribute("aria-hidden", "true");
    }

    document.body.classList.remove("attendance-face-open");
    currentReject = null;
  }

  function ensureModal() {
    if (modalElement) return modalElement;

    modalElement = document.createElement("div");
    modalElement.id = "attendanceFaceModal";
    modalElement.className = "attendance-face-modal hidden";
    modalElement.setAttribute("aria-hidden", "true");
    modalElement.innerHTML = `
      <div class="attendance-face-dialog" role="dialog" aria-modal="true" aria-labelledby="attendanceFaceTitle">
        <div class="attendance-face-head">
          <div>
            <p class="attendance-face-kicker">Private Face Check</p>
            <h2 id="attendanceFaceTitle">Live Face Verification</h2>
          </div>
          <button type="button" class="attendance-face-icon-btn" id="attendanceFaceCloseBtn" aria-label="Close face verification">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="attendance-face-video-wrap">
          <video id="attendanceFaceVideo" autoplay playsinline muted></video>
          <div class="attendance-face-frame" aria-hidden="true"></div>
        </div>
        <p class="attendance-face-status" id="attendanceFaceStatus" data-type="neutral"></p>
        <div class="attendance-face-actions">
          <button type="button" class="attendance-face-secondary" id="attendanceFaceCancelBtn">Cancel</button>
          <button type="button" class="attendance-face-primary" id="attendanceFaceCaptureBtn">Capture</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalElement);
    videoElement = modalElement.querySelector("#attendanceFaceVideo");
    statusElement = modalElement.querySelector("#attendanceFaceStatus");
    captureButton = modalElement.querySelector("#attendanceFaceCaptureBtn");
    cancelButton = modalElement.querySelector("#attendanceFaceCancelBtn");

    const rejectCapture = () => {
      const reject = currentReject;
      closeModal();
      if (reject) reject(new Error("Face capture cancelled."));
    };

    modalElement
      .querySelector("#attendanceFaceCloseBtn")
      ?.addEventListener("click", rejectCapture);
    cancelButton?.addEventListener("click", rejectCapture);
    modalElement.addEventListener("click", (event) => {
      if (event.target === modalElement) rejectCapture();
    });

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        modalElement &&
        !modalElement.classList.contains("hidden")
      ) {
        rejectCapture();
      }
    });

    return modalElement;
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera is not supported in this browser.");
    }

    const cameraConstraints = [
      {
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: "user",
        },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let lastError = null;
    for (const constraints of cameraConstraints) {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!activeStream) {
      throw lastError || new Error("Camera open nahi ho paya.");
    }

    videoElement.setAttribute("playsinline", "");
    videoElement.setAttribute("webkit-playsinline", "");
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.srcObject = activeStream;
    await videoElement.play();
  }

  function waitForVideoFrame() {
    return new Promise((resolve) => {
      if (videoElement.videoWidth && videoElement.videoHeight) {
        resolve();
        return;
      }

      videoElement.addEventListener("loadedmetadata", resolve, { once: true });
    });
  }

  async function detectFace() {
    if (!("FaceDetector" in window)) {
      return true;
    }

    try {
      const detector = new window.FaceDetector({
        fastMode: true,
        maxDetectedFaces: 1,
      });
      const faces = await detector.detect(videoElement);
      return faces.length > 0;
    } catch (_err) {
      return true;
    }
  }

  function getCaptureImageData() {
    const sourceWidth = videoElement.videoWidth || CAPTURE_SIZE;
    const sourceHeight = videoElement.videoHeight || CAPTURE_SIZE;
    const sourceSize = Math.min(sourceWidth, sourceHeight);
    const sourceX = Math.max(0, Math.floor((sourceWidth - sourceSize) / 2));
    const sourceY = Math.max(0, Math.floor((sourceHeight - sourceSize) / 2));

    const canvas = document.createElement("canvas");
    canvas.width = CAPTURE_SIZE;
    canvas.height = CAPTURE_SIZE;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(
      videoElement,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      CAPTURE_SIZE,
      CAPTURE_SIZE,
    );

    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.82),
      imageData: context.getImageData(0, 0, CAPTURE_SIZE, CAPTURE_SIZE),
    };
  }

  function buildSignatureFromImageData(imageData) {
    const { data, width, height } = imageData;
    const grayscale = [];
    const histogram = new Array(HISTOGRAM_BUCKETS * 3).fill(0);
    let brightnessTotal = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixelIndex = (y * width + x) * 4;
        const red = data[pixelIndex];
        const green = data[pixelIndex + 1];
        const blue = data[pixelIndex + 2];
        const gray = (red * 0.299) + (green * 0.587) + (blue * 0.114);

        brightnessTotal += gray;
        histogram[Math.min(HISTOGRAM_BUCKETS - 1, Math.floor(red / 64))] += 1;
        histogram[HISTOGRAM_BUCKETS + Math.min(HISTOGRAM_BUCKETS - 1, Math.floor(green / 64))] += 1;
        histogram[(HISTOGRAM_BUCKETS * 2) + Math.min(HISTOGRAM_BUCKETS - 1, Math.floor(blue / 64))] += 1;

        grayscale.push(gray);
      }
    }

    const cellWidth = width / HASH_GRID_SIZE;
    const cellHeight = height / HASH_GRID_SIZE;
    const cellAverages = [];

    for (let gridY = 0; gridY < HASH_GRID_SIZE; gridY += 1) {
      for (let gridX = 0; gridX < HASH_GRID_SIZE; gridX += 1) {
        const xStart = Math.floor(gridX * cellWidth);
        const xEnd = Math.floor((gridX + 1) * cellWidth);
        const yStart = Math.floor(gridY * cellHeight);
        const yEnd = Math.floor((gridY + 1) * cellHeight);
        let total = 0;
        let count = 0;

        for (let y = yStart; y < yEnd; y += 1) {
          for (let x = xStart; x < xEnd; x += 1) {
            total += grayscale[y * width + x] || 0;
            count += 1;
          }
        }

        cellAverages.push(count ? total / count : 0);
      }
    }

    const average = cellAverages.reduce((sum, value) => sum + value, 0) / cellAverages.length;
    const pixelCount = width * height;
    const normalizedHistogram = histogram.map((value) => Number((value / pixelCount).toFixed(6)));

    return {
      version: 1,
      hash: cellAverages.map((value) => (value >= average ? "1" : "0")).join(""),
      histogram: normalizedHistogram,
      brightness: Number((brightnessTotal / pixelCount).toFixed(2)),
      width,
      height,
      capturedAt: new Date().toISOString(),
    };
  }

  async function captureFace(options = {}) {
    ensureModal();

    const title = modalElement.querySelector("#attendanceFaceTitle");
    if (title) {
      title.textContent = options.title || "Live Face Verification";
    }

    if (captureButton) {
      captureButton.textContent = options.actionLabel || "Capture";
      captureButton.disabled = true;
    }

    setStatus("Starting camera...", "neutral");
    modalElement.classList.remove("hidden");
    modalElement.setAttribute("aria-hidden", "false");
    document.body.classList.add("attendance-face-open");

    return new Promise(async (resolve, reject) => {
      currentReject = reject;

      try {
        await startCamera();
        await waitForVideoFrame();
        setStatus("Ready", "success");
        if (captureButton) captureButton.disabled = false;
      } catch (err) {
        closeModal();
        reject(
          new Error(
            err?.message || "Camera open nahi ho paya. Browser camera permission allow karo.",
          ),
        );
        return;
      }

      const onCapture = async () => {
        try {
          if (captureButton) captureButton.disabled = true;
          setStatus("Checking face...", "neutral");

          const hasFace = await detectFace();
          if (!hasFace) {
            setStatus("Face not found. Please retry.", "error");
            if (captureButton) captureButton.disabled = false;
            return;
          }

          const capture = getCaptureImageData();
          const signature = buildSignatureFromImageData(capture.imageData);
          closeModal();
          resolve({
            faceImage: capture.dataUrl,
            faceSignature: signature,
          });
        } catch (err) {
          setStatus(err?.message || "Face capture failed. Please retry.", "error");
          if (captureButton) captureButton.disabled = false;
        }
      };

      activeCaptureHandler = onCapture;
      captureButton?.addEventListener("click", onCapture);
    });
  }

  async function captureForAttendance(options = {}) {
    return captureFace({
      title: options.title || "Attendance Face Check",
      actionLabel: options.actionLabel || "Verify Face",
    });
  }

  async function captureEnrollment(options = {}) {
    return captureFace({
      title: options.title || "Private Face Setup",
      actionLabel: options.actionLabel || "Save Face",
    });
  }

  window.AttendanceFace = {
    captureEnrollment,
    captureForAttendance,
    buildSignatureFromImageData,
  };
})();

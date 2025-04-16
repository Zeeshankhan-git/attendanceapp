const API_BASE_URL = "http://localhost:8080/api";
//const API_BASE_URL = "http://172.20.10.2:8080/api";
//const API_BASE_URL = "https://4100-2401-4900-65cc-d79e-bcfd-49c5-d253-4675.ngrok-free.app/api";
let currentAction = 'attendance';
let geolocationWatchId = null;
let currentLat = 13.326389; // Default latitude
let currentLon = 77.128889; // Default longitude

// Initialize on page load
window.addEventListener('load', () => {
    const canvas = document.getElementById("signaturePad");
    if (!canvas || !canvas.getContext) {
        showError('parametersError', 'Canvas not supported by this browser');
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const startCameraBtn = document.getElementById("startCameraBtn");
        if (startCameraBtn) startCameraBtn.disabled = true;
        showError('parametersError', 'Camera not supported by this browser');
    }
    if (!navigator.geolocation) {
        showError('parametersError', 'Geolocation not supported by this browser');
        const locationEl = document.getElementById("location");
        if (locationEl) locationEl.innerText = convertToDMS(currentLat, currentLon);
        fetchAddress(currentLat, currentLon);
        fetchWeather(currentLat, currentLon);
    } else {
        startGeolocation();
    }
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        updateThemeIcon(true);
    }
    showPage('loginPage'); // Start on login page
    updateTimestamp();
});

// Show/hide pages
function showPage(pageId, action = null) {
    // Hide all pages
    document.querySelectorAll("[data-page]").forEach(section => {
        section.classList.add("hidden");
    });
    // Show target page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.remove("hidden");
    } else {
        console.error(`Page with ID ${pageId} not found`);
        return;
    }

    // Handle specific page logic
    if (pageId === 'parametersPage') {
        currentAction = action || 'attendance';
        const username = localStorage.getItem("loggedInUser") || "User";
        const parametersTitle = document.getElementById("parametersTitle");
        const submitBtn = document.getElementById("submitBtn");
        if (parametersTitle) {
            parametersTitle.innerText = `Mark ${currentAction.charAt(0).toUpperCase() + currentAction.slice(1)} for ${username}`;
        }
        if (submitBtn) {
            submitBtn.innerText = `Submit ${currentAction.charAt(0).toUpperCase() + currentAction.slice(1)}`;
        }
        resetParametersPage();
        startGeolocation();
    }
    if (pageId === 'homePage') {
        const usernameDisplay = document.getElementById("usernameDisplay");
        if (usernameDisplay) {
            usernameDisplay.innerText = localStorage.getItem("loggedInUser") || "User";
        }
    }
    if (pageId === 'landingPage') {
        const landingUsername = document.getElementById("landingUsername");
        if (landingUsername) {
            landingUsername.innerText = localStorage.getItem("loggedInUser") || "User";
        }
    }
    if (pageId === 'adminPage') {
        fetchAdminRecords();
    }
    if (pageId !== 'parametersPage') {
        const video = document.getElementById("cameraPreview");
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
        stopGeolocation();
    }
    if (pageId === 'signupPage' || pageId === 'loginPage') {
        clearErrors();
    }
}

// Theme toggle
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.innerHTML = isDark
            ? '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>'
            : '<path d="M12 2v2m0 16v2m10-10h-2m-16 0H2m17.07-7.07l-1.42 1.42M5.35 17.65l-1.42 1.42M17.65 17.65l-1.42-1.42M5.35 5.35l-1.42-1.42M12 6a6 6 0 100 12 6 6 0 000-12z"/>';
    }
}

// Update timestamp
function updateTimestamp() {
    const timestampEl = document.getElementById("timestamp");
    if (timestampEl) {
        setInterval(() => {
            timestampEl.innerText = new Date().toLocaleString('en-US', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
            });
        }, 1000);
    }
}

// Geolocation
function startGeolocation() {
    if (navigator.geolocation) {
        geolocationWatchId = navigator.geolocation.watchPosition(
            position => {
                currentLat = position.coords.latitude;
                currentLon = position.coords.longitude;
                const locationEl = document.getElementById("location");
                if (locationEl) {
                    locationEl.innerText = convertToDMS(currentLat, currentLon);
                }
                fetchAddress(currentLat, currentLon);
                fetchWeather(currentLat, currentLon);
            },
            error => {
                showError('parametersError', `Geolocation error: ${error.message}`);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    }
}

function stopGeolocation() {
    if (geolocationWatchId !== null) {
        navigator.geolocation.clearWatch(geolocationWatchId);
        geolocationWatchId = null;
    }
}

// Error handling
function showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
        errorEl.innerText = message;
        errorEl.classList.remove("hidden");
    }
}

function clearErrors() {
    ['signupError', 'loginError', 'parametersError', 'locationError'].forEach(id => {
        const errorEl = document.getElementById(id);
        if (errorEl) {
            errorEl.innerText = '';
            errorEl.classList.add('hidden');
        }
    });
}

// Reset parameters page
function resetParametersPage() {
    const video = document.getElementById("cameraPreview");
    const img = document.getElementById("capturedImage");
    const captureBtn = document.getElementById("captureBtn");
    const startCameraBtn = document.getElementById("startCameraBtn");
    const clearBtn = document.getElementById("clearBtn");
    const descriptionBox = document.getElementById("descriptionBox");

    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    if (video) video.classList.remove("hidden");
    if (img) {
        img.classList.add("hidden");
        img.src = "";
    }
    if (captureBtn) captureBtn.classList.add("hidden");
    if (startCameraBtn) startCameraBtn.classList.remove("hidden");
    if (clearBtn) clearBtn.classList.add("hidden");
    clearSignature();
    if (descriptionBox) descriptionBox.value = "";
    clearErrors();
}

// Signup
async function handleSignup() {
    const username = document.getElementById("signupUser")?.value.trim();
    const password = document.getElementById("signupPass")?.value.trim();

    if (!username || !password) {
        showError('signupError', 'Please enter both username and password');
        return;
    }
    if (username.length < 3) {
        showError('signupError', 'Username must be at least 3 characters');
        return;
    }
    if (password.length < 6) {
        showError('signupError', 'Password must be at least 6 characters');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok && data.status === 'success') {
            alert("Signup successful!");
            document.getElementById("signupUser").value = "";
            document.getElementById("signupPass").value = "";
            showPage('loginPage');
        } else {
            showError('signupError', data.message || 'Signup failed');
        }
    } catch (err) {
        showError('signupError', 'Cannot connect to server. Ensure backend is running.');
    }
}

// Login
async function handleLogin() {
    const username = document.getElementById("loginUser")?.value.trim();
    const password = document.getElementById("loginPass")?.value.trim();

    if (!username || !password) {
        showError('loginError', 'Please enter both username and password');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok && data.status === 'success') {
            localStorage.setItem("loggedInUser", username);
            localStorage.setItem("isAdmin", data.isAdmin ? "true" : "false");
            document.getElementById("loginUser").value = "";
            document.getElementById("loginPass").value = "";
            showPage(data.isAdmin ? 'adminPage' : 'landingPage');
        } else {
            showError('loginError', data.message || 'Login failed');
        }
    } catch (err) {
        showError('loginError', 'Cannot connect to server. Ensure backend is running.');
    }
}

// Logout
function logout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("isAdmin");
    clearSignature();
    stopGeolocation();
    const video = document.getElementById("cameraPreview");
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    showPage("loginPage");
}

// Admin records
async function fetchAdminRecords() {
    const recordsDiv = document.getElementById("adminRecords");
    if (!recordsDiv) return;

    if (localStorage.getItem("isAdmin") !== "true") {
        recordsDiv.innerHTML = "<p>You do not have admin access.</p>";
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/admin/records`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (response.ok && data.status === 'success') {
            recordsDiv.innerHTML = data.records?.length
                ? data.records.map(record => `
                    <p><strong>User:</strong> ${record.username} | <strong>Action:</strong> ${record.action} | <strong>Time:</strong> ${new Date(record.timestamp).toLocaleString()}</p>
                `).join('')
                : "<p>No records found.</p>";
        } else {
            recordsDiv.innerHTML = "<p>Failed to load records.</p>";
        }
    } catch (err) {
        recordsDiv.innerHTML = "<p>Error: Cannot connect to server.</p>";
    }
}

// Submit attendance/exit
async function submitAction() {
    const username = localStorage.getItem("loggedInUser");
    const location = document.getElementById("location")?.innerText;
    const signature = document.getElementById("signaturePad")?.toDataURL("image/png");
    const image = document.getElementById("capturedImage")?.src || "";
    const description = document.getElementById("descriptionBox")?.value.trim() || "";
    const endpoint = currentAction === 'attendance' ? '/attendance' : '/exit';

    if (!username) {
        showError('parametersError', 'Please login first');
        return;
    }
    if (!location || location === 'Fetching...' || location.includes('Unable')) {
        showError('parametersError', 'Location not available');
        return;
    }
    const canvas = document.getElementById("signaturePad");
    const emptyCanvas = document.createElement("canvas");
    emptyCanvas.width = canvas.width;
    emptyCanvas.height = canvas.height;
    if (canvas.toDataURL('image/png') === emptyCanvas.toDataURL('image/png')) {
        showError('parametersError', 'Please provide a signature');
        return;
    }
    if (!image) {
        showError('parametersError', 'Please capture a selfie');
        return;
    }

    const submissionData = {
        username,
        location: `${currentLat},${currentLon}`,
        latitude: currentLat,
        longitude: currentLon,
        signature,
        image,
        description
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submissionData)
        });
        const data = await response.json();
        if (response.ok && data.status === 'success') {
            alert(`${currentAction === 'attendance' ? 'Attendance' : 'Exit'} marked successfully!`);
            resetParametersPage();
            showPage('homePage');
        } else {
            showError('parametersError', data.message || 'Submission failed');
        }
    } catch (err) {
        showError('parametersError', 'Cannot connect to server');
    }
}

// Modal handling
function closeModal() {
    const modal = document.getElementById("mismatchModal");
    if (modal) modal.classList.add("hidden");
}

function openLocationModal() {
    const modal = document.getElementById("locationModal");
    if (modal) {
        modal.classList.remove("hidden");
        document.getElementById("customLocationName").value = "";
        document.getElementById("customLatitude").value = currentLat.toFixed(6);
        document.getElementById("customLongitude").value = currentLon.toFixed(6);
        clearErrors();
    }
}

function closeLocationModal() {
    const modal = document.getElementById("locationModal");
    if (modal) {
        modal.classList.add("hidden");
        clearErrors();
    }
}

async function saveCustomLocation() {
    const locationName = document.getElementById("customLocationName")?.value.trim();
    const latitude = parseFloat(document.getElementById("customLatitude")?.value);
    const longitude = parseFloat(document.getElementById("customLongitude")?.value);

    if (!locationName) {
        showError('locationError', 'Please enter a location name');
        return;
    }
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        showError('locationError', 'Please enter a valid latitude (-90 to 90)');
        return;
    }
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        showError('locationError', 'Please enter a valid longitude (-180 to 180)');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/save-location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: localStorage.getItem("loggedInUser"),
                name: locationName,
                latitude,
                longitude
            })
        });
        const data = await response.json();
        if (response.ok && data.status === 'success') {
            currentLat = latitude;
            currentLon = longitude;
            const locationEl = document.getElementById("location");
            if (locationEl) locationEl.innerText = convertToDMS(currentLat, currentLon);
            fetchAddress(currentLat, currentLon);
            fetchWeather(currentLat, currentLon);
            alert(`Location "${locationName}" saved successfully!`);
            closeLocationModal();
        } else {
            showError('locationError', data.message || 'Failed to save location');
        }
    } catch (err) {
        showError('locationError', 'Cannot connect to server');
    }
}

// Utility functions
function convertToDMS(lat, lon) {
    const toDMS = (coord, isLat) => {
        const abs = Math.abs(coord);
        const deg = Math.floor(abs);
        const min = Math.floor((abs - deg) * 60);
        const sec = Math.floor((abs - deg - min / 60) * 3600);
        const dir = coord >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');
        return `${deg}°${min}'${sec}"${dir}`;
    };
    return `${toDMS(lat, true)} ${toDMS(lon, false)}`;
}

async function fetchAddress(lat, lon) {
    const addressEl = document.getElementById("address");
    if (!addressEl) return;
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const data = await response.json();
        addressEl.innerText = data.display_name || "Not found";
    } catch {
        addressEl.innerText = "Error fetching address";
    }
}

async function fetchWeather(lat, lon) {
    const weatherEl = document.getElementById("weather");
    if (!weatherEl) return;
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();
        weatherEl.innerText = data.current_weather ? `${data.current_weather.temperature}°C` : "Not available";
    } catch {
        weatherEl.innerText = "Error fetching weather";
    }
}

function openGoogleMaps() {
    if (currentLat && currentLon) {
        window.open(`https://www.google.com/maps?q=${currentLat},${currentLon}`, '_blank');
    } else {
        showError('parametersError', 'Location not available');
    }
}

// Camera handling
async function startCamera() {
    const video = document.getElementById("cameraPreview");
    const captureBtn = document.getElementById("captureBtn");
    const startCameraBtn = document.getElementById("startCameraBtn");
    const clearBtn = document.getElementById("clearBtn");

    if (!video || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError('parametersError', 'Camera not supported');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        video.srcObject = stream;
        video.classList.remove("hidden");
        if (captureBtn) captureBtn.classList.remove("hidden");
        if (startCameraBtn) startCameraBtn.classList.add("hidden");
        if (clearBtn) clearBtn.classList.add("hidden");
    } catch (err) {
        showError('parametersError', `Camera error: ${err.message}`);
    }
}

function captureImage() {
    const video = document.getElementById("cameraPreview");
    const img = document.getElementById("capturedImage");
    const captureBtn = document.getElementById("captureBtn");
    const startCameraBtn = document.getElementById("startCameraBtn");
    const clearBtn = document.getElementById("clearBtn");

    if (!video || !img || !video.srcObject) {
        showError('parametersError', 'Camera not started');
        return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    img.src = canvas.toDataURL("image/png");
    img.classList.remove("hidden");
    video.classList.add("hidden");
    if (captureBtn) captureBtn.classList.add("hidden");
    if (startCameraBtn) startCameraBtn.classList.add("hidden");
    if (clearBtn) clearBtn.classList.remove("hidden");

    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
}

function clearImage() {
    const img = document.getElementById("capturedImage");
    const captureBtn = document.getElementById("captureBtn");
    const clearBtn = document.getElementById("clearBtn");

    if (img) {
        img.src = "";
        img.classList.add("hidden");
    }
    if (captureBtn) captureBtn.classList.remove("hidden");
    if (clearBtn) clearBtn.classList.add("hidden");
    startCamera();
}

// Signature handling
const canvas = document.getElementById("signaturePad");
const ctx = canvas ? canvas.getContext("2d") : null;
let isDrawing = false;

if (canvas && ctx) {
    canvas.addEventListener("mousedown", e => {
        isDrawing = true;
        ctx.beginPath();
        ctx.moveTo(e.offsetX, e.offsetY);
    });

    canvas.addEventListener("mousemove", e => {
        if (isDrawing) {
            ctx.lineTo(e.offsetX, e.offsetY);
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });

    canvas.addEventListener("mouseup", () => isDrawing = false);
    canvas.addEventListener("mouseout", () => isDrawing = false);

    // Touch support
    canvas.addEventListener("touchstart", e => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        isDrawing = true;
        ctx.beginPath();
        ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    });

    canvas.addEventListener("touchmove", e => {
        e.preventDefault();
        if (isDrawing) {
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });

    canvas.addEventListener("touchend", () => isDrawing = false);
}

function clearSignature() {
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    const descriptionBox = document.getElementById("descriptionBox");
    if (descriptionBox) descriptionBox.value = "";
}

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });

//    if ("OPTIONS".equals(exchange.getRequestMethod())) {
//        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
//        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
//        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "*");
//        exchange.sendResponseHeaders(204, -1);
//        return;
//    }

}
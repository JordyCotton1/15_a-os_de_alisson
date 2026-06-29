const SUPABASE_URL = "https://dxdmodawgdyfeswowhmy.supabase.co";
const SUPABASE_KEY = "sb_publishable_37O1kElPeLZ0woeY3ixmaw_77-95XwH";
const SUPABASE_BUCKET = "photos";
const PHOTO_STORE = "photos";
const WISH_STORE = "wishes";

const viewPanels = document.querySelectorAll("[data-view-panel]");
const viewButtons = document.querySelectorAll("[data-view]");
const form = document.querySelector("#uploadForm");
const input = document.querySelector("#photoInput");
const dropZone = document.querySelector("#dropZone");
const guestName = document.querySelector("#guestName");
const guestMessage = document.querySelector("#guestMessage");
const statusMessage = document.querySelector("#statusMessage");
const galleryGrid = document.querySelector("#galleryGrid");
const previewStrip = document.querySelector("#previewStrip");
const emptyState = document.querySelector("#emptyState");
const template = document.querySelector("#photoCardTemplate");
const memoryCount = document.querySelector("#memoryCount");
const photoCount = document.querySelector("#photoCount");
const messageCount = document.querySelector("#messageCount");
const wishForm = document.querySelector("#wishForm");
const wishName = document.querySelector("#wishName");
const wishText = document.querySelector("#wishText");
const wishGrid = document.querySelector("#wishGrid");
const wishEmpty = document.querySelector("#wishEmpty");
const wishTemplate = document.querySelector("#wishTemplate");
const musicButton = document.querySelector("#musicButton");
const eventMusic = document.querySelector("#eventMusic");
const photoModal = document.querySelector("#photoModal");
const modalPhoto = document.querySelector("#modalPhoto");
const closePhotoModal = document.querySelector("#closePhotoModal");
const photoModalBackdrop = document.querySelector(".photo-modal__backdrop");
const loginView = document.querySelector("#loginView");
const loginForm = document.querySelector("#loginForm");
const loginFirstName = document.querySelector("#loginFirstName");
const loginLastName = document.querySelector("#loginLastName");
const loginSubmitButton = loginForm.querySelector("button[type='submit']");
const lockButton = document.querySelector("#lockButton");
const refreshButton = document.querySelector("#refreshButton");
const logoutButton = document.querySelector("#logoutButton");

let selectedFiles = [];
const DEFAULT_VIEW = "share";
document.body.dataset.activeView = DEFAULT_VIEW;
let currentGuest = null;
const SESSION_KEY = "alisson-xv-guest";
let musicUnlocked = false;
let guestsLocked = false;

document.querySelectorAll("img[data-fallback-src]").forEach((image) => {
  image.addEventListener(
    "error",
    () => {
      const fallback = image.dataset.fallbackSrc;
      if (fallback && image.src !== fallback) {
        image.src = fallback;
      }
    },
    { once: true }
  );
});

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...extra,
  };
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: supabaseHeaders(options.headers),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Supabase request failed: ${response.status}`);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function getPublicPhotoUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
}

function getAll(storeName) {
  if (storeName === PHOTO_STORE) {
    return supabaseRequest("/rest/v1/photos?select=*&order=created_at.desc");
  }

  return supabaseRequest("/rest/v1/wishes?select=*&order=created_at.desc");
}

async function loadGuestLock() {
  try {
    const rows = await supabaseRequest("/rest/v1/app_settings?select=value&key=eq.guests_locked");
    guestsLocked = Boolean(rows?.[0]?.value);
  } catch {
    guestsLocked = false;
  }

  lockButton.textContent = guestsLocked ? "Abrir" : "Bloquear";
  lockButton.classList.toggle("is-locked", guestsLocked);
  lockButton.setAttribute(
    "aria-label",
    guestsLocked ? "Permitir entrada de invitados" : "Bloquear entrada de invitados"
  );

  if (guestsLocked && currentGuest?.role !== "admin") {
    logoutGuest();
  }
}

async function setGuestLock(locked) {
  await supabaseRequest("/rest/v1/app_settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ key: "guests_locked", value: locked }),
  });
  guestsLocked = locked;
  lockButton.textContent = guestsLocked ? "Abrir" : "Bloquear";
  lockButton.classList.toggle("is-locked", guestsLocked);
}

function saveWish(wish) {
  return supabaseRequest("/rest/v1/wishes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      name: wish.name,
      text: wish.text,
    }),
  });
}

function updatePhotoLikes(photo) {
  return supabaseRequest(`/rest/v1/photos?id=eq.${photo.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ likes: (photo.likes || 0) + 1 }),
  });
}

async function deletePhoto(photo) {
  await supabaseRequest(`/rest/v1/photos?id=eq.${photo.id}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });

  if (photo.image_path) {
    await supabaseRequest(`/storage/v1/object/${SUPABASE_BUCKET}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [photo.image_path] }),
    });
  }
}

function deleteWish(wish) {
  return supabaseRequest(`/rest/v1/wishes?id=eq.${wish.id}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

function normalizeName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getGuestRole(firstName, lastName) {
  return normalizeName(`${firstName} ${lastName}`) === "xv anera" ? "admin" : "guest";
}

function applyGuestSession(guest) {
  currentGuest = guest;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(guest));
  document.body.classList.add("is-logged-in");
  document.body.dataset.userRole = guest.role;
  loginView.hidden = true;

  const fullName = `${guest.firstName} ${guest.lastName}`.trim();
  guestName.value = fullName;
  wishName.value = fullName;

  if (guest.role === "admin" && document.body.dataset.activeView === "share") {
    showView("gallery");
  }
}

function logoutGuest() {
  currentGuest = null;
  sessionStorage.removeItem(SESSION_KEY);
  document.body.classList.remove("is-logged-in");
  delete document.body.dataset.userRole;
  document.body.dataset.activeView = DEFAULT_VIEW;
  loginView.hidden = false;
  loginForm.reset();
  resetUploadForm();
  wishName.value = "";
  viewPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.viewPanel === DEFAULT_VIEW);
  });
  viewButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === DEFAULT_VIEW);
  });
}

function imageToElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    image.src = url;
  });
}

async function compressImage(file) {
  try {
    const image = await imageToElement(file);
    const maxSize = 1400;
    const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
    const width = Math.round(image.width * ratio);
    const height = Math.round(image.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);

    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.78);
    });
  } catch {
    return file;
  }
}

async function uploadPhoto(file, name, message) {
  const imageBlob = await compressImage(file);
  const path = `${Date.now()}-${crypto.randomUUID()}.jpg`;

  await supabaseRequest(`/storage/v1/object/${SUPABASE_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": imageBlob.type || "image/jpeg",
      "x-upsert": "false",
    },
    body: imageBlob,
  });

  await supabaseRequest("/rest/v1/photos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      name,
      message,
      image_path: path,
      likes: 0,
    }),
  });
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function showView(viewName) {
  if (currentGuest?.role === "admin" && viewName === "share") {
    viewName = "gallery";
  }

  document.body.dataset.activeView = viewName;

  viewPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.viewPanel === viewName);
    panel.scrollTop = 0;
  });

  viewButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName);
  });

  if (viewName === "share") {
    setStatus("Elige tus fotos y escribe un mensaje para Alisson.");
  }
}

function resetUploadForm() {
  selectedFiles = [];
  input.value = "";
  guestName.value = currentGuest ? `${currentGuest.firstName} ${currentGuest.lastName}`.trim() : "";
  guestMessage.value = "";
  renderPreview();
}

function renderPreview() {
  previewStrip.innerHTML = "";
  previewStrip.hidden = selectedFiles.length === 0;

  selectedFiles.forEach((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = `Vista previa de ${file.name}`;
    img.onload = () => URL.revokeObjectURL(img.src);
    previewStrip.append(img);
  });
}

function openPhotoModal(photo) {
  modalPhoto.src = getPublicPhotoUrl(photo.image_path);
  modalPhoto.alt = photo.message
    ? `Foto subida por ${photo.name}: ${photo.message}`
    : `Foto subida por ${photo.name}`;
  photoModal.hidden = false;
  closePhotoModal.focus();
}

function hidePhotoModal() {
  photoModal.hidden = true;
  modalPhoto.removeAttribute("src");
  modalPhoto.alt = "";
}

function buildPhotoCard(photo, index = 0) {
  const card = template.content.firstElementChild.cloneNode(true);
  const photoFrame = card.querySelector(".photo-frame");
  const img = card.querySelector(".uploaded-photo");
  const name = card.querySelector("strong");
  const message = card.querySelector("span");
  const likeButton = card.querySelector(".like-button");
  const likeCount = card.querySelector(".like-button b");
  const deleteButton = card.querySelector(".delete-button");

  card.style.setProperty("--tilt", `${[-1.6, 1.2, -0.6, 1.8][index % 4]}deg`);
  img.src = getPublicPhotoUrl(photo.image_path);
  img.alt = photo.message
    ? `Foto subida por ${photo.name}: ${photo.message}`
    : `Foto subida por ${photo.name}`;
  name.textContent = photo.message || "Gracias por compartir este momento.";
  message.textContent = `Escrito por ${photo.name}`;
  likeCount.textContent = photo.likes || 0;

  photoFrame.addEventListener("click", () => openPhotoModal(photo));

  likeButton.addEventListener("click", async () => {
    await updatePhotoLikes(photo);
    await loadEverything();
  });

  deleteButton.hidden = currentGuest?.role !== "admin";
  deleteButton.addEventListener("click", async () => {
    if (currentGuest?.role !== "admin") return;
    await deletePhoto(photo);
    await loadEverything();
  });

  return card;
}

function renderGallery(photos, wishes) {
  const sortedPhotos = [...photos].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  galleryGrid.innerHTML = "";
  emptyState.hidden = photos.length > 0;

  sortedPhotos.forEach((photo, index) => {
    galleryGrid.append(buildPhotoCard(photo, index));
  });

  memoryCount.textContent = photos.length + wishes.length;
  photoCount.textContent = photos.length;
  messageCount.textContent = wishes.length;
}

function renderWishes(wishes) {
  wishGrid.innerHTML = "";
  wishEmpty.hidden = wishes.length > 0;

  [...wishes]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .forEach((wish) => {
      const card = wishTemplate.content.firstElementChild.cloneNode(true);
      const deleteButton = card.querySelector(".wish-delete-button");
      card.querySelector("p").textContent = `"${wish.text}"`;
      card.querySelector("strong").textContent = `Con cariño, ${wish.name}`;
      deleteButton.hidden = currentGuest?.role !== "admin";
      deleteButton.addEventListener("click", async () => {
        if (currentGuest?.role !== "admin") return;
        await deleteWish(wish);
        await loadEverything();
      });
      wishGrid.append(card);
    });
}

async function loadEverything() {
  const [photos, wishes] = await Promise.all([getAll(PHOTO_STORE), getAll(WISH_STORE)]);
  renderGallery(photos, wishes);
  renderWishes(wishes);
}

async function refreshEverything() {
  if (!currentGuest || !refreshButton || refreshButton.classList.contains("is-loading")) return;

  const label = refreshButton.textContent;
  refreshButton.classList.add("is-loading");
  refreshButton.textContent = "Cargando";
  refreshButton.disabled = true;

  try {
    await loadGuestLock();
    await loadEverything();
    refreshButton.textContent = "Listo";
    window.setTimeout(() => {
      refreshButton.textContent = label;
    }, 900);
  } catch {
    refreshButton.textContent = "Error";
    window.setTimeout(() => {
      refreshButton.textContent = label;
    }, 1200);
  } finally {
    refreshButton.classList.remove("is-loading");
    refreshButton.disabled = false;
  }
}

async function toggleGuestLock() {
  if (currentGuest?.role !== "admin" || lockButton.disabled) return;

  lockButton.disabled = true;
  try {
    await setGuestLock(!guestsLocked);
  } catch {
    lockButton.textContent = "Error";
    window.setTimeout(() => {
      lockButton.textContent = guestsLocked ? "Abrir" : "Bloquear";
    }, 1200);
  } finally {
    lockButton.disabled = false;
  }
}

function takeFiles(fileList) {
  selectedFiles = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
  renderPreview();
  setStatus(
    selectedFiles.length
      ? `${selectedFiles.length} foto${selectedFiles.length === 1 ? "" : "s"} lista${selectedFiles.length === 1 ? "" : "s"} para agregar.`
      : "Selecciona imágenes para subir."
  );
}

async function toggleMusic() {
  if (!eventMusic.paused) {
    eventMusic.pause();
    musicButton.textContent = "♪";
    return;
  }

  try {
    await eventMusic.play();
    musicUnlocked = true;
    musicButton.textContent = "Ⅱ";
  } catch {
    musicButton.textContent = "♪";
  }
}

async function startMusic() {
  if (musicUnlocked || !eventMusic.paused) return;

  try {
    await eventMusic.play();
    musicUnlocked = true;
    musicButton.textContent = "Ⅱ";
  } catch {
    musicButton.textContent = "♪";
  }
}

function unlockMusicOnce(event) {
  if (event.target.closest("#musicButton")) return;

  startMusic();
  document.removeEventListener("pointerdown", unlockMusicOnce);
  document.removeEventListener("touchstart", unlockMusicOnce);
  document.removeEventListener("click", unlockMusicOnce);
  document.removeEventListener("keydown", unlockMusicOnce);
}

viewButtons.forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

musicButton.addEventListener("click", toggleMusic);
lockButton.addEventListener("click", toggleGuestLock);
refreshButton?.addEventListener("click", refreshEverything);
logoutButton?.addEventListener("click", logoutGuest);
loginSubmitButton.addEventListener("pointerdown", startMusic);
loginSubmitButton.addEventListener("touchstart", startMusic);
loginSubmitButton.addEventListener("click", startMusic);
document.addEventListener("pointerdown", unlockMusicOnce);
document.addEventListener("touchstart", unlockMusicOnce);
document.addEventListener("click", unlockMusicOnce);
document.addEventListener("keydown", unlockMusicOnce);
startMusic();
loadGuestLock();
input.addEventListener("change", () => takeFiles(input.files));

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  takeFiles(event.dataTransfer.files);
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  startMusic();

  const firstName = loginFirstName.value.trim();
  const lastName = loginLastName.value.trim();
  if (!firstName) return;

  const guest = {
    firstName,
    lastName,
    role: getGuestRole(firstName, lastName),
  };

  await loadGuestLock();
  if (guestsLocked && guest.role !== "admin") {
    loginFirstName.setCustomValidity("La entrada está cerrada por ahora.");
    loginFirstName.reportValidity();
    loginFirstName.setCustomValidity("");
    return;
  }

  applyGuestSession(guest);
  loadEverything().catch(() => {
    setStatus("No se pudo cargar la galería en este navegador.");
  });
});

try {
  const savedGuest = JSON.parse(sessionStorage.getItem(SESSION_KEY));
  if (savedGuest?.firstName) {
    applyGuestSession(savedGuest);
    loadEverything().catch(() => {
      setStatus("No se pudo cargar la galerÃ­a en este navegador.");
    });
  }
} catch {
  sessionStorage.removeItem(SESSION_KEY);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedFiles.length) {
    setStatus("Primero elige una o varias fotos.");
    return;
  }

  const name = guestName.value.trim() || "Invitado especial";
  const message = guestMessage.value.trim();

  setStatus("Guardando recuerdos...");

  try {
    for (const file of selectedFiles) {
      await uploadPhoto(file, name, message);
    }

    await loadEverything();
    resetUploadForm();
    showView("gallery");
  } catch {
    setStatus("No se pudo subir la foto. Revisa la conexión o permisos de Supabase.");
  }
});

wishForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = wishText.value.trim();
  if (!text) return;

  try {
    await saveWish({
      name: wishName.value.trim() || "Invitado especial",
      text,
    });

    wishText.value = "";
    await loadEverything();
  } catch {
    wishText.setCustomValidity("No se pudo guardar el mensaje. Revisa Supabase.");
    wishText.reportValidity();
    wishText.setCustomValidity("");
  }
});

closePhotoModal.addEventListener("click", hidePhotoModal);
photoModalBackdrop.addEventListener("click", hidePhotoModal);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !photoModal.hidden) {
    hidePhotoModal();
  }
});

const DB_NAME = "alisson-xv-gallery";
const PHOTO_STORE = "photos";
const WISH_STORE = "wishes";
const DB_VERSION = 2;

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
const logoutButton = document.querySelector("#logoutButton");

let selectedFiles = [];
document.body.dataset.activeView = "home";
let currentGuest = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(WISH_STORE)) {
        db.createObjectStore(WISH_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = callback(store);

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll(storeName) {
  return withStore(storeName, "readonly", (store) => requestToPromise(store.getAll()));
}

function saveItem(storeName, item) {
  return withStore(storeName, "readwrite", (store) => store.put(item));
}

function deletePhoto(id) {
  return withStore(PHOTO_STORE, "readwrite", (store) => store.delete(id));
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
  document.body.classList.remove("is-logged-in");
  delete document.body.dataset.userRole;
  document.body.dataset.activeView = "home";
  loginView.hidden = false;
  loginForm.reset();
  resetUploadForm();
  wishName.value = "";
  viewPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.viewPanel === "home");
  });
  viewButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === "home");
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
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
  modalPhoto.src = photo.dataUrl;
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
  img.src = photo.dataUrl;
  img.alt = photo.message
    ? `Foto subida por ${photo.name}: ${photo.message}`
    : `Foto subida por ${photo.name}`;
  name.textContent = photo.message || "Gracias por compartir este momento.";
  message.textContent = `Escrito por ${photo.name}`;
  likeCount.textContent = photo.likes || 0;

  photoFrame.addEventListener("click", () => openPhotoModal(photo));

  likeButton.addEventListener("click", async () => {
    await saveItem(PHOTO_STORE, { ...photo, likes: (photo.likes || 0) + 1 });
    await loadEverything();
  });

  deleteButton.hidden = currentGuest?.role !== "admin";
  deleteButton.addEventListener("click", async () => {
    await deletePhoto(photo.id);
    await loadEverything();
  });

  return card;
}

function renderGallery(photos, wishes) {
  const sortedPhotos = [...photos].sort((a, b) => b.createdAt - a.createdAt);
  galleryGrid.innerHTML = "";
  emptyState.hidden = photos.length > 0;

  sortedPhotos.forEach((photo, index) => {
    galleryGrid.append(buildPhotoCard(photo, index));
  });

  const photoMessages = photos.filter((photo) => photo.message && photo.message.trim()).length;
  memoryCount.textContent = photos.length + wishes.length;
  photoCount.textContent = photos.length;
  messageCount.textContent = photoMessages + wishes.length;
}

function renderWishes(wishes) {
  wishGrid.innerHTML = "";
  wishEmpty.hidden = wishes.length > 0;

  [...wishes]
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((wish) => {
      const card = wishTemplate.content.firstElementChild.cloneNode(true);
      card.querySelector("p").textContent = `"${wish.text}"`;
      card.querySelector("strong").textContent = `Con cariño, ${wish.name}`;
      wishGrid.append(card);
    });
}

async function loadEverything() {
  const [photos, wishes] = await Promise.all([getAll(PHOTO_STORE), getAll(WISH_STORE)]);
  renderGallery(photos, wishes);
  renderWishes(wishes);
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
    musicButton.textContent = "Ⅱ";
  } catch {
    musicButton.textContent = "♪";
  }
}

viewButtons.forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

musicButton.addEventListener("click", toggleMusic);
logoutButton.addEventListener("click", logoutGuest);
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

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const firstName = loginFirstName.value.trim();
  const lastName = loginLastName.value.trim();
  if (!firstName || !lastName) return;

  const guest = {
    firstName,
    lastName,
    role: getGuestRole(firstName, lastName),
  };

  applyGuestSession(guest);
  loadEverything().catch(() => {
    setStatus("No se pudo cargar la galería en este navegador.");
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedFiles.length) {
    setStatus("Primero elige una o varias fotos.");
    return;
  }

  const name = guestName.value.trim() || "Invitado especial";
  const message = guestMessage.value.trim();

  setStatus("Guardando recuerdos...");

  for (const file of selectedFiles) {
    const dataUrl = await fileToDataUrl(file);
    await saveItem(PHOTO_STORE, {
      id: crypto.randomUUID(),
      dataUrl,
      name,
      message,
      likes: 0,
      fileName: file.name,
      createdAt: Date.now(),
    });
  }

  await loadEverything();
  resetUploadForm();
  showView("gallery");
});

wishForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = wishText.value.trim();
  if (!text) return;

  await saveItem(WISH_STORE, {
    id: crypto.randomUUID(),
    name: wishName.value.trim() || "Invitado especial",
    text,
    createdAt: Date.now(),
  });

  wishText.value = "";
  await loadEverything();
});

closePhotoModal.addEventListener("click", hidePhotoModal);
photoModalBackdrop.addEventListener("click", hidePhotoModal);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !photoModal.hidden) {
    hidePhotoModal();
  }
});

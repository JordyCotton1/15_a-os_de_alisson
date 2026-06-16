const DB_NAME = "alisson-xv-gallery";
const PHOTO_STORE = "photos";
const WISH_STORE = "wishes";
const DB_VERSION = 2;

const uploadSection = document.querySelector("#compartir");
const shareButton = document.querySelector("#shareButton");
const form = document.querySelector("#uploadForm");
const input = document.querySelector("#photoInput");
const dropZone = document.querySelector("#dropZone");
const guestName = document.querySelector("#guestName");
const guestMessage = document.querySelector("#guestMessage");
const statusMessage = document.querySelector("#statusMessage");
const galleryGrid = document.querySelector("#galleryGrid");
const previewStrip = document.querySelector("#previewStrip");
const emptyState = document.querySelector("#emptyState");
const clearGallery = document.querySelector("#clearGallery");
const template = document.querySelector("#photoCardTemplate");
const memoryCount = document.querySelector("#memoryCount");
const photoCount = document.querySelector("#photoCount");
const messageCount = document.querySelector("#messageCount");
const favoriteSpot = document.querySelector("#favoriteSpot");
const favoriteCard = document.querySelector("#favoriteCard");
const wishForm = document.querySelector("#wishForm");
const wishName = document.querySelector("#wishName");
const wishText = document.querySelector("#wishText");
const wishGrid = document.querySelector("#wishGrid");
const wishEmpty = document.querySelector("#wishEmpty");
const wishTemplate = document.querySelector("#wishTemplate");
const musicButton = document.querySelector("#musicButton");
const eventMusic = document.querySelector("#eventMusic");

let selectedFiles = [];

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

function clearPhotos() {
  return withStore(PHOTO_STORE, "readwrite", (store) => store.clear());
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

function showUploadSection() {
  uploadSection.hidden = false;
  uploadSection.scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus("Elige tus fotos y escribe un mensaje para Alisson.");
}

function hideUploadSection() {
  uploadSection.hidden = true;
  selectedFiles = [];
  input.value = "";
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

function buildPhotoCard(photo, index = 0) {
  const card = template.content.firstElementChild.cloneNode(true);
  const img = card.querySelector("img");
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
  name.textContent = `Escrito por ${photo.name}`;
  message.textContent = photo.message || "Gracias por compartir este momento.";
  likeCount.textContent = photo.likes || 0;

  likeButton.addEventListener("click", async () => {
    await saveItem(PHOTO_STORE, { ...photo, likes: (photo.likes || 0) + 1 });
    await loadEverything();
  });

  deleteButton.addEventListener("click", async () => {
    await deletePhoto(photo.id);
    await loadEverything();
  });

  return card;
}

function renderFavorite(photos) {
  const favorite = photos
    .filter((photo) => photo.likes > 0)
    .sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt)[0];

  favoriteCard.innerHTML = "";
  favoriteSpot.hidden = !favorite;
  if (!favorite) return;

  favoriteCard.append(buildPhotoCard(favorite, 0));
}

function renderGallery(photos, wishes) {
  const sortedPhotos = [...photos].sort((a, b) => b.createdAt - a.createdAt);
  galleryGrid.innerHTML = "";
  emptyState.hidden = photos.length > 0;
  clearGallery.hidden = photos.length === 0;

  sortedPhotos.forEach((photo, index) => {
    galleryGrid.append(buildPhotoCard(photo, index));
  });

  const photoMessages = photos.filter((photo) => photo.message && photo.message.trim()).length;
  memoryCount.textContent = photos.length + wishes.length;
  photoCount.textContent = photos.length;
  messageCount.textContent = photoMessages + wishes.length;
  renderFavorite(photos);
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
    musicButton.innerHTML = "&#127925; Ma Belle Evangeline";
    return;
  }

  try {
    await eventMusic.play();
    musicButton.textContent = "Pausar canción";
  } catch {
    musicButton.textContent = "Activa el sonido";
  }
}

shareButton.addEventListener("click", showUploadSection);
musicButton.addEventListener("click", toggleMusic);
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
  hideUploadSection();
  document.querySelector("#galleryTitle").scrollIntoView({ behavior: "smooth", block: "start" });
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

clearGallery.addEventListener("click", async () => {
  const shouldClear = confirm("¿Quieres borrar todas las fotos guardadas en este navegador?");
  if (!shouldClear) return;

  await clearPhotos();
  await loadEverything();
});

loadEverything().catch(() => {
  if (!uploadSection.hidden) {
    setStatus("No se pudo cargar la galería en este navegador.");
  }
});

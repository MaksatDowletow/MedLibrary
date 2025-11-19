(function initOfflineInstaller() {
  const downloadButton = document.getElementById("offline-download-button");
  const statusElement = document.getElementById("offline-download-status");

  if (!downloadButton || !statusElement) {
    return;
  }

  const ZIP_FLAG_UTF8 = 0x0800;
  const ZIP_VERSION = 20;

  const setStatus = (key, replacements = {}, state) => {
    statusElement.classList.remove("success", "error", "pending");
    if (state) {
      statusElement.classList.add(state);
    }

    if (typeof window.setElementTranslation === "function") {
      window.setElementTranslation(statusElement, key, replacements);
      return;
    }

    if (typeof window.translate === "function") {
      statusElement.textContent = window.translate(key, replacements);
      return;
    }

    statusElement.textContent = replacements?.message || "";
  };

  const getManifestAssets = () => {
    if (!Array.isArray(window.MEDLIBRARY_OFFLINE_ASSETS)) {
      return [];
    }

    const normalized = window.MEDLIBRARY_OFFLINE_ASSETS.filter(
      (asset) => typeof asset === "string" && !asset.includes("downloads/medlibrary-offline.zip")
    );

    return Array.from(new Set(normalized));
  };

  const normalizeAssetPath = (asset) => {
    if (!asset) {
      return null;
    }

    const withoutOrigin = asset.replace(window.location.origin, "");
    const trimmed = withoutOrigin.replace(/^\/+/, "");

    if (!trimmed || trimmed === "MedLibrary" || trimmed === "MedLibrary/") {
      return "MedLibrary/index.html";
    }

    if (trimmed.startsWith("MedLibrary/")) {
      return trimmed;
    }

    return `MedLibrary/${trimmed}`;
  };

  const buildZipBlob = (files) => {
    const encoder = new TextEncoder();
    const fileRecords = [];
    const chunks = [];
    let offset = 0;

    files.forEach(({ name, data }) => {
      const nameBytes = encoder.encode(name);
      const fileBytes = new Uint8Array(data);
      const crc = calculateCrc32(fileBytes);
      const { date, time } = getDosDateTime();

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(localHeader.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, ZIP_VERSION, true);
      localView.setUint16(6, ZIP_FLAG_UTF8, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, time, true);
      localView.setUint16(12, date, true);
      localView.setUint32(14, crc >>> 0, true);
      localView.setUint32(18, fileBytes.length, true);
      localView.setUint32(22, fileBytes.length, true);
      localView.setUint16(26, nameBytes.length, true);
      localView.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      chunks.push(localHeader, fileBytes);
      fileRecords.push({
        nameBytes,
        crc,
        size: fileBytes.length,
        offset,
        date,
        time,
      });
      offset += localHeader.length + fileBytes.length;
    });

    const centralChunks = [];
    fileRecords.forEach((record) => {
      const centralHeader = new Uint8Array(46 + record.nameBytes.length);
      const centralView = new DataView(centralHeader.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, (3 << 8) | ZIP_VERSION, true);
      centralView.setUint16(6, ZIP_FLAG_UTF8, true);
      centralView.setUint16(8, 0, true);
      centralView.setUint16(10, record.time, true);
      centralView.setUint16(12, record.date, true);
      centralView.setUint32(14, record.crc >>> 0, true);
      centralView.setUint32(18, record.size, true);
      centralView.setUint32(22, record.size, true);
      centralView.setUint16(26, record.nameBytes.length, true);
      centralView.setUint16(28, 0, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, record.offset, true);
      centralHeader.set(record.nameBytes, 46);
      centralChunks.push(centralHeader);
    });

    const centralSize = centralChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const centralOffset = offset;

    const endOfCentralDir = new Uint8Array(22);
    const endView = new DataView(endOfCentralDir.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, fileRecords.length, true);
    endView.setUint16(10, fileRecords.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, centralOffset, true);
    endView.setUint16(20, 0, true);

    return new Blob([...chunks, ...centralChunks, endOfCentralDir], {
      type: "application/zip",
    });
  };

  const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let code = i;
      for (let j = 0; j < 8; j += 1) {
        code = code & 1 ? 0xedb88320 ^ (code >>> 1) : code >>> 1;
      }
      table[i] = code >>> 0;
    }
    return table;
  })();

  const calculateCrc32 = (bytes) => {
    let crc = -1;
    for (let i = 0; i < bytes.length; i += 1) {
      const byte = bytes[i];
      crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ -1) >>> 0;
  };

  const getDosDateTime = () => {
    const now = new Date();
    const year = Math.max(now.getFullYear(), 1980);
    const dosYear = year - 1980;
    const dosMonth = now.getMonth() + 1;
    const dosDay = now.getDate();
    const dosHours = now.getHours();
    const dosMinutes = now.getMinutes();
    const dosSeconds = Math.floor(now.getSeconds() / 2);

    return {
      date: (dosYear << 9) | (dosMonth << 5) | dosDay,
      time: (dosHours << 11) | (dosMinutes << 5) | dosSeconds,
    };
  };

  const downloadArchive = async () => {
    const manifestAssets = getManifestAssets();

    if (!manifestAssets.length) {
      setStatus("offlineMissingAssets", {}, "error");
      return;
    }

    downloadButton.disabled = true;
    setStatus("offlinePreparing", {}, "pending");

    const files = [];
    const seenFiles = new Set();

    try {
      for (let index = 0; index < manifestAssets.length; index += 1) {
        const asset = manifestAssets[index];
        const normalizedPath = normalizeAssetPath(asset);
        if (!normalizedPath || seenFiles.has(normalizedPath)) {
          continue;
        }

        setStatus(
          "offlineProgress",
          { current: index + 1, total: manifestAssets.length },
          "pending"
        );

        const response = await fetch(asset, { cache: "no-cache" });
        if (!response.ok) {
          throw new Error(`Не удалось загрузить ${asset}`);
        }

        const buffer = await response.arrayBuffer();
        files.push({ name: normalizedPath, data: buffer });
        seenFiles.add(normalizedPath);
      }

      if (!files.length) {
        setStatus("offlineMissingAssets", {}, "error");
        downloadButton.disabled = false;
        return;
      }

      const archiveBlob = buildZipBlob(files);
      const blobUrl = URL.createObjectURL(archiveBlob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = "medlibrary-offline.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      setStatus("offlineReady", {}, "success");
    } catch (error) {
      console.error("Failed to build offline archive", error);
      setStatus("offlineError", {}, "error");
    } finally {
      downloadButton.disabled = false;
    }
  };

  downloadButton.addEventListener("click", downloadArchive);
})();

// Creates a standardized JSON success response with the given data and a timestamp.
// Logs response creation for debugging.
function createSuccessResponse(data) {
  console.log('[FicTracker] Success response created');
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    data: data,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// Creates a standardized JSON error response with the given error message and a timestamp.
// Logs error response creation for debugging.
function createErrorResponse(message) {
  console.log(`[FicTracker] Error response created: ${message}`);
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: message,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// Attempts to acquire a script lock for concurrency control with a 5-second timeout.
// Logs success or failure and returns the lock object or false if unavailable.
function acquireLock() {
  const lock = LockService.getScriptLock();
  const LOCK_TIMEOUT = 5000; // 5s timeout

  try {
    const lockAcquired = lock.tryLock(LOCK_TIMEOUT);

    if (lockAcquired) {
      console.log('[FicTracker] Lock acquired.');
      return lock;
    } else {
      console.warn('[FicTracker] Operation aborted — could not acquire lock.');
      return false;
    }
  } catch (e) {
    console.error('[FicTracker] Error acquiring lock: ' + e.message);
    return false;
  }
}

// Releases a previously acquired script lock, if held.
// Logs success or any errors encountered during release.
function releaseLock(lock) {
  if (lock && lock.hasLock()) {
    try {
      lock.releaseLock();
      console.log('[FicTracker] Lock released.');
    } catch (e) {
      console.error('[FicTracker] Error releasing lock: ' + e.message);
    }
  } else {
    console.warn('[FicTracker] No lock to release or not held.');
  }
}

// Compresses a JavaScript object to a GZIP-compressed, base64-encoded string
// for efficient network transfer/storage.
function gzipPack(data) {
  const json = JSON.stringify(data);
  const gzippedBlob = Utilities.gzip(Utilities.newBlob(json, "application/x-gzip", "data.gz"));
  const base64 = Utilities.base64Encode(gzippedBlob.getBytes());
  return base64;
}

// Decompresses a base64-encoded GZIP string back to the original JavaScript object.
function gzipUnpack(data) {
    const compressedBytes = Utilities.base64Decode(data);
    const compressedBlob = Utilities.newBlob(compressedBytes, "application/x-gzip", "data.gz");
    const decompressed = Utilities.ungzip(compressedBlob).getDataAsString();
    const json = JSON.parse(decompressed);

    return json;
}

// Compresses a comma-separated string of numbers into a compact binary format,
// then applies GZIP compression and base64 encoding.
// Skips compression if disabled in configuration.
// Logs compression stats (original vs compressed size and ratio).
function compressTextBGzip(rawText) {

    // skip compression unless configured 
    if (!get_config()['_compress_statuses_BGzip']) return rawText;

    // Parse numbers
    const numbers = rawText.split(',').filter(n => n.trim()).map(n => parseInt(n.trim()));
    
    // Create simple binary format
    const buffer = new ArrayBuffer(4 + numbers.length * 4); // 4 bytes for count + 4 bytes per number
    const view = new DataView(buffer);
    
    // Write count
    view.setUint32(0, numbers.length, true); // little-endian
    
    // Write numbers
    for (let i = 0; i < numbers.length; i++) {
      view.setUint32(4 + i * 4, numbers[i], true);
    }

    // GZIP compress
    const blob = Utilities.newBlob(new Uint8Array(buffer));
    const compressed = Utilities.gzip(blob);
    const base64 = Utilities.base64Encode(compressed.getBytes());

    console.log(`Binary+GZIP: ${rawText.length} → ${base64.length}`);
    const ratioPercent = ((base64.length / rawText.length) * 100).toFixed(2);
    console.log(`Compression ratio: ${ratioPercent}%`);

    return base64;
}

// Decompresses a base64-encoded GZIP binary string back into the original comma-separated numbers string.
// Skips decompression if disabled in configuration.
// Logs decompression success.
function decompressTextBGzip(compressedText) {

    // skip decompression unless configured 
    if (!get_config()['_compress_statuses_BGzip']) return compressedText;

    const base64 = compressedText;

    // Decompress
    const compressedBytes = Utilities.base64Decode(base64);

    const compressedBlob = Utilities.newBlob(compressedBytes, "application/x-gzip", "data.gz");
    const decompressed = Utilities.ungzip(compressedBlob);
    const buffer = decompressed.getBytes();
    
    // Create DataView for reading
    const arrayBuffer = new ArrayBuffer(buffer.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < buffer.length; i++) {
      uint8Array[i] = buffer[i] & 0xFF;
    }
    
    const view = new DataView(arrayBuffer);
    
    // Read count
    const count = view.getUint32(0, true);
    
    // Read numbers
    const numbers = [];
    for (let i = 0; i < count; i++) {
      numbers.push(view.getUint32(4 + i * 4, true));
    }
    
    const result = numbers.join(',') + ',';
    console.log(`Simple decompression successful!`);
    return result;
}

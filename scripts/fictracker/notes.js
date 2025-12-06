const NOTES_SHEET_NAME = 'UserNotes';
const CELL_LIMIT = 50000;

// Returns the Google Sheet object for storing user notes ("UserNotes" sheet).
function getUserNotesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(NOTES_SHEET_NAME);
}

// Retrieves and merges all JSON note chunks from the UserNotes sheet (column B),
// returning a combined object containing all user notes.
function getAllNotesData() {
  const sheet = getUserNotesSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return {};
  
  const data = sheet.getRange(1, 2, lastRow, 1).getValues(); // Column B only
  let combined = {};
  
  data.forEach(row => {
    if (row[0]) {
      const obj = JSON.parse(row[0]);
      combined = { ...combined, ...obj };
    }
  });
  
  return combined;
}

// Saves the provided notes object to the UserNotes sheet,
// chunking the data into multiple rows if it exceeds the cell size limit.
function saveNotesData(notesObj) {
  const sheet = getUserNotesSheet();
  sheet.clear();
  
  const jsonStr = JSON.stringify(notesObj);
  
  if (jsonStr.length <= CELL_LIMIT) {
    sheet.getRange(1, 1, 1, 2).setValues([['chunk1', jsonStr]]);
  } else {
    const chunks = chunkObject(notesObj);
    const values = chunks.map((chunk, index) => [`chunk${index + 1}`, JSON.stringify(chunk)]);
    sheet.getRange(1, 1, values.length, 2).setValues(values);
  }
}

// Helper function to split a large notes object into smaller chunks,
// each fitting within the cell size limit to avoid exceeding spreadsheet constraints.
function chunkObject(obj) {
  const chunks = [];
  let currentChunk = {};
  let currentSize = 2;
  
  Object.entries(obj).forEach(([key, value]) => {
    const entrySize = JSON.stringify({ [key]: value }).length - 2;
    
    if (currentSize + entrySize > CELL_LIMIT - 100) { // -100 buffer
      chunks.push(currentChunk);
      currentChunk = {};
      currentSize = 2;
    }
    
    currentChunk[key] = value;
    currentSize += entrySize + 1;
  });
  
  if (Object.keys(currentChunk).length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Returns the note object associated with a specific fanfic ID, or null if not found.
function getNote(fanficId) {
  const allNotes = getAllNotesData();
  return allNotes[fanficId] || null;
}

// Processes a batch of note updates (additions, modifications, deletions) with concurrency lock,
// updates the UserNotes sheet accordingly, updates last modified timestamp,
// and returns a success or error result.
function batchManageNotes(updates) {
  let lock = null;

  try {
    lock = acquireLock();

    if (!lock) {
      return createErrorResponse('Operation currently in progress. Please try again.');
    }

    const allNotes = getAllNotesData();
    
    updates.forEach(update => {
      const { fanficId, text, date } = update;
      const existedBefore = allNotes.hasOwnProperty(fanficId);
      
      if (!text) {
        delete allNotes[fanficId];
        //results.push({ fanficId, success: true, action: 'deleted' });
      } else {
        allNotes[fanficId] = {
          text: text,
          date
        };
      }
    });
    
    saveNotesData(allNotes);
    // SpreadsheetApp.flush();

    updateLastModified();

    return { success: true };

  } catch (err) {
    console.error(err);
    return { success: false, error: err.toString() };

  } finally {
    releaseLock(lock);
  }
}

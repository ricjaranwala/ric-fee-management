// === Google Drive Data API for RIC Fee Management ===

// ==== CONFIGURATION ====
const GDRIVE_CLIENT_ID = '184115433426-thhmtq5qnib47o6j8flieh4m1copb2cs.apps.googleusercontent.com';
const GDRIVE_API_KEY = 'AIzaSyAFVyyL-yoJJUyXHZTOzJq-xCpBpJBtfl8';
const GDRIVE_DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const GDRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
const GDRIVE_FILENAME = 'ric_fee_management_data.json';

let gDriveFileId = null;
let gDriveUser = null;
let gapiInitialized = false;
let isSignedIn = false;

// All app data here (in-memory)
let gAppData = {
    students: [],
    payments: [],
    financials: []
};

// ====== Google Drive Auth/Init ======
function gDriveLoadClient(callback) {
    if (window.gapi && window.gapi.load) {
        window.gapi.load('client:auth2', async () => {
            await gapi.client.init({
                apiKey: GDRIVE_API_KEY,
                clientId: GDRIVE_CLIENT_ID,
                discoveryDocs: GDRIVE_DISCOVERY_DOCS,
                scope: GDRIVE_SCOPES
            });
            gapiInitialized = true;
            window.GoogleAuth = gapi.auth2.getAuthInstance();
            window.GoogleAuth.isSignedIn.listen(gDriveUpdateSigninStatus);
            gDriveUpdateSigninStatus(window.GoogleAuth.isSignedIn.get());
            if (callback) callback();
        });
    }
}

function gDriveSignIn() {
    if (gapiInitialized) window.GoogleAuth.signIn();
}
function gDriveSignOut() {
    if (gapiInitialized) window.GoogleAuth.signOut();
}

function gDriveUpdateSigninStatus(status) {
    isSignedIn = status;
    if (status) {
        gDriveUser = window.GoogleAuth.currentUser.get().getBasicProfile();
        if (typeof onGDriveSignIn === "function") onGDriveSignIn();
    } else {
        gDriveUser = null;
        if (typeof onGDriveSignOut === "function") onGDriveSignOut();
    }
}

// ====== File Handling ======
async function gDriveGetOrCreateFile() {
    const result = await gapi.client.drive.files.list({
        q: `name='${GDRIVE_FILENAME}' and trashed=false`,
        fields: 'files(id, name)'
    });
    if (result.result.files && result.result.files.length > 0) {
        gDriveFileId = result.result.files[0].id;
        return gDriveFileId;
    }
    // Not found: create
    const meta = { name: GDRIVE_FILENAME, mimeType: 'application/json' };
    const newFile = await gapi.client.drive.files.create({ resource: meta, fields: 'id' });
    gDriveFileId = newFile.result.id;
    await gDriveSaveData(gAppData); // Save empty
    return gDriveFileId;
}

async function gDriveLoadData() {
    await gDriveGetOrCreateFile();
    const file = await gapi.client.drive.files.get({ fileId: gDriveFileId, alt: 'media' });
    try {
        gAppData = JSON.parse(file.body);
    } catch {
        gAppData = { students: [], payments: [], financials: [] };
    }
    return gAppData;
}

async function gDriveSaveData(newData = null) {
    if (newData) gAppData = newData;
    if (!gDriveFileId) await gDriveGetOrCreateFile();

    // Multipart upload
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
    const contentType = 'application/json';
    const meta = { name: GDRIVE_FILENAME, mimeType: contentType };

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(meta) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n\r\n' +
        JSON.stringify(gAppData) +
        close_delim;

    return gapi.client.request({
        path: '/upload/drive/v3/files/' + gDriveFileId,
        method: 'PATCH',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
        body: multipartRequestBody
    });
}

// ====== Helper: Use These In Your App ======
// Call this to load data after Google sign-in
async function gDriveAppLoadAll() {
    await gDriveLoadData();
    if (typeof onGDriveDataLoaded === "function") onGDriveDataLoaded(gAppData);
}

// Call this after any change to students/payments/financials
async function gDriveAppSaveAll() {
    await gDriveSaveData();
}

window.gDriveLoadClient = gDriveLoadClient;
window.gDriveSignIn = gDriveSignIn;
window.gDriveSignOut = gDriveSignOut;
window.gDriveAppLoadAll = gDriveAppLoadAll;
window.gDriveAppSaveAll = gDriveAppSaveAll;
window.gAppData = gAppData;
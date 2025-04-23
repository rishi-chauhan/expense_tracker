// filepath: /home/rrsc/git/expense_tracker/expenseTracker/src/utils/googleDriveUtils.js
import { gapi } from 'gapi-script';

const FOLDER_NAME = "Expense Tracker";

/**
 * Finds or creates a folder named "Expense Tracker" in the user's Google Drive.
 * @returns {Promise<string>} The ID of the folder.
 */
async function findOrCreateFolder() {
  let folderId = null;

  try {
    // 1. Search for the folder
    const response = await gapi.client.drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (response.result.files && response.result.files.length > 0) {
      folderId = response.result.files[0].id;
      console.log(`Found folder '${FOLDER_NAME}' with ID: ${folderId}`);
    } else {
      // 2. Create the folder if it doesn't exist
      console.log(`Folder '${FOLDER_NAME}' not found, creating...`);
      const fileMetadata = {
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      };
      const createResponse = await gapi.client.drive.files.create({
        resource: fileMetadata,
        fields: 'id',
      });
      folderId = createResponse.result.id;
      console.log(`Created folder '${FOLDER_NAME}' with ID: ${folderId}`);
    }
    return folderId;
  } catch (error) {
    console.error('Error finding or creating Google Drive folder:', error);
    throw new Error(`Failed to find or create folder '${FOLDER_NAME}': ${error.result?.error?.message || error.message}`);
  }
}

/**
 * Saves the extracted transaction data as a JSON file to Google Drive.
 * @param {string} bankName - The identified bank name (e.g., "HDFC", "ICICI").
 * @param {Array<Array<string|number>>} transactions - The array of transaction rows (amount should be number).
 * @param {Array<string>} headers - The array of standard headers ("Date", "Description", "Amount").
 * @param {string} accessToken - The user's Google OAuth access token.
 * @returns {Promise<object>} The result from the Google Drive API file creation.
 */
export async function saveToGoogleDrive(bankName, transactions, headers, accessToken) {
  if (!bankName) {
      throw new Error("Bank name is required to save the file.");
  }
  if (!transactions || transactions.length === 0) {
    throw new Error("No transaction data to save.");
  }
  if (!accessToken) {
     throw new Error("User not authenticated with Google.");
  }

  // Ensure GAPI client is loaded and ready
  if (!gapi.client || !gapi.client.drive) {
     // This might happen if GoogleAuth hasn't fully initialized
     // Attempt to load drive client if missing (though ideally it's loaded during auth)
     try {
       await gapi.client.load('drive', 'v3');
       console.log("Drive API client loaded dynamically.");
     } catch (loadError) {
        console.error("Failed to load Drive API client:", loadError);
        throw new Error("Google Drive API client is not available.");
     }
  }

  try {
    const folderId = await findOrCreateFolder();

    // Prepare the JSON data
    const jsonData = {
      bankName: bankName,
      headers: headers,
      transactions: transactions.map(row => {
         // Convert row array to object based on headers for better structure
         let transactionObj = {};
         headers.forEach((header, index) => {
            transactionObj[header] = row[index];
         });
         return transactionObj;
      }),
      savedAt: new Date().toISOString(),
    };
    const fileContent = JSON.stringify(jsonData, null, 2); // Pretty print JSON
    const blob = new Blob([fileContent], { type: 'application/json' });

    // Create file metadata
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `expenses_${bankName}_${timestamp}.json`;
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/json',
    };

    // Use multipart upload for content
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
    form.append('file', blob);

    console.log(`Attempting to save file '${fileName}' to folder ID: ${folderId}`);

    // Execute the file creation request
    const response = await gapi.client.request({
      path: '/upload/drive/v3/files',
      method: 'POST',
      params: { uploadType: 'multipart' },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // Content-Type is set automatically by FormData
      },
      body: form,
    });

    console.log('File saved successfully:', response.result);
    return response.result; // Contains file ID, name etc.

  } catch (error) {
    console.error('Error saving file to Google Drive:', error);
    // Provide more specific error feedback if possible
    const errorDetails = error.result?.error?.message || error.message || 'Unknown error';
    if (error.result?.error?.code === 403) {
        throw new Error(`Permission denied. Ensure the application has 'drive.file' scope permission. Details: ${errorDetails}`);
    } else if (error.result?.error?.code === 404 && errorDetails.includes('File not found')) {
        throw new Error(`The target folder might have been deleted or access revoked. Details: ${errorDetails}`);
    }
    throw new Error(`Failed to save file to Google Drive: ${errorDetails}`);
  }
}

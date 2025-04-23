// filepath: /home/rrsc/git/expense_tracker/expenseTracker/src/components/GoogleAuth/GoogleAuth.jsx
import { useState, useEffect, useCallback } from 'react';
import { gapi } from 'gapi-script';

// Replace with your actual Google Cloud Client ID
const CLIENT_ID = 'YOUR_GOOGLE_CLOUD_CLIENT_ID.apps.googleusercontent.com';
const API_KEY = 'YOUR_GOOGLE_API_KEY'; // If needed for specific API calls, not usually for Drive file creation
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
// Scopes required for creating files in Drive
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

function GoogleAuth({ onAuthChange }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);

  const updateSigninStatus = useCallback((signedIn) => {
    setIsSignedIn(signedIn);
    if (signedIn) {
      const currentProfile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
      const userProfile = {
        id: currentProfile.getId(),
        name: currentProfile.getName(),
        email: currentProfile.getEmail(),
        imageUrl: currentProfile.getImageUrl(),
      };
      setProfile(userProfile);
      setError(null);
      onAuthChange(true, userProfile, gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token);
    } else {
      setProfile(null);
      setError(null);
      onAuthChange(false, null, null);
    }
  }, [onAuthChange]);

  useEffect(() => {
    const initClient = () => {
      gapi.client.init({
        // apiKey: API_KEY, // Usually not needed just for auth and drive.file scope
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES,
      }).then(() => {
        console.log('GAPI client initialized.');
        setIsGapiLoaded(true);
        // Listen for sign-in state changes.
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        // Handle the initial sign-in state.
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
      }).catch(err => {
        console.error("Error initializing GAPI client:", err);
        setError(`Failed to initialize Google Sign-In: ${err.details || err.error || 'Unknown error'}. Check console and ensure Client ID is correct and API is enabled.`);
        onAuthChange(false, null, null); // Notify parent component of failure
      });
    };

    const start = () => {
      console.log('Loading GAPI script...');
      gapi.load('client:auth2', initClient);
    };

    // Load the GAPI script
    if (typeof gapi !== 'undefined') {
       start();
    } else {
       console.error("gapi script not loaded yet.");
       // Attempt to load manually if needed, though gapi-script should handle this
       // Consider adding a script tag dynamically or ensuring gapi-script loads first
       setError("Google API script failed to load. Check network or script setup.");
    }

    // Cleanup listener on component unmount
    return () => {
      try {
        if (gapi && gapi.auth2 && gapi.auth2.getAuthInstance()) {
          const authInstance = gapi.auth2.getAuthInstance();
          // Check if the listener function exists before trying to remove it
          if (authInstance && typeof authInstance.isSignedIn.listen === 'function' && typeof updateSigninStatus === 'function') {
             // This might cause issues if the instance/listener isn't stable.
             // Consider managing the listener reference more directly if problems arise.
             // authInstance.isSignedIn.off('signInStatusChanged', updateSigninStatus); // Example if using named listeners
          }
        }
      } catch (e) {
        console.warn("Error during GAPI cleanup:", e);
      }
    };
  }, [updateSigninStatus, onAuthChange]); // Added onAuthChange to dependency array

  const handleSignInClick = () => {
    if (!isGapiLoaded) {
       setError("Google API client not ready yet.");
       return;
    }
    gapi.auth2.getAuthInstance().signIn().catch(err => {
       console.error("Sign-in error:", err);
       setError(`Sign-in failed: ${err.error || 'Popup closed or error occurred'}.`);
    });
  };

  const handleSignOutClick = () => {
     if (!isGapiLoaded) {
       setError("Google API client not ready yet.");
       return;
    }
    gapi.auth2.getAuthInstance().signOut().catch(err => {
       console.error("Sign-out error:", err);
       setError("Sign-out failed.");
    });
  };

  return (
    <div style={{ margin: '20px 0', padding: '10px', border: '1px solid #ccc', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {!isGapiLoaded && !error && <p>Loading Google Sign-In...</p>}
      {isGapiLoaded && !error && (
        isSignedIn ? (
          <div>
            <p>Signed in as: {profile?.name} ({profile?.email})</p>
            {profile?.imageUrl && <img src={profile.imageUrl} alt="User profile" style={{ width: '30px', height: '30px', borderRadius: '50%' }} />}
            <button onClick={handleSignOutClick} style={{ marginLeft: '10px' }}>Sign Out</button>
          </div>
        ) : (
          <button onClick={handleSignInClick}>Sign In with Google</button>
        )
      )}
       <p style={{ fontSize: '0.7em', color: '#666', marginTop: '5px' }}>
         Required to save data to your Google Drive.
       </p>
    </div>
  );
}

export default GoogleAuth;

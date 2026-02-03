# Firebase Security Rules

## Firestore Rules

Copy these rules to your Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // Profiles subcollection
      match /profiles/{profileId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## Storage Rules

Copy these rules to your Firebase Console → Storage → Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Users can read/write their own files
    match /users/{userId}/{allPaths=**} {
      allow read: if true;  // Public read for logos
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Firebase Console Setup Checklist

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com
   - Create new project (or use existing)

2. **Enable Authentication**
   - Authentication → Sign-in method
   - Enable "Google" provider
   - Enable "Email/Password" provider

3. **Create Firestore Database**
   - Firestore Database → Create database
   - Start in test mode initially
   - Add the security rules above

4. **Enable Storage**
   - Storage → Get started
   - Add the security rules above

5. **Get Config Values**
   - Project Settings (gear icon) → Your apps
   - Add a web app if none exists
   - Copy the config values to your `.env` file

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

## GitHub Actions / Deployment

Add these secrets to your GitHub repository:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Then update your build workflow to inject them as environment variables.

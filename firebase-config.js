(function () {
  'use strict';
  var firebaseConfig = {
    apiKey: "AIzaSyC6XWnbq6QEg4DjldVKvoafbe9dtZdyLqI",
    authDomain: "karive-catalogo.firebaseapp.com",
    projectId: "karive-catalogo",
    storageBucket: "karive-catalogo.firebasestorage.app",
    messagingSenderId: "262475026396",
    appId: "1:262475026396:web:34ee4bf36dbebdcc468919"
  };
  firebase.initializeApp(firebaseConfig);
  window.kvDb = firebase.firestore();
  if (typeof firebase.auth === 'function') { window.kvAuth = firebase.auth(); }
})();

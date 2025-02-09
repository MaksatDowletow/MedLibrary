import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDoN-tRd3jwS66R2ebjAX3q8Kpcujva7xI",
  authDomain: "https://maksatdowletow.github.io/MedLibrary/auth.html",
  projectId: "medlib-8eafc",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Регистрация пользователя
document.getElementById("register").addEventListener("click", () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  createUserWithEmailAndPassword(auth, email, password)
    .then(() => alert("Регистрация успешна!"))
    .catch(error => alert(error.message));
});

// Авторизация пользователя
document.getElementById("login").addEventListener("click", () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  signInWithEmailAndPassword(auth, email, password)
    .then(() => alert("Вход выполнен!"))
    .catch(error => alert(error.message));
});

// Выход пользователя
document.getElementById("logout").addEventListener("click", () => {
  signOut(auth).then(() => alert("Вы вышли из системы"));
});

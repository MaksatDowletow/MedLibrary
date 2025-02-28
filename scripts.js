document.addEventListener('DOMContentLoaded', () => {
  const languageSelect = document.getElementById('language-select');
  if (languageSelect) {
    languageSelect.addEventListener('change', changeLanguage);
    // Изначально установим русский язык
    changeLanguage();
  }

  function changeLanguage() {
    const lang = languageSelect ? languageSelect.value : 'ru';
    const elements = document.querySelectorAll('.lang');
    elements.forEach(element => {
      element.style.display = element.getAttribute('data-lang') === lang ? 'block' : 'none';
    });
  }

  // Инициализация слайд-шоу
  let slideIndex = 0;
  showSlides();

  function showSlides() {
    const slides = document.getElementsByClassName("slide");
    if (slides.length > 0) {
      Array.from(slides).forEach(slide => {
        slide.style.display = "none";
      });
      slideIndex++;
      if (slideIndex > slides.length) { slideIndex = 1; }
      slides[slideIndex - 1].style.display = "block";
      setTimeout(showSlides, 10000); // Change image every 10 seconds
    }
  }
document.addEventListener("DOMContentLoaded", function() {
  // Ваш код регистрации
  const scriptURL = "https://script.google.com/macros/s/AKfycbzCUVMuM1EtBLG--X58nFfJiQkqCxxtF2hYs86L-YzW0XmUxC6XUTxtfqliLG7BGOvI/exec";

  function register() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    if (!username || !password) {
      alert("Пожалуйста, заполните все поля!");
      return;
    }

    fetch(scriptURL, {
      method: "POST",
      body: JSON.stringify({ action: "register", username, password }),
      headers: { "Content-Type": "application/json" }
    })
    .then(res => res.text())
    .then(data => {
      alert(data);
      location.reload();  // Перезагрузка страницы
    })
    .catch(error => console.error("Error:", error));
  }

  // Привязываем обработчик события к кнопке
  const registerButton = document.getElementById("register");
  if (registerButton) {
    registerButton.addEventListener("click", register);
  }
});


// Отправка сообщения на email
function sendMail() {
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const message = document.getElementById('message').value;
  const subject = "Новое сообщение от " + name;
  const body = "Имя: " + name + "%0D%0AEmail: " + email + "%0D%0AСообщение: " + message;
  window.location.href = "mailto:tdlipfmdm@gmail.com?subject=" + subject + "&body=" + body;
}

// Проверка и добавление обработчиков событий
document.getElementById("register")?.addEventListener("click", register);
document.getElementById("login")?.addEventListener("click", login);

// Проверка пользователя после загрузки страницы
checkUser();

  // Поиск на странице
  function searchOnPage() {
    const searchText = document.getElementById('searchInput').value;
    const elements = document.getElementsByTagName('p');

    Array.from(elements).forEach(element => {
      const text = element.innerHTML;
      const replacedText = text.replace(new RegExp(searchText, 'gi'), '<span class="highlight">$&</span>');
      element.innerHTML = replacedText;
    });
  }

  document.getElementById("sendMail")?.addEventListener("click", sendMail);
  document.getElementById("searchButton")?.addEventListener("click", searchOnPage);
});

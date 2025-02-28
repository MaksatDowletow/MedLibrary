document.addEventListener('DOMContentLoaded', () => {
  const languageSelect = document.getElementById('language-select');
  languageSelect.addEventListener('change', changeLanguage);

  // Изначально установим русский язык
  changeLanguage();

  function changeLanguage() {
    const lang = languageSelect.value;
    const elements = document.querySelectorAll('.lang');
    elements.forEach(element => {
      element.style.display = element.getAttribute('data-lang') === lang ? 'block' : 'none';
    });
  }

  // Инициализация слайд-шоу
  let slideIndex = 0;
  showSlides();

  function showSlides() {
    let i;
    let slides = document.getElementsByClassName("slide");
    for (i = 0; i < slides.length; i++) {
      slides[i].style.display = "none";  
    }
    slideIndex++;
    if (slideIndex > slides.length) {slideIndex = 1}    
    slides[slideIndex-1].style.display = "block";  
    setTimeout(showSlides, 10000); // Change image every 10 seconds
  }

  // Регистрация
const scriptURL = "https://script.google.com/macros/s/AKfycbzCUVMuM1EtBLG--X58nFfJiQkqCxxtF2hYs86L-YzW0XmUxC6XUTxtfqliLG7BGOvI/exec";  // Вставьте сюда ваш Web App URL

function register() {
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;

    if (!username || !password) {
        alert("Maglumatlary doly giriziň!");
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
    })
    .catch(error => console.error("Error:", error));
}

function login() {
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;

    fetch(scriptURL, {
        method: "POST",
        body: JSON.stringify({ action: "login", username, password }),
        headers: { "Content-Type": "application/json" }
    })
    .then(res => res.text())
    .then(data => {
        if (data === "Login Success") {
            localStorage.setItem("loggedInUser", username);
            alert("Giriş Üstünlikli!");
            location.reload();
        } else {
            alert("Ulanyjy ady ýa-da açar söz nädogry!");
        }
    })
    .catch(error => console.error("Error:", error));
}

function checkUser() {
    let user = localStorage.getItem("loggedInUser");
    if (user) {
        document.getElementById("auth").innerHTML = `<h2>Hoş geldiňiz, ${user}!</h2>
            <button onclick="logout()">Çykyş</button>`;
    }
}

function logout() {
    localStorage.removeItem("loggedInUser");
    location.reload();
}

document.addEventListener("DOMContentLoaded", checkUser);


  // Отправка сообщения на email
  function sendMail() {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;
    const subject = "Новое сообщение от " + name;
    const body = "Имя: " + name + "%0D%0AEmail: " + email + "%0D%0AСообщение: " + message;
    window.location.href = "mailto:tdlipfmdm@gmail.com?subject=" + subject + "&body=" + body;
  }

  // Поиск на странице
  function searchOnPage() {
    var searchText = document.getElementById('searchInput').value;
    var elements = document.getElementsByTagName('p');

    for (var i = 0; i < elements.length; i++) {
      var text = elements[i].innerHTML;
      var replacedText = text.replace(new RegExp(searchText, 'gi'), '<span class="highlight">$&</span>');
      elements[i].innerHTML = replacedText;
    }
  }
});

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
});
let slideIndex = 0;

// Логика слайдера
let slideIndex = 1;
showSlides(slideIndex);

function plusSlides(n) {
  showSlides(slideIndex += n);
}

function showSlides(n) {
  let i;
  const slides = document.querySelectorAll('.slide');
  if (n > slides.length) { slideIndex = 1 }
  if (n < 1) { slideIndex = slides.length }
  slides.forEach(slide => slide.style.display = 'none');
  slides[slideIndex - 1].style.display = 'block';
}

function sendMail() {
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const message = document.getElementById('message').value;
  const subject = "Новое сообщение от " + name;
  const body = "Имя: " + name + "%0D%0AEmail: " + email + "%0D%0AСообщение: " + message;
  window.location.href = "mailto:tdlipfmdm@gmail.com?subject=" + subject + "&body=" + body;
}

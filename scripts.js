document.addEventListener('DOMContentLoaded', () => {
  const languageSelect = document.getElementById('language-select');
  languageSelect.addEventListener('change', changeLanguage);

  // Изначально установим русский язык
  changeLanguage();

  function changeLanguage() {
    const lang = languageSelect.value;
    const elements = document.querySelectorAll('.lang');
    elements.forEach(element => {
      element.hidden = element.getAttribute('data-lang') !== lang;
    });
  }
});

// Логика слайдера
let slideIndex = 1;
showSlides(slideIndex);

function plusSlides(n) {
  showSlides(slideIndex += n);
}

function showSlides(n) {
  let i;
  const slides = document.querySelectorAll('.slide');
  if (n > slides.length) {slideIndex = 1}
  if (n < 1) {slideIndex = slides.length}
  slides.forEach(slide => slide.style.display = 'none');
  slides[slideIndex-1].style.display = 'block';
}

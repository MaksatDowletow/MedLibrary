function sendMail() {
  var name = document.getElementById('name').value;
  var email = document.getElementById('email').value;
  var message = document.getElementById('message').value;
  var subject = "Новое сообщение от " + name;
  var body = "Имя: " + name + "%0D%0AEmail: " + email + "%0D%0AСообщение: " + message;
  window.location.href = "mailto:tdlipfmdm@gmail.com?subject=" + subject + "&body=" + body;
}

let slideIndex = 0;
showSlides();

function showSlides() {
  let slides = document.getElementsByClassName("slide");
  for (let i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";  
  }
  slideIndex++;
  if (slideIndex > slides.length) {slideIndex = 1}    
  slides[slideIndex-1].style.display = "block";  
  setTimeout(showSlides, 10000); // Change image every 5 seconds
}

function plusSlides(n) {
  showSlides(slideIndex += n);
}

function setLanguage(lang) {
  document.querySelectorAll('[data-lang]').forEach(element => {
    if (element.dataset.lang === lang) {
      element.hidden = false;
    } else {
      element.hidden = true;
    }
  });
}

// Установить язык по умолчанию (например, русский)
setLanguage('tm');

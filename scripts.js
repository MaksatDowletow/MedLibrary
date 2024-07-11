function sendMail() {
  var name = document.getElementById('name').value;
  var email = document.getElementById('email').value;
  var message = document.getElementById('message').value;
  var subject = "Новое сообщение от " + name;
  var body = "Имя: " + name + "%0D%0AEmail: " + email + "%0D%0AСообщение: " + message;
  window.location.href = "mailto:tdlipfmdm@gmail.com?subject=" + subject + "&body=" + body;
}

let slideIndex = 1;
showSlides(slideIndex);

function plusSlides(n) {
  showSlides(slideIndex += n);
}

function currentSlide(n) {
  showSlides(slideIndex = n);
}

function showSlides(n) {
  let slides = document.getElementsByClassName("slide");
  if (n > slides.length) {slideIndex = 1}    
  if (n < 1) {slideIndex = slides.length}
  for (let i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";  
  }
  slides[slideIndex-1].style.display = "block";  
}

function setLanguage(language) {
  document.querySelectorAll('[data-lang]').forEach(element => {
    element.hidden = element.getAttribute('data-lang') !== language;
  });
}

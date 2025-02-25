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

    function plusSlides(n) {
      showSlides(slideIndex += n);
    }

    function currentSlide(n) {
      showSlides(slideIndex = n);
    }

    document.addEventListener('DOMContentLoaded', (event) => {
      showSlides(slideIndex);
    });

function sendMail() {
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const message = document.getElementById('message').value;
  const subject = "Новое сообщение от " + name;
  const body = "Имя: " + name + "%0D%0AEmail: " + email + "%0D%0AСообщение: " + message;
  window.location.href = "mailto:tdlipfmdm@gmail.com?subject=" + subject + "&body=" + body;
}
function searchOnPage() {
  var searchText = document.getElementById('searchInput').value;
  var elements = document.getElementsByTagName('p');

  for (var i = 0; i < elements.length; i++) {
    var text = elements[i].innerHTML;
    var replacedText = text.replace(new RegExp(searchText, 'gi'), '<span class="highlight">$&</span>');
    elements[i].innerHTML = replacedText;
  }
}
document.getElementById("register").addEventListener("click", () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  createUserWithEmailAndPassword(auth, email, password)
    .then(() => alert("Регистрация успешна!"))
    .catch(error => alert(error.message));
});

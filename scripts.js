document.addEventListener('DOMContentLoaded', () => 
    {
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
      languageSelect.addEventListener('change', changeLanguage);
     
      changeLanguage();
    }
  
    function changeLanguage() {
      const lang = languageSelect ? languageSelect.value : 'ru';
      const elements = document.querySelectorAll('.lang');
      elements.forEach(element => {
        element.style.display = element.getAttribute('data-lang') === lang ? 'block' : 'none';
      });
    }
  
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

    const scriptURL = "https://script.google.com/macros/s/AKfycbzCUVMuM1EtBLG--X58nFfJiQkqCxxtF2hYs86L-YzW0XmUxC6XUTxtfqliLG7BGOvI/exec";
  
    function register() {
      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;
  
      if (!username || !password) {
        alert('Пожалуйста, заполните все поля!');
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
        location.reload();  
      })
      .catch(error => console.error("Error:", error));
    }
  
  
    const registerButton = document.getElementById("register");
    if (registerButton) {
      registerButton.addEventListener("click", register);
    }
  });
  
  
  
  function sendMail() {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;
    const subject = "Новое сообщение от " + name;
    const body = "Имя: " + name + "%0D%0AEmail: " + email + "%0D%0AСообщение: " + message;
    window.location.href = "mailto:tdlipfmdm@gmail.com?subject=" + subject + "&body=" + body;
  }
  

  document.getElementById("register")?.addEventListener("click", register);
  document.getElementById("login")?.addEventListener("click", login);
  
  document.getElementById('searchInput').addEventListener('input', function() {
    var input, filter, table, tr, td, i, txtValue1, txtValue2;
    input = document.getElementById('searchInput');
    filter = input.value.toUpperCase();
    table = document.querySelector('table tbody');
    tr = table.getElementsByTagName('tr');
  
    for (i = 0; i < tr.length; i++) {
      td = tr[i].getElementsByTagName('td');
      if (td.length > 0) {
        txtValue1 = td[0].textContent || td[0].innerText;
        txtValue2 = td[1].textContent || td[1].innerText;
  
        if (txtValue1.toUpperCase().indexOf(filter) > -1 || txtValue2.toUpperCase().indexOf(filter) > -1) {
          tr[i].style.display = "";
        } else {
          tr[i].style.display = "none";
        }
      }
    }
  })})
// Функция для фильтрации таблицы
      function filterTable() {
        var input = document.getElementById("search-input");
        var filter = input.value.toLowerCase();
        var table = document.getElementById("book-table");
        var tr = table.getElementsByTagName("tr");
        
        for (var i = 1; i < tr.length; i++) {
          tr[i].style.display = "none";
          var td = tr[i].getElementsByTagName("td");
          for (var j = 0; j < td.length; j++) {
            if (td[j] && td[j].innerHTML.toLowerCase().indexOf(filter) > -1) {
              tr[i].style.display = "";
              break;
            }
          }
        }
      }

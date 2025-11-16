document.addEventListener("DOMContentLoaded", () => {
  const languageSelect = document.getElementById("language-select");
  if (languageSelect) {
    languageSelect.addEventListener("change", changeLanguage);
    changeLanguage();
  }

  function changeLanguage() {
    const lang = languageSelect ? languageSelect.value : "ru";
    document.querySelectorAll(".lang").forEach((element) => {
      element.style.display =
        element.getAttribute("data-lang") === lang ? "block" : "none";
    });
  }

  let slideIndex = 0;
  function showSlides() {
    const slides = document.getElementsByClassName("slide");
    if (slides.length === 0) {
      return;
    }

    Array.from(slides).forEach((slide) => {
      slide.style.display = "none";
    });
    slideIndex = (slideIndex % slides.length) + 1;
    slides[slideIndex - 1].style.display = "block";
    setTimeout(showSlides, 10000); // Change image every 10 seconds
  }
  showSlides();

  const registrationForm = document.getElementById("register-form");
  if (registrationForm) {
    const emailInput = document.getElementById("register-email");
    const passwordInput = document.getElementById("register-password");
    const confirmInput = document.getElementById("register-confirm");
    const statusElement = document.getElementById("register-status");
    const registerButton = document.getElementById("register-button");
    const apiBase = (document.body?.dataset.apiBase || "").replace(/\/$/, "");
    const registerEndpoint = `${apiBase || ""}/register`;

    const updateStatus = (message, state) => {
      if (!statusElement) {
        return;
      }
      statusElement.textContent = message;
      statusElement.classList.remove("success", "error", "pending");
      if (state) {
        statusElement.classList.add(state);
      }
    };

    const setButtonState = (disabled) => {
      if (registerButton) {
        registerButton.disabled = disabled;
      }
    };

    const isEmailValid = (email) => /.+@.+\..+/.test(email);

    const submitRegistration = () => {
      if (!emailInput || !passwordInput || !confirmInput) {
        return;
      }

      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      const confirmPassword = confirmInput.value.trim();

      if (!isEmailValid(email)) {
        updateStatus("Введите корректный email", "error");
        return;
      }

      if (password.length < 6) {
        updateStatus("Пароль должен содержать минимум 6 символов", "error");
        return;
      }

      if (password !== confirmPassword) {
        updateStatus("Пароли не совпадают", "error");
        return;
      }

      updateStatus("Создаем аккаунт...", "pending");
      setButtonState(true);

      fetch(registerEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Не удалось зарегистрировать пользователя");
          }
          return response.json();
        })
        .then((data) => {
          updateStatus(data.message || "Регистрация прошла успешно", "success");
          registrationForm.reset();
        })
        .catch((error) => {
          updateStatus(error.message || "Ошибка при регистрации", "error");
        })
        .finally(() => {
          setButtonState(false);
        });
    };

    registrationForm.addEventListener("submit", (event) => {
      event.preventDefault();
      submitRegistration();
    });

    if (registerButton) {
      registerButton.addEventListener("click", (event) => {
        event.preventDefault();
        submitRegistration();
      });
    }
  }

  window.sendMail = () => {
    const name = document.getElementById("name");
    const email = document.getElementById("email");
    const message = document.getElementById("message");

    if (!name || !email || !message) {
      return;
    }

    const subject = `Новое сообщение от ${name.value}`;
    const body =
      "Имя: " +
      name.value +
      "%0D%0AEmail: " +
      email.value +
      "%0D%0AСообщение: " +
      message.value;
    window.location.href =
      "mailto:tdlipfmdm@gmail.com?subject=" + subject + "&body=" + body;
  };

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const filter = searchInput.value.toUpperCase();
      const table = document.querySelector("#book-table tbody");
      if (!table) {
        return;
      }

      const rows = table.getElementsByTagName("tr");
      for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].getElementsByTagName("td");
        if (cells.length === 0) {
          continue;
        }

        const bookTitle = cells[0].textContent || cells[0].innerText;
        const author = cells[1].textContent || cells[1].innerText;
        if (
          bookTitle.toUpperCase().indexOf(filter) > -1 ||
          author.toUpperCase().indexOf(filter) > -1
        ) {
          rows[i].style.display = "";
        } else {
          rows[i].style.display = "none";
        }
      }
    });
  }

  const bookTableBody = document.querySelector("#book-table tbody");
  if (bookTableBody) {
    if (typeof XLSX === "undefined") {
      console.error("XLSX library is not loaded");
      return;
    }

    fetch("Book.xls")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok " + response.statusText);
        }
        return response.arrayBuffer();
      })
      .then((data) => {
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        bookTableBody.innerHTML = "";
        jsonData.slice(0, 1400).forEach((row) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td>${row["Название книги"] || ""}</td>
                          <td>${row["Имя автора"] || ""}</td>
                          <td>${row["Издатель"] || ""}</td>
                          <td>${row["Город публикации"] || ""}</td>
                          <td>${row["Год публикации"] || ""}</td>
                          <td>${row["Количество страниц"] || ""}</td>
                          <td>${row["Язык книги"] || ""}</td>`;
          bookTableBody.appendChild(tr);
        });
      })
      .catch((error) => console.error("Error:", error));
  }
});

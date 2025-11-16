document.addEventListener("DOMContentLoaded", () => {
  const languageSelect = document.getElementById("language-select");
  const i18nMap = {
    bookTitle: {
      ru: "Название книги",
      tm: "Kitabyň ady",
      en: "Book Title",
    },
    authorName: {
      ru: "Имя автора",
      tm: "Awtor",
      en: "Author",
    },
    publisher: {
      ru: "Издатель",
      tm: "Neşirçi",
      en: "Publisher",
    },
    city: {
      ru: "Город публикации",
      tm: "Neşir edilen şäher",
      en: "City",
    },
    year: {
      ru: "Год публикации",
      tm: "Neşir edilen ýyl",
      en: "Year",
    },
    pages: {
      ru: "Количество страниц",
      tm: "Sahypa sany",
      en: "Pages",
    },
    language: {
      ru: "Язык книги",
      tm: "Kitabyň dili",
      en: "Language",
    },
    bookTitlePlaceholder: {
      ru: "Поиск по названию",
      tm: "Ady boýunça gözleg",
      en: "Search by title",
    },
    authorNamePlaceholder: {
      ru: "Поиск по автору",
      tm: "Awtor boýunça gözleg",
      en: "Search by author",
    },
    publisherPlaceholder: {
      ru: "Поиск по издателю",
      tm: "Neşirçi boýunça gözleg",
      en: "Search by publisher",
    },
    cityPlaceholder: {
      ru: "Поиск по городу",
      tm: "Şäher boýunça gözleg",
      en: "Search by city",
    },
    yearPlaceholder: {
      ru: "Поиск по году",
      tm: "Ýyl boýunça gözleg",
      en: "Search by year",
    },
    pagesPlaceholder: {
      ru: "Поиск по страницам",
      tm: "Sahypa boýunça gözleg",
      en: "Search by pages",
    },
    languagePlaceholder: {
      ru: "Поиск по языку",
      tm: "Dil boýunça gözleg",
      en: "Search by language",
    },
  };

  if (languageSelect) {
    languageSelect.addEventListener("change", changeLanguage);
    changeLanguage();
  } else {
    updateI18nContent("ru");
  }

  function changeLanguage() {
    const lang = languageSelect ? languageSelect.value : "ru";
    const elements = document.querySelectorAll(".lang");
    elements.forEach((element) => {
      element.style.display =
        element.getAttribute("data-lang") === lang ? "block" : "none";
    });
    updateI18nContent(lang);
  }

  function updateI18nContent(lang) {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      if (i18nMap[key]?.[lang]) {
        element.textContent = i18nMap[key][lang];
      }
    });

    document
      .querySelectorAll("[data-placeholder-i18n]")
      .forEach((input) => {
        const key = input.dataset.placeholderI18n;
        if (i18nMap[key]?.[lang]) {
          input.placeholder = i18nMap[key][lang];
          input.setAttribute("aria-label", i18nMap[key][lang]);
        }
      });
  }

  let slideIndex = 0;
  showSlides();

  function showSlides() {
    const slides = document.getElementsByClassName("slide");
    if (slides.length > 0) {
      Array.from(slides).forEach((slide) => {
        slide.style.display = "none";
      });
      slideIndex++;
      if (slideIndex > slides.length) {
        slideIndex = 1;
      }
      slides[slideIndex - 1].style.display = "block";
      setTimeout(showSlides, 10000); // Change image every 10 seconds
    }
  }

  const scriptURL =
    "https://script.google.com/macros/s/AKfycbzCUVMuM1EtBLG--X58nFfJiQkqCxxtF2hYs86L-YzW0XmUxC6XUTxtfqliLG7BGOvI/exec";

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
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.text())
      .then((data) => {
        alert(data);
        location.reload();
      })
      .catch((error) => console.error("Error:", error));
  }

  const registerElement = document.getElementById("register");
  if (registerElement) {
    registerElement.addEventListener("click", register);
  }

  if (typeof login === "function") {
    const loginElement = document.getElementById("login");
    loginElement?.addEventListener("click", login);
  }

  function sendMail() {
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const message = document.getElementById("message").value;
    const subject = "Новое сообщение от " + name;
    const body =
      "Имя: " + name + "%0D%0AEmail: " + email + "%0D%0AСообщение: " + message;
    window.location.href =
      "mailto:tdlipfmdm@gmail.com?subject=" + subject + "&body=" + body;
  }

  const columnSearchInputs = document.querySelectorAll(".column-search");

  function buildColumnFilters() {
    return Array.from(columnSearchInputs).reduce((filters, input) => {
      const columnIndex = Number(input.dataset.column);
      const value = input.value.trim().toUpperCase();
      if (!Number.isNaN(columnIndex) && value) {
        filters[columnIndex] = value;
      }
      return filters;
    }, {});
  }

  function filterByColumns() {
    if (!columnSearchInputs.length) return;

    const filters = buildColumnFilters();
    const rows = document.querySelectorAll("#book-table tbody tr");

    rows.forEach((row) => {
      const cells = row.getElementsByTagName("td");
      const isVisible = Object.entries(filters).every(([index, filter]) => {
        const cellText = (cells[index]?.textContent || "").toUpperCase();
        return cellText.includes(filter);
      });
      row.style.display = isVisible ? "" : "none";
    });
  }

  if (columnSearchInputs.length) {
    columnSearchInputs.forEach((input) => {
      input.addEventListener("input", filterByColumns);
    });
  }

  fetch("Book.xls")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok " + response.statusText);
      }
      return response.arrayBuffer();
    })
    .then((data) => {
      var workbook = XLSX.read(data, { type: "array" });
      var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      var jsonData = XLSX.utils.sheet_to_json(firstSheet);
      var tbody = document.querySelector("#book-table tbody");
      tbody.innerHTML = "";
      jsonData.slice(0, 1400).forEach(function (row) {
        var tr = document.createElement("tr");
        tr.innerHTML = `<td>${row["Название книги"]}</td>
                          <td>${row["Имя автора"]}</td>
                          <td>${row["Издатель"]}</td>
                          <td>${row["Город публикации"]}</td>
                          <td>${row["Год публикации"]}</td>
                          <td>${row["Количество страниц"]}</td>
                          <td>${row["Язык книги"]}</td>`;
        tbody.appendChild(tr);
      });
      filterByColumns();
    })
    .catch((error) => console.error("Error:", error));
});

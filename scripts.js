const TOKEN_KEY = "medlibraryToken";
const LOCAL_USERS_KEY = "medlibraryLocalUsers";
const LOCAL_SESSION_KEY = "medlibraryLocalSession";
const BOOK_TABLE_COLUMNS = [
  "Название книги",
  "Имя автора",
  "Издатель",
  "Город публикации",
  "Год публикации",
  "Количество страниц",
  "Язык книги",
];

const UI_TEXTS = {
  tableLoading: {
    ru: "Загружаем каталог...",
    en: "Loading catalog...",
    tm: "Katalogy ýükleýäris...",
  },
  tableEmpty: {
    ru: "Каталог пуст",
    en: "Catalog is empty",
    tm: "Katalog boş",
  },
  tableShown: {
    ru: "Показаны {count} записей",
    en: "Showing {count} entries",
    tm: "{count} ýazgy görkezildi",
  },
  tableFetchError: {
    ru: "Не удалось загрузить каталог. Попробуйте позже.",
    en: "Unable to load the catalog. Please try again later.",
    tm: "Katalogy ýüklemek başartmady. Soňrak synanyşyň.",
  },
  tableUnavailable: {
    ru: "Библиотека недоступна",
    en: "Catalog is unavailable",
    tm: "Katalog elýeterli däl",
  },
  statusNone: {
    ru: "Ничего не найдено",
    en: "Nothing found",
    tm: "Hiç zat tapylmady",
  },
  statusShownAll: {
    ru: "Показаны {count} записей",
    en: "Showing {count} entries",
    tm: "{count} ýazgy görkezildi",
  },
  statusFound: {
    ru: "Найдено {count} из {total} записей",
    en: "Found {count} of {total} entries",
    tm: "{total} ýazgydan {count} tapyldy",
  },
  cardUseFilters: {
    ru: "Воспользуйтесь фильтрами, чтобы увидеть карточки найденных книг.",
    en: "Use the filters to see cards of the matched books.",
    tm: "Tapylan kitaplaryň kartlaryny görmek üçin filtrleri ulanyň.",
  },
  cardEmpty: {
    ru: "По заданным параметрам ничего не найдено.",
    en: "Nothing matches your filters.",
    tm: "Saýlanan filtrler boýunça hiç zat tapylmady.",
  },
  cardUntitled: {
    ru: "Без названия",
    en: "Untitled",
    tm: "Ady ýok",
  },
  cardAuthor: {
    ru: "Автор",
    en: "Author",
    tm: "Awtor",
  },
  cardPublisher: {
    ru: "Издатель",
    en: "Publisher",
    tm: "Neşirçi",
  },
  cardCity: {
    ru: "Город",
    en: "City",
    tm: "Şäher",
  },
  cardYear: {
    ru: "Год",
    en: "Year",
    tm: "Ýyl",
  },
  cardPages: {
    ru: "Страниц",
    en: "Pages",
    tm: "Sahypalar",
  },
};

const bookSearchState = {
  tableBody: null,
  statusElement: null,
  cardContainer: null,
  isTableReady: false,
  totalRows: 0,
  filters: {
    global: "",
    columns: BOOK_TABLE_COLUMNS.map(() => ""),
  },
};

document.addEventListener("DOMContentLoaded", () => {
  const apiBase = resolveApiBase(document.body?.dataset.apiBase);
  if (document.body) {
    document.body.dataset.apiBase = apiBase;
  }

  initLanguageSwitcher();
  initGallerySlider();
  initAuthTabs();
  initRegistrationForm(apiBase);
  const refreshSession = initLoginForm(apiBase) || (() => {});
  initFederatedLogin(apiBase, refreshSession);
  initSearchFilter();
  initColumnSearchFilters();
  initBookTable();
});

function initLanguageSwitcher() {
  const languageSelect = document.getElementById("language-select");
  if (!languageSelect) {
    return;
  }

  const documentLang = document.documentElement.dataset.lang || document.documentElement.lang;
  if (documentLang && languageSelect.value !== documentLang) {
    const optionExists = Array.from(languageSelect.options).some((option) => option.value === documentLang);
    if (optionExists) {
      languageSelect.value = documentLang;
    }
  }

  const changeLanguage = () => {
    const lang = languageSelect.value || documentLang || "ru";
    document.documentElement.dataset.lang = lang;
    document.documentElement.lang = lang;
    document.querySelectorAll(".lang").forEach((element) => {
      const isVisible = element.getAttribute("data-lang") === lang;
      element.hidden = !isVisible;
      element.setAttribute("aria-hidden", isVisible ? "false" : "true");
      if (isVisible) {
        element.style.removeProperty("display");
      }
    });
    updatePlaceholders(lang);
    document
      .querySelectorAll("[data-i18n-key]")
      .forEach((element) => translateElement(element));
    if (bookSearchState.isTableReady) {
      applyBookFilters();
    }
  };

  languageSelect.addEventListener("change", changeLanguage);
  changeLanguage();
}

function initGallerySlider() {
  const slider = document.querySelector(".gallery-slider");
  if (!slider) {
    return;
  }

  const slides = slider.querySelectorAll(".slide");
  if (!slides.length) {
    return;
  }

  let currentSlide = 0;
  let timerId = null;
  const slideInterval = 10000;

  const renderSlides = () => {
    slides.forEach((slide, index) => {
      const isActive = index === currentSlide;
      slide.style.display = isActive ? "block" : "none";
      slide.setAttribute("aria-hidden", isActive ? "false" : "true");
    });
  };

  const goToSlide = (targetIndex) => {
    currentSlide = (targetIndex + slides.length) % slides.length;
    renderSlides();
  };

  const nextSlide = () => goToSlide(currentSlide + 1);
  const prevSlide = () => goToSlide(currentSlide - 1);

  const restartTimer = () => {
    if (timerId) {
      clearInterval(timerId);
    }
    timerId = window.setInterval(nextSlide, slideInterval);
  };

  slider.querySelector(".next")?.addEventListener("click", () => {
    nextSlide();
    restartTimer();
  });

  slider.querySelector(".prev")?.addEventListener("click", () => {
    prevSlide();
    restartTimer();
  });

  renderSlides();
  restartTimer();
}

function initAuthTabs() {
  const tabs = document.querySelectorAll(".auth-tab");
  if (!tabs.length) {
    return;
  }

  const panels = document.querySelectorAll(".auth-panel");

  const activateTab = (targetId) => {
    tabs.forEach((tab) => {
      const isActive = tab.dataset.target === targetId;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    panels.forEach((panel) => {
      const isTarget = panel.id === targetId;
      panel.classList.toggle("is-active", isTarget);
      panel.hidden = !isTarget;
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTab(tab.dataset.target);
    });
  });

  const initialTab =
    Array.from(tabs).find((tab) => tab.classList.contains("active"))?.dataset
      .target || tabs[0].dataset.target;
  activateTab(initialTab);
}

function initRegistrationForm(apiBase) {
  const form = document.getElementById("register-form");
  if (!form) {
    return;
  }

  const emailInput = document.getElementById("register-email");
  const passwordInput = document.getElementById("register-password");
  const confirmInput = document.getElementById("register-confirm");
  const statusElement = document.getElementById("register-status");
  const registerButton = document.getElementById("register-button");
  const registerEndpoint = buildEndpoint(apiBase, "/register");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!emailInput || !passwordInput || !confirmInput) {
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const confirmPassword = confirmInput.value.trim();

    if (!isEmailValid(email)) {
      setStatusMessage(statusElement, "Введите корректный email", "error");
      return;
    }

    if (password.length < 6) {
      setStatusMessage(
        statusElement,
        "Пароль должен содержать минимум 6 символов",
        "error"
      );
      return;
    }

    if (password !== confirmPassword) {
      setStatusMessage(statusElement, "Пароли не совпадают", "error");
      return;
    }

    setStatusMessage(statusElement, "Создаем аккаунт...", "pending");
    toggleDisabled(registerButton, true);

    try {
      const data = await apiRequest(registerEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setStatusMessage(
        statusElement,
        data?.message || "Регистрация прошла успешно",
        "success"
      );
      clearLocalSession();
      form.reset();
      document.getElementById("login-tab")?.click();
    } catch (error) {
      if (isNetworkError(error)) {
        try {
          const { message } = await registerLocalUser(email, password);
          setStatusMessage(statusElement, message, "success");
          form.reset();
          document.getElementById("login-tab")?.click();
        } catch (fallbackError) {
          setStatusMessage(statusElement, fallbackError.message, "error");
        }
      } else {
        setStatusMessage(
          statusElement,
          error?.message || "Ошибка при регистрации",
          "error"
        );
      }
    } finally {
      toggleDisabled(registerButton, false);
    }
  });
}

function initLoginForm(apiBase) {
  const form = document.getElementById("login-form");
  if (!form) {
    return null;
  }

  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const statusElement = document.getElementById("login-status");
  const loginButton = document.getElementById("login-button");
  const logoutButton = document.getElementById("logout-button");
  const sessionStatus = document.getElementById("auth-session-status");
  const loginEndpoint = buildEndpoint(apiBase, "/login");
  const sessionEndpoint = buildEndpoint(apiBase, "/session");

  const refreshSession = async (showLoading = true) => {
    const token = safeGetToken();
    const localSession = loadLocalSession();

    if (!token && localSession) {
      renderLocalSession(sessionStatus, logoutButton, localSession);
      return;
    }

    if (!token) {
      setStatusMessage(sessionStatus, "Вы не авторизованы", null);
      if (logoutButton) {
        logoutButton.hidden = true;
      }
      return;
    }

    if (showLoading) {
      setStatusMessage(sessionStatus, "Проверяем сессию...", "pending");
    }

    try {
      const data = await apiRequest(sessionEndpoint, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const email = data?.user?.email;
      const message = email ? `Вы вошли как ${email}` : "Вы вошли";
      setStatusMessage(sessionStatus, message, "success");
      clearLocalSession();
      if (logoutButton) {
        logoutButton.hidden = false;
      }
    } catch (error) {
      console.error("Не удалось обновить сессию", error);
      if (error?.status === 401) {
        safeRemoveToken();
      }
      if (isNetworkError(error) && localSession) {
        renderLocalSession(sessionStatus, logoutButton, localSession);
        return;
      }
      if (logoutButton) {
        logoutButton.hidden = true;
      }
      setStatusMessage(
        sessionStatus,
        error?.message || "Сессия истекла. Авторизуйтесь снова",
        "error"
      );
    }
  };

  logoutButton?.addEventListener("click", () => {
    safeRemoveToken();
    clearLocalSession();
    setStatusMessage(sessionStatus, "Вы вышли из аккаунта", null);
    if (logoutButton) {
      logoutButton.hidden = true;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!emailInput || !passwordInput) {
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!isEmailValid(email)) {
      setStatusMessage(statusElement, "Введите корректный email", "error");
      return;
    }

    if (password.length < 6) {
      setStatusMessage(
        statusElement,
        "Пароль должен содержать минимум 6 символов",
        "error"
      );
      return;
    }

    setStatusMessage(statusElement, "Входим...", "pending");
    toggleDisabled(loginButton, true);

    try {
      const data = await apiRequest(loginEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const token = data?.token;
      if (token) {
        safeStoreToken(token);
      }
      clearLocalSession();
      setStatusMessage(statusElement, data?.message || "Вход выполнен", "success");
      refreshSession(false);
      form.reset();
    } catch (error) {
      if (isNetworkError(error)) {
        try {
          const { message, session } = await loginLocalUser(email, password);
          setStatusMessage(statusElement, message, "success");
          renderLocalSession(sessionStatus, logoutButton, session);
          form.reset();
        } catch (fallbackError) {
          setStatusMessage(statusElement, fallbackError.message, "error");
        }
      } else {
        setStatusMessage(
          statusElement,
          error?.message || "Ошибка при входе",
          "error"
        );
      }
    } finally {
      toggleDisabled(loginButton, false);
    }
  });

  refreshSession(false);
  return refreshSession;
}

function initFederatedLogin(apiBase, refreshSession = () => {}) {
  const container = document.getElementById("google-signin-button");
  if (!container) {
    return;
  }

  const loginStatus = document.getElementById("login-status");
  const sessionStatus = document.getElementById("auth-session-status");
  const logoutButton = document.getElementById("logout-button");
  const googleClientId = resolveGoogleClientId();

  if (!googleClientId) {
    container.textContent =
      "Укажите GOOGLE_CLIENT_ID и data-google-client-id для включения входа через Google";
    container.classList.add("google-signin-placeholder", "is-error");
    return;
  }

  const googleEndpoint = buildEndpoint(apiBase, "/auth/google");

  const handleCredential = async (credential) => {
    if (!credential) {
      setStatusMessage(
        loginStatus,
        "Не удалось получить credential от Google",
        "error"
      );
      return;
    }

    setStatusMessage(
      loginStatus,
      "Подтверждаем аккаунт Google...",
      "pending"
    );

    try {
      const data = await apiRequest(googleEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      if (data?.token) {
        safeStoreToken(data.token);
      }
      clearLocalSession();
      setStatusMessage(
        loginStatus,
        data?.message || "Вход выполнен через Google",
        "success"
      );
      if (typeof refreshSession === "function") {
        refreshSession(false);
      } else if (sessionStatus) {
        const email = data?.user?.email;
        const message = email
          ? `Вы вошли как ${email}`
          : "Вы вошли через Google";
        setStatusMessage(sessionStatus, message, "success");
        if (logoutButton) {
          logoutButton.hidden = false;
        }
      }
    } catch (error) {
      setStatusMessage(
        loginStatus,
        error?.message || "Не удалось войти через Google",
        "error"
      );
    }
  };

  const renderGoogleButton = () => {
    if (!window.google?.accounts?.id) {
      return false;
    }

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => handleCredential(response.credential),
    });

    window.google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill",
      width: "100%",
    });
    window.google.accounts.id.prompt();
    container.classList.remove("is-error", "is-pending");
    container.textContent = "";
    return true;
  };

  if (!renderGoogleButton()) {
    container.textContent =
      container.dataset.loadingText || "Подключаем Google Identity...";
    container.classList.add("google-signin-placeholder", "is-pending");
    window.addEventListener(
      "load",
      () => {
        renderGoogleButton();
      },
      { once: true }
    );
  }
}

function initSearchFilter() {
  const searchInput = document.getElementById("searchInput");
  const tableBody = document.querySelector("#book-table tbody");
  if (!searchInput || !tableBody) {
    return;
  }

  const clearButton = document.getElementById("clear-search");
  bookSearchState.tableBody = tableBody;
  bookSearchState.statusElement = document.getElementById("book-status");
  bookSearchState.cardContainer = document.getElementById("card-results");

  const debouncedFilter = debounce(() => {
    bookSearchState.filters.global = searchInput.value;
    clearButton?.classList.toggle("is-visible", Boolean(searchInput.value));
    applyBookFilters();
  }, 160);
  searchInput.addEventListener("input", debouncedFilter);

  clearButton?.addEventListener("click", () => {
    if (!searchInput.value) {
      return;
    }
    searchInput.value = "";
    bookSearchState.filters.global = "";
    applyBookFilters();
    searchInput.focus();
  });
}

function initBookTable() {
  const bookTableBody = document.querySelector("#book-table tbody");
  const statusElement = document.getElementById("book-status");
  if (!bookTableBody) {
    return;
  }

  bookSearchState.tableBody = bookTableBody;
  bookSearchState.statusElement = statusElement;
  bookSearchState.cardContainer = document.getElementById("card-results");

  if (typeof XLSX === "undefined") {
    console.error("XLSX library is not loaded");
    if (statusElement) {
      setElementTranslation(statusElement, "tableUnavailable");
      statusElement.dataset.state = "error";
    }
    return;
  }

  const tablePanel = document.querySelector(".table-panel");
  const setTableStatus = (key, state, replacements) => {
    if (!statusElement) {
      return;
    }
    setElementTranslation(statusElement, key, replacements);
    if (state) {
      statusElement.dataset.state = state;
    } else {
      delete statusElement.dataset.state;
    }
  };

  tablePanel?.classList.add("is-loading");
  setTableStatus("tableLoading", "pending");

  const MAX_ROWS = 1400;
  const CHUNK_SIZE = 200;

  const dispatchReady = (totalRows) => {
    bookTableBody.dispatchEvent(
      new CustomEvent("booktable:ready", {
        bubbles: true,
        detail: { totalRows },
      })
    );
  };

  fetch("Book.xlsx")
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
      const rows = jsonData.slice(0, MAX_ROWS).map((row) =>
        BOOK_TABLE_COLUMNS.map((column) => row[column] || "")
      );

      if (!rows.length) {
        tablePanel?.classList.remove("is-loading");
        tablePanel?.classList.add("is-ready");
        bookTableBody.innerHTML = "";
        setTableStatus("tableEmpty", "error");
        dispatchReady(0);
        return;
      }

      bookTableBody.innerHTML = "";
      let startIndex = 0;
      const totalRows = rows.length;

      const renderChunk = () => {
        const fragment = document.createDocumentFragment();
        const limit = Math.min(startIndex + CHUNK_SIZE, totalRows);
        for (let i = startIndex; i < limit; i += 1) {
          const tr = document.createElement("tr");
          rows[i].forEach((cellValue) => {
            const td = document.createElement("td");
            td.textContent = cellValue;
            tr.appendChild(td);
          });
          fragment.appendChild(tr);
        }
        bookTableBody.appendChild(fragment);
        startIndex = limit;
        if (startIndex < totalRows) {
          window.requestAnimationFrame(renderChunk);
        } else {
          tablePanel?.classList.remove("is-loading");
          tablePanel?.classList.add("is-ready");
          setTableStatus("tableShown", "success", { count: totalRows });
          bookSearchState.isTableReady = true;
          bookSearchState.totalRows = totalRows;
          applyBookFilters();
          dispatchReady(totalRows);
        }
      };

      renderChunk();
    })
    .catch((error) => {
      console.error("Error:", error);
      tablePanel?.classList.remove("is-loading");
      tablePanel?.classList.add("is-ready");
      bookTableBody.innerHTML = "";
      setTableStatus("tableFetchError", "error");
    });
}

function initColumnSearchFilters() {
  const filterConfigs = [
    { id: "filter-title", handler: searchByTitle },
    { id: "filter-author", handler: searchByAuthor },
    { id: "filter-publisher", handler: searchByPublisher },
    { id: "filter-city", handler: searchByCity },
    { id: "filter-year", handler: searchByYear },
    { id: "filter-pages", handler: searchByPages },
    { id: "filter-language", handler: searchByLanguage },
  ];

  filterConfigs.forEach(({ id, handler }) => {
    const input = document.getElementById(id);
    if (!input) {
      return;
    }
    const debouncedHandler = debounce(() => handler(input.value), 160);
    input.addEventListener("input", debouncedHandler);
  });
}

function updateColumnFilter(columnIndex, value) {
  if (!bookSearchState.filters.columns?.length) {
    bookSearchState.filters.columns = BOOK_TABLE_COLUMNS.map(() => "");
  }
  bookSearchState.filters.columns[columnIndex] = value || "";
  applyBookFilters();
}

function searchByTitle(value) {
  updateColumnFilter(0, value);
}

function searchByAuthor(value) {
  updateColumnFilter(1, value);
}

function searchByPublisher(value) {
  updateColumnFilter(2, value);
}

function searchByCity(value) {
  updateColumnFilter(3, value);
}

function searchByYear(value) {
  updateColumnFilter(4, value);
}

function searchByPages(value) {
  updateColumnFilter(5, value);
}

function searchByLanguage(value) {
  updateColumnFilter(6, value);
}

function applyBookFilters() {
  const tableBody = bookSearchState.tableBody;
  if (!tableBody || !bookSearchState.isTableReady) {
    return;
  }

  const rows = Array.from(tableBody.rows).filter(
    (row) => !row.classList.contains("skeleton-row")
  );
  const globalFilter = bookSearchState.filters.global.trim().toUpperCase();
  const columnFilters = bookSearchState.filters.columns.map((filter) =>
    (filter || "").trim().toUpperCase()
  );
  const hasActiveColumnFilter = columnFilters.some(Boolean);
  const hasActiveFilter = Boolean(globalFilter || hasActiveColumnFilter);
  let visibleCount = 0;
  const cardEntries = [];

  rows.forEach((row) => {
    const cells = row.getElementsByTagName("td");
    if (!cells.length) {
      return;
    }

    let matches = true;
    if (globalFilter) {
      const bookTitle = cells[0].textContent || "";
      const author = cells[1].textContent || "";
      const composite = `${bookTitle} ${author}`.toUpperCase();
      matches = composite.includes(globalFilter);
    }

    if (matches) {
      for (let i = 0; i < columnFilters.length; i += 1) {
        const filter = columnFilters[i];
        if (filter && !(cells[i]?.textContent || "").toUpperCase().includes(filter)) {
          matches = false;
          break;
        }
      }
    }

    row.style.display = matches ? "" : "none";
    if (matches) {
      visibleCount += 1;
      if (hasActiveFilter) {
        cardEntries.push({
          title: cells[0]?.textContent || "",
          author: cells[1]?.textContent || "",
          publisher: cells[2]?.textContent || "",
          city: cells[3]?.textContent || "",
          year: cells[4]?.textContent || "",
          pages: cells[5]?.textContent || "",
          language: cells[6]?.textContent || "",
        });
      }
    }
  });

  bookSearchState.totalRows = rows.length;
  updateBookStatus(visibleCount);
  renderBookCards(cardEntries, hasActiveFilter);
}

function updateBookStatus(visibleRows) {
  const statusElement = bookSearchState.statusElement;
  if (!statusElement || !bookSearchState.totalRows) {
    return;
  }

  if (!visibleRows) {
    setElementTranslation(statusElement, "statusNone");
    statusElement.dataset.state = "error";
    return;
  }

  const key =
    visibleRows === bookSearchState.totalRows
      ? "statusShownAll"
      : "statusFound";
  setElementTranslation(statusElement, key, {
    count: visibleRows,
    total: bookSearchState.totalRows,
  });
  statusElement.dataset.state = "success";
}

function renderBookCards(entries, hasActiveFilter) {
  const container = bookSearchState.cardContainer;
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!hasActiveFilter) {
    const message = document.createElement("p");
    message.className = "card-results__empty";
    setElementTranslation(message, "cardUseFilters");
    container.appendChild(message);
    return;
  }

  if (!entries.length) {
    const message = document.createElement("p");
    message.className = "card-results__empty";
    setElementTranslation(message, "cardEmpty");
    container.appendChild(message);
    return;
  }

  const fragment = document.createDocumentFragment();
  entries.forEach((entry) => {
    const article = document.createElement("article");
    article.className = "book-card";
    const details = [
      { key: "cardAuthor", value: entry.author },
      { key: "cardPublisher", value: entry.publisher },
      { key: "cardCity", value: entry.city },
      { key: "cardYear", value: entry.year },
      { key: "cardPages", value: entry.pages },
    ]
      .map(
        ({ key, value }) =>
          `<div><dt>${translate(key)}</dt><dd>${value || "—"}</dd></div>`
      )
      .join("");
    article.innerHTML = `
      <div class="book-card__header">
        <h3>${entry.title || translate("cardUntitled")}</h3>
        <span class="book-card__badge">${entry.language || "—"}</span>
      </div>
      <dl class="book-card__details">${details}</dl>`;
    fragment.appendChild(article);
  });

  container.appendChild(fragment);
}

function updatePlaceholders(lang) {
  const langKey = lang.charAt(0).toUpperCase() + lang.slice(1);
  const selector =
    "[data-placeholder-ru], [data-placeholder-en], [data-placeholder-tm]";
  document.querySelectorAll(selector).forEach((input) => {
    const placeholder = input.dataset[`placeholder${langKey}`];
    if (placeholder) {
      input.placeholder = placeholder;
    }
  });
}

function translate(key, replacements = {}) {
  const lang = document.documentElement.dataset.lang || "ru";
  const template = UI_TEXTS[key]?.[lang] || UI_TEXTS[key]?.ru || "";
  return Object.keys(replacements).reduce((acc, currentKey) => {
    return acc.replace(new RegExp(`{${currentKey}}`, "g"), replacements[currentKey]);
  }, template);
}

function translateElement(element) {
  if (!element?.dataset?.i18nKey) {
    return;
  }
  let args = {};
  if (element.dataset.i18nArgs) {
    try {
      args = JSON.parse(element.dataset.i18nArgs);
    } catch (error) {
      console.error("Failed to parse translation arguments", error);
    }
  }
  element.textContent = translate(element.dataset.i18nKey, args);
}

function setElementTranslation(element, key, replacements = {}) {
  if (!element) {
    return;
  }
  element.dataset.i18nKey = key;
  element.dataset.i18nArgs = JSON.stringify(replacements || {});
  translateElement(element);
}

function setStatusMessage(element, message, state) {
  if (!element) {
    return;
  }
  element.textContent = message || "";
  element.classList.remove("success", "error", "pending");
  if (state) {
    element.classList.add(state);
  }
}

function toggleDisabled(button, disabled) {
  if (button) {
    button.disabled = Boolean(disabled);
  }
}

function isEmailValid(email) {
  return /.+@.+\..+/.test(email);
}

function safeStoreToken(token) {
  try {
    window.localStorage?.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error("Не удалось сохранить токен", error);
  }
}

function safeGetToken() {
  try {
    return window.localStorage?.getItem(TOKEN_KEY) || null;
  } catch (error) {
    console.error("Не удалось получить токен", error);
    return null;
  }
}

function safeRemoveToken() {
  try {
    window.localStorage?.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error("Не удалось удалить токен", error);
  }
}

const DEFAULT_REQUEST_TIMEOUT = 10000;

function apiRequest(url, options = {}) {
  const { timeout = DEFAULT_REQUEST_TIMEOUT, headers = {}, ...rest } = options;
  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort(), timeout);

  return fetch(url, {
    ...rest,
    headers: { Accept: "application/json", ...headers },
    signal: controller.signal,
  })
    .then(async (response) => {
      const contentType = response.headers.get("content-type") || "";
      let payload = null;
      if (contentType.includes("application/json")) {
        payload = await response.json();
      } else if (contentType.includes("text/")) {
        payload = await response.text();
      }

      if (!response.ok) {
        const message =
          (payload && typeof payload === "object" && payload.message) ||
          (typeof payload === "string" && payload) ||
          "Запрос завершился ошибкой";
        const error = new Error(message);
        error.status = response.status;
        error.payload = payload;
        throw error;
      }

      return payload || {};
    })
    .catch((error) => {
      if (error.name === "AbortError") {
        throw new Error("Истек таймаут запроса");
      }
      if (error.name === "TypeError" && error.message === "Failed to fetch") {
        const networkError = new Error("Не удалось связаться с сервером");
        networkError.code = "NETWORK_ERROR";
        throw networkError;
      }
      throw error;
    })
    .finally(() => {
      window.clearTimeout(timerId);
    });
}

function resolveApiBase(attributeBase = "") {
  const params = new URLSearchParams(window.location.search);
  const overrideBase = params.get("apiBase");
  let base = (overrideBase || attributeBase || "").trim();

  if (!base) {
    base = window.location.origin;
  }

  const isLocalHost = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(base);
  if (window.location.protocol === "https:" && base.startsWith("http://") && !isLocalHost) {
    base = base.replace("http://", "https://");
  }

  return base.replace(/\/$/, "");
}

function resolveGoogleClientId() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("googleClientId");
  if (fromQuery) {
    return fromQuery.trim();
  }

  const bodyValue = document.body?.dataset.googleClientId;
  if (bodyValue) {
    return bodyValue.trim();
  }

  const metaValue = document
    .querySelector('meta[name="google-client-id"]')
    ?.getAttribute("content");
  if (metaValue) {
    return metaValue.trim();
  }

  if (window.GOOGLE_CLIENT_ID) {
    return String(window.GOOGLE_CLIENT_ID).trim();
  }

  return "";
}

function buildEndpoint(apiBase, path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return apiBase ? `${apiBase}${normalizedPath}` : normalizedPath;
}

function isNetworkError(error) {
  return error?.code === "NETWORK_ERROR";
}

function loadLocalUsers() {
  try {
    const stored = window.localStorage?.getItem(LOCAL_USERS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Не удалось загрузить локальных пользователей", error);
    return [];
  }
}

function saveLocalUsers(users) {
  try {
    window.localStorage?.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch (error) {
    console.error("Не удалось сохранить локальных пользователей", error);
    throw new Error("Не удалось сохранить данные локально");
  }
}

async function registerLocalUser(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = loadLocalUsers();
  const exists = users.some((user) => user.email === normalizedEmail);
  if (exists) {
    throw new Error("Пользователь уже сохранен локально");
  }
  const passwordHash = await hashPassword(password, normalizedEmail);
  const nextUsers = [
    ...users,
    {
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
    },
  ];
  saveLocalUsers(nextUsers);
  return {
    message: "Сервер недоступен. Аккаунт сохранен локально.",
    user: { email: normalizedEmail },
  };
}

function loadLocalSession() {
  try {
    const stored = window.localStorage?.getItem(LOCAL_SESSION_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error("Не удалось загрузить локальную сессию", error);
    return null;
  }
}

function saveLocalSession(session) {
  try {
    window.localStorage?.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error("Не удалось сохранить локальную сессию", error);
  }
}

function clearLocalSession() {
  try {
    window.localStorage?.removeItem(LOCAL_SESSION_KEY);
  } catch (error) {
    console.error("Не удалось очистить локальную сессию", error);
  }
}

async function loginLocalUser(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = loadLocalUsers();
  const user = users.find((item) => item.email === normalizedEmail);
  if (!user) {
    throw new Error("Пользователь не найден в локальном хранилище");
  }
  const passwordHash = await hashPassword(password, normalizedEmail);
  if (user.passwordHash !== passwordHash) {
    throw new Error("Неверный email или пароль");
  }
  const session = {
    email: normalizedEmail,
    loggedInAt: new Date().toISOString(),
    mode: "local",
  };
  saveLocalSession(session);
  safeRemoveToken();
  return {
    message: "Вход выполнен (офлайн-режим)",
    session,
  };
}

function renderLocalSession(sessionStatus, logoutButton, session) {
  if (!session) {
    return;
  }
  const email = session.email;
  const suffix = session.mode === "local" ? " (офлайн)" : "";
  const message = email
    ? `Вы вошли как ${email}${suffix}`
    : "Вы вошли (офлайн)";
  setStatusMessage(sessionStatus, message, "success");
  if (logoutButton) {
    logoutButton.hidden = false;
  }
}

async function hashPassword(password, salt = "") {
  if (!window.crypto?.subtle) {
    return `${salt}:${password}`;
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${password}`);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer);
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function debounce(callback, delay = 200) {
  let timeoutId;
  return function debounced(...args) {
    const context = this;
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback.apply(context, args);
    }, delay);
  };
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

const TOKEN_KEY = "medlibraryToken";
const BOOK_FIELD_KEYS = [
  "title",
  "author",
  "publisher",
  "city",
  "year",
  "pages",
  "language",
];

document.addEventListener("DOMContentLoaded", () => {
  const apiBase = (document.body?.dataset.apiBase || "").replace(/\/$/, "");

  initLanguageSwitcher();
  initGallerySlider();
  initAuthTabs();
  initRegistrationForm(apiBase);
  initLoginForm(apiBase);
  initSearchFilter();
  initBookTable();
});

function initLanguageSwitcher() {
  const languageSelect = document.getElementById("language-select");
  if (!languageSelect) {
    return;
  }

  const changeLanguage = () => {
    const lang = languageSelect.value || "ru";
    document.querySelectorAll(".lang").forEach((element) => {
      const isVisible = element.getAttribute("data-lang") === lang;
      element.hidden = !isVisible;
      element.setAttribute("aria-hidden", isVisible ? "false" : "true");
      if (isVisible) {
        element.style.removeProperty("display");
      }
    });
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

  form.addEventListener("submit", (event) => {
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
        setStatusMessage(
          statusElement,
          data.message || "Регистрация прошла успешно",
          "success"
        );
        form.reset();
      })
      .catch((error) => {
        setStatusMessage(
          statusElement,
          error.message || "Ошибка при регистрации",
          "error"
        );
      })
      .finally(() => {
        toggleDisabled(registerButton, false);
      });
  });
}

function initLoginForm(apiBase) {
  const form = document.getElementById("login-form");
  if (!form) {
    return;
  }

  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const statusElement = document.getElementById("login-status");
  const loginButton = document.getElementById("login-button");
  const logoutButton = document.getElementById("logout-button");
  const sessionStatus = document.getElementById("auth-session-status");
  const loginEndpoint = buildEndpoint(apiBase, "/login");

  const refreshSession = () => {
    try {
      const token = window.localStorage?.getItem(TOKEN_KEY);
      if (token) {
        setStatusMessage(sessionStatus, "Вы вошли в систему", "success");
        if (logoutButton) {
          logoutButton.hidden = false;
        }
      } else {
        setStatusMessage(sessionStatus, "Вы не авторизованы", null);
        if (logoutButton) {
          logoutButton.hidden = true;
        }
      }
    } catch (error) {
      console.error("Не удалось получить информацию о сессии", error);
    }
  };

  logoutButton?.addEventListener("click", () => {
    try {
      window.localStorage?.removeItem(TOKEN_KEY);
    } catch (error) {
      console.error("Не удалось очистить токен", error);
    }
    refreshSession();
  });

  form.addEventListener("submit", (event) => {
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

    fetch(loginEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Не удалось выполнить вход");
        }
        return response.json();
      })
      .then((data) => {
        const token = data.token;
        if (token) {
          try {
            window.localStorage?.setItem(TOKEN_KEY, token);
          } catch (error) {
            console.error("Не удалось сохранить токен", error);
          }
        }
        setStatusMessage(statusElement, data.message || "Вход выполнен", "success");
        refreshSession();
        form.reset();
      })
      .catch((error) => {
        setStatusMessage(
          statusElement,
          error.message || "Ошибка при входе",
          "error"
        );
      })
      .finally(() => {
        toggleDisabled(loginButton, false);
      });
  });

  refreshSession();
}

function initSearchFilter() {
  const searchInput = document.getElementById("searchInput");
  const tableBody = document.querySelector("#book-table tbody");
  if (!searchInput || !tableBody) {
    return;
  }

  const clearButton = document.getElementById("clear-search");
  const columnFilters = document.querySelectorAll("[data-column-filter]");
  const resetFiltersButton = document.getElementById("reset-filters");
  const statusElement = document.getElementById("book-status");
  let isTableReady = false;
  let totalRows = 0;

  const updateStatus = (visibleRows) => {
    if (!statusElement) {
      return;
    }

    if (!totalRows) {
      return;
    }

    if (!visibleRows) {
      statusElement.textContent = "Ничего не найдено";
      statusElement.dataset.state = "error";
      return;
    }

    const prefix = visibleRows === totalRows ? "Показаны" : "Найдено";
    statusElement.textContent = `${prefix} ${visibleRows} из ${totalRows} записей`;
    statusElement.dataset.state = "success";
  };

  const filterRows = () => {
    clearButton?.classList.toggle("is-visible", Boolean(searchInput.value));

    if (!isTableReady) {
      return;
    }

    const filter = searchInput.value.trim().toUpperCase();
    const rows = Array.from(tableBody.rows).filter(
      (row) => !row.classList.contains("skeleton-row")
    );
    const perColumnFilters = Array.from(columnFilters).map((input) => ({
      column: Number(input.dataset.columnFilter),
      value: input.value.trim().toUpperCase(),
    }));
    let visibleCount = 0;

    rows.forEach((row) => {
      const cells = row.getElementsByTagName("td");
      if (!cells.length) {
        return;
      }

      const matchesQuickSearch =
        !filter ||
        Array.from(cells).some((cell) =>
          (cell.textContent || "").toUpperCase().includes(filter)
        );
      const matchesColumnFilters = perColumnFilters.every((columnFilter) => {
        if (!columnFilter.value) {
          return true;
        }
        const cellText =
          cells[columnFilter.column]?.textContent?.toUpperCase() || "";
        return cellText.includes(columnFilter.value);
      });

      const matches = matchesQuickSearch && matchesColumnFilters;
      row.hidden = !matches;
      if (matches) {
        visibleCount += 1;
      }
    });

    totalRows = rows.length;
    updateStatus(visibleCount);
    syncSelectionAfterFilter(tableBody);
    renderBookCards(rows);
  };

  const debouncedFilter = debounce(filterRows, 160);
  searchInput.addEventListener("input", debouncedFilter);
  columnFilters.forEach((input) => {
    input.addEventListener("input", debouncedFilter);
  });

  clearButton?.addEventListener("click", () => {
    if (!searchInput.value) {
      return;
    }
    searchInput.value = "";
    filterRows();
    searchInput.focus();
  });

  resetFiltersButton?.addEventListener("click", () => {
    searchInput.value = "";
    columnFilters.forEach((input) => {
      input.value = "";
    });
    filterRows();
    searchInput.focus();
  });

  tableBody.addEventListener("booktable:ready", (event) => {
    isTableReady = true;
    totalRows = event?.detail?.totalRows ?? tableBody.rows.length;
    filterRows();
  });
}

function initBookTable() {
  const bookTableBody = document.querySelector("#book-table tbody");
  const statusElement = document.getElementById("book-status");
  if (!bookTableBody) {
    return;
  }

  if (typeof XLSX === "undefined") {
    console.error("XLSX library is not loaded");
    if (statusElement) {
      statusElement.textContent = "Библиотека недоступна";
      statusElement.dataset.state = "error";
    }
    return;
  }

  const tablePanel = document.querySelector(".table-panel");
  let activeRow = null;

  const resetSelection = () => {
    if (activeRow) {
      activeRow.classList.remove("is-selected");
    }
    activeRow = null;
    setBookDetail();
  };

  const selectRow = (row) => {
    if (!row || row === activeRow) {
      return;
    }
    activeRow?.classList.remove("is-selected");
    activeRow = row;
    row.classList.add("is-selected");
    setBookDetail(getRowDetail(row));
  };

  setBookDetail();
  const setTableStatus = (message, state) => {
    if (!statusElement) {
      return;
    }
    statusElement.textContent = message;
    if (state) {
      statusElement.dataset.state = state;
    } else {
      delete statusElement.dataset.state;
    }
  };

  tablePanel?.classList.add("is-loading");
  setTableStatus("Загружаем каталог...", "pending");

  const columns = [
    "Название книги",
    "Имя автора",
    "Издатель",
    "Город публикации",
    "Год публикации",
    "Количество страниц",
    "Язык книги",
  ];
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
      const rows = jsonData.slice(0, MAX_ROWS).map((row) =>
        columns.map((column) => row[column] || "")
      );

      if (!rows.length) {
        tablePanel?.classList.remove("is-loading");
        tablePanel?.classList.add("is-ready");
        bookTableBody.innerHTML = "";
        setTableStatus("Каталог пуст", "error");
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
          tr.dataset.rowIndex = String(i);
          tr.tabIndex = 0;
          rows[i].forEach((cellValue) => {
            const td = document.createElement("td");
            td.textContent = cellValue;
            tr.appendChild(td);
          });
          tr.addEventListener("click", () => selectRow(tr));
          tr.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              selectRow(tr);
            }
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
          setTableStatus(`Показаны ${totalRows} записей`, "success");
          dispatchReady(totalRows);
          const firstRow = bookTableBody.querySelector("tr");
          if (firstRow) {
            selectRow(firstRow);
          } else {
            resetSelection();
          }
          renderBookCards(
            Array.from(bookTableBody.rows).filter(
              (row) => !row.classList.contains("skeleton-row")
            )
          );
        }
      };

      renderChunk();
    })
    .catch((error) => {
      console.error("Error:", error);
      tablePanel?.classList.remove("is-loading");
      tablePanel?.classList.add("is-ready");
      bookTableBody.innerHTML = "";
      setTableStatus("Не удалось загрузить каталог. Попробуйте позже.", "error");
      resetSelection();
    });
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

function buildEndpoint(apiBase, path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return apiBase ? `${apiBase}${normalizedPath}` : normalizedPath;
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

function setBookDetail(detail) {
  const detailPanel = document.getElementById("book-detail");
  if (!detailPanel) {
    return;
  }
  const emptyState = detailPanel.querySelector(".detail-empty");
  const titleElement = detailPanel.querySelector(".detail-title");
  const content = detailPanel.querySelector(".detail-content");
  if (!content) {
    return;
  }

  if (!detail) {
    if (titleElement) {
      titleElement.textContent = "Выберите книгу";
    }
    if (emptyState) {
      emptyState.hidden = false;
    }
    content.hidden = true;
    content.querySelectorAll("[data-detail-field]").forEach((field) => {
      field.textContent = "—";
    });
    detailPanel.classList.remove("has-data");
    return;
  }

  if (titleElement) {
    titleElement.textContent = detail.title || "Без названия";
  }
  content.querySelectorAll("[data-detail-field]").forEach((field) => {
    const key = field.getAttribute("data-detail-field");
    field.textContent = detail[key] || "—";
  });
  detailPanel.classList.add("has-data");
  if (emptyState) {
    emptyState.hidden = true;
  }
  content.hidden = false;
}

function getRowDetail(row) {
  if (!row) {
    return null;
  }
  const cells = row.getElementsByTagName("td");
  const detail = {};
  BOOK_FIELD_KEYS.forEach((key, index) => {
    detail[key] = cells[index]?.textContent?.trim() || "—";
  });
  return detail;
}

function syncSelectionAfterFilter(tableBody) {
  if (!tableBody) {
    return;
  }
  const selectedRow = tableBody.querySelector("tr.is-selected");
  if (selectedRow && selectedRow.hidden) {
    selectedRow.classList.remove("is-selected");
    setBookDetail();
  }
}

function renderBookCards(rows) {
  const cardContainer = document.getElementById("book-card-container");
  if (!cardContainer) {
    return;
  }
  const cardStatus = document.getElementById("card-status");
  const visibleRows = rows.filter(
    (row) => !row.hidden && !row.classList.contains("skeleton-row")
  );
  const maxCardsAttr = Number(cardContainer.dataset.maxCards || 0);
  const shouldLimit = Number.isFinite(maxCardsAttr) && maxCardsAttr > 0;

  if (!visibleRows.length) {
    cardContainer.innerHTML = "";
    if (cardStatus) {
      cardStatus.textContent = "Подходящих книг не найдено. Попробуйте изменить фильтры.";
    }
    return;
  }

  const fragment = document.createDocumentFragment();
  const cardsToRender = shouldLimit
    ? Math.min(visibleRows.length, maxCardsAttr)
    : visibleRows.length;
  for (let i = 0; i < cardsToRender; i += 1) {
    fragment.appendChild(createBookCard(getRowDetail(visibleRows[i])));
  }
  cardContainer.innerHTML = "";
  cardContainer.appendChild(fragment);
  if (cardStatus) {
    cardStatus.textContent = shouldLimit
      ? `Показаны ${cardsToRender} из ${visibleRows.length} найденных книг`
      : `Найдено ${visibleRows.length} книг`;
  }
}

function createBookCard(detail) {
  const card = document.createElement("article");
  card.className = "book-card";
  const title = document.createElement("h3");
  title.textContent = detail?.title || "Без названия";
  card.appendChild(title);

  const meta = document.createElement("p");
  meta.className = "book-card__meta";
  const author = detail?.author || "Автор неизвестен";
  const year = detail?.year || "—";
  meta.textContent = `${author} • ${year}`;
  card.appendChild(meta);

  const detailsList = document.createElement("ul");
  detailsList.className = "book-card__details";
  [
    ["Издатель", detail?.publisher],
    ["Город", detail?.city],
    ["Язык", detail?.language],
    ["Страниц", detail?.pages],
  ].forEach(([label, value]) => {
    const item = document.createElement("li");
    const labelSpan = document.createElement("span");
    labelSpan.textContent = label;
    const valueElement = document.createElement("strong");
    valueElement.textContent = value || "—";
    item.appendChild(labelSpan);
    item.appendChild(valueElement);
    detailsList.appendChild(item);
  });
  card.appendChild(detailsList);

  return card;
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

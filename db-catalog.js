const state = {
  catalog: null,
  filteredBooks: [],
  activeCategory: "",
  activeLanguage: "",
  searchQuery: "",
};

const elements = {};
let apiBase = "";

const normalizeValue = (value) =>
  value == null
    ? ""
    : value
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

const normalizeCategoryValue = (category) =>
  normalizeValue(category?.nameRu || category?.nameTm) || category?.id || "";

const resolveApiBase = () => {
  const url = new URL(window.location.href);
  const paramBase = url.searchParams.get("apiBase")?.trim();
  const bodyBase = document.body?.dataset.apiBase;
  const source = paramBase || bodyBase || "";
  return source.replace(/\/$/, "");
};

const formatPages = (pages) => {
  if (!pages) return "";
  return `${pages} стр.`;
};

const updateStatus = () => {
  if (!elements.filterStatus || !state.catalog) return;
  const total = state.catalog.books.length;
  const shown = state.filteredBooks.length;
  if (total === 0) {
    elements.filterStatus.textContent = "Каталог пуст";
    return;
  }
  elements.filterStatus.textContent = `Найдено ${shown} из ${total} книг`;
};

const renderBooks = () => {
  if (!elements.bookGrid) return;
  elements.bookGrid.innerHTML = "";

  if (!state.filteredBooks.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "sqlite-placeholder";
    placeholder.textContent = "Нет совпадений по заданным фильтрам.";
    elements.bookGrid.appendChild(placeholder);
    return;
  }

  const fragment = document.createDocumentFragment();

  state.filteredBooks.forEach((book) => {
    const card = document.createElement("article");
    card.className = "sqlite-card";

    const title = document.createElement("h4");
    title.className = "sqlite-card__title";
    title.textContent = book.titleRu || book.titleTm || "Без названия";
    card.appendChild(title);

    if (book.titleTm && book.titleRu && book.titleTm !== book.titleRu) {
      const altTitle = document.createElement("p");
      altTitle.className = "sqlite-card__subtitle";
      altTitle.textContent = book.titleTm;
      card.appendChild(altTitle);
    }

    const metaList = document.createElement("dl");
    metaList.className = "sqlite-card__meta";

    const metaItems = [
      ["Автор", book.authorRu || book.authorTm],
      ["Издатель", book.publisher],
      ["Город", book.city],
      ["Год", book.year],
      ["Страниц", formatPages(book.pages)],
      ["Язык", book.language],
      ["ISBN", book.isbn],
      ["УДК", book.udk],
      ["ББК", book.bbk],
    ];

    metaItems.forEach(([label, value]) => {
      if (!value) return;
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      metaList.append(dt, dd);
    });

    if (metaList.childNodes.length) {
      card.appendChild(metaList);
    }

    if (book.categories?.length) {
      const tagList = document.createElement("div");
      tagList.className = "sqlite-card__tags";
      book.categories.forEach((category) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = category.nameRu || category.nameTm;
        tagList.appendChild(tag);
      });
      card.appendChild(tagList);
    }

    fragment.appendChild(card);
  });

  elements.bookGrid.appendChild(fragment);
};

const setActiveCategory = (normalizedValue) => {
  state.activeCategory = normalizedValue;
  if (elements.categoryFilter) {
    elements.categoryFilter.value = normalizedValue;
  }
  renderCategoryCards();
  applyFilters();
};

const renderCategoryCards = () => {
  if (!elements.categoryList || !state.catalog) return;
  elements.categoryList.innerHTML = "";

  if (!state.catalog.categories.length) {
    const placeholder = document.createElement("p");
    placeholder.className = "muted";
    placeholder.textContent = "Категории не найдены";
    elements.categoryList.appendChild(placeholder);
    return;
  }

  const fragment = document.createDocumentFragment();

  state.catalog.categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-chip";
    const normalized = normalizeCategoryValue(category);
    if (normalized && normalized === state.activeCategory) {
      button.classList.add("category-chip--active");
    }
    button.dataset.category = normalized;

    const title = document.createElement("span");
    title.className = "category-chip__title";
    title.textContent = category.nameRu || category.nameTm || "Без названия";

    const count = document.createElement("span");
    count.className = "category-chip__count";
    count.textContent = `${category.count} книг`;

    button.append(title, count);
    button.addEventListener("click", () => {
      setActiveCategory(normalized === state.activeCategory ? "" : normalized);
    });

    fragment.appendChild(button);
  });

  elements.categoryList.appendChild(fragment);
};

const applyFilters = () => {
  if (!state.catalog) return;

  const query = normalizeValue(state.searchQuery);
  const category = state.activeCategory;
  const language = state.activeLanguage;

  state.filteredBooks = state.catalog.books.filter((book) => {
    const matchesQuery = !query
      ? true
      : [
          book.titleRu,
          book.titleTm,
          book.authorRu,
          book.authorTm,
          book.publisher,
          book.city,
          book.year,
          book.isbn,
          book.udk,
          book.bbk,
          ...(book.categories || []).map((categoryEntry) =>
            categoryEntry.nameRu || categoryEntry.nameTm
          ),
        ].some((value) => normalizeValue(value).includes(query));

    const matchesCategory = !category
      ? true
      : (book.categories || []).some(
          (entry) => normalizeCategoryValue(entry) === category
        );

    const matchesLanguage = !language
      ? true
      : normalizeValue(book.language) === language;

    return matchesQuery && matchesCategory && matchesLanguage;
  });

  updateStatus();
  renderBooks();
};

const populateFilters = () => {
  if (!state.catalog) return;

  if (elements.booksCount) {
    elements.booksCount.textContent = state.catalog.stats.books;
  }
  if (elements.categoriesCount) {
    elements.categoriesCount.textContent = state.catalog.stats.categories;
  }

  if (elements.categoryFilter) {
    elements.categoryFilter.innerHTML = '<option value="">Все категории</option>';
    state.catalog.categories.forEach((category) => {
      const option = document.createElement("option");
      const normalized = normalizeCategoryValue(category);
      option.value = normalized;
      option.textContent = category.nameRu || category.nameTm;
      elements.categoryFilter.appendChild(option);
    });
  }

  if (elements.languageFilter) {
    elements.languageFilter.innerHTML = '<option value="">Любой</option>';
    const languages = Array.from(
      new Set(
        state.catalog.books
          .map((book) => book.language)
          .filter(Boolean)
          .map((lang) => normalizeValue(lang))
      )
    );

    languages
      .map((normalized) => {
        const display =
          state.catalog.books.find(
            (book) => normalizeValue(book.language) === normalized
          )?.language || normalized;
        return { normalized, display };
      })
      .forEach(({ normalized, display }) => {
        const option = document.createElement("option");
        option.value = normalized;
        option.textContent = display;
        elements.languageFilter.appendChild(option);
      });
  }

  renderCategoryCards();
};

const attachEvents = () => {
  elements.searchInput?.addEventListener("input", (event) => {
    state.searchQuery = event.target.value || "";
    applyFilters();
  });

  elements.categoryFilter?.addEventListener("change", (event) => {
    setActiveCategory(event.target.value || "");
  });

  elements.languageFilter?.addEventListener("change", (event) => {
    state.activeLanguage = event.target.value || "";
    applyFilters();
  });
};

const fetchCatalog = async () => {
  if (!elements.filterStatus) return;
  elements.filterStatus.textContent = "Загружаем каталог...";

  try {
    const endpoint = apiBase ? `${apiBase}/db/catalog` : "/db/catalog";
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error("Ответ сервера: " + response.status);
    }
    const catalog = await response.json();
    state.catalog = catalog;
    state.filteredBooks = catalog.books;
    populateFilters();
    updateStatus();
    renderBooks();
  } catch (error) {
    console.warn(error);
    elements.filterStatus.textContent = "Не удалось загрузить каталог";
    if (elements.bookGrid) {
      elements.bookGrid.innerHTML = "";
      const notice = document.createElement("div");
      notice.className = "sqlite-placeholder";
      notice.textContent = "Ошибка загрузки данных из dbMedicalLib.sqlite";
      elements.bookGrid.appendChild(notice);
    }
    return;
  }
};

const init = () => {
  elements.searchInput = document.querySelector("[data-search-input]");
  elements.categoryFilter = document.querySelector("[data-category-filter]");
  elements.languageFilter = document.querySelector("[data-language-filter]");
  elements.filterStatus = document.querySelector("[data-filter-status]");
  elements.categoryList = document.querySelector("[data-category-list]");
  elements.bookGrid = document.querySelector("[data-book-grid]");
  elements.booksCount = document.querySelector("[data-books-count]");
  elements.categoriesCount = document.querySelector("[data-categories-count]");

  apiBase = resolveApiBase();
  if (document.body) {
    document.body.dataset.apiBase = apiBase;
  }

  attachEvents();
  fetchCatalog();
};

document.addEventListener("DOMContentLoaded", init);

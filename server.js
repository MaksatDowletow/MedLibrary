const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const { execFile } = require("child_process");
const crypto = require("crypto");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
require("dotenv").config();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/medlibrary";
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";
const TOKEN_REFRESH_LEEWAY_MS = 30 * 1000;
const MAX_JSON_BODY_SIZE = process.env.MAX_JSON_BODY_SIZE || "1mb";
const GOOGLE_CLIENT_IDS = (process.env.GOOGLE_CLIENT_ID || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const GOOGLE_ALLOWED_HD = process.env.GOOGLE_ALLOWED_HD?.trim();
const SALT_ROUNDS = 12;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const USERS_FILE = process.env.USERS_FILE || path.join(DATA_DIR, "users.json");
const BOOKS_FILE = process.env.BOOKS_FILE || path.join(DATA_DIR, "books.json");
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, "dbMedicalLib.sqlite");
const COVER_CACHE_DIR = process.env.COVER_CACHE_DIR || path.join(DATA_DIR, "covers");
const STATIC_BUILD_DIR = process.env.CLIENT_DIST_DIR || path.join(__dirname, "dist");
const PUBLIC_ASSETS_DIR = path.join(__dirname, "public");
const ALLOWED_COVER_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_COVER_SIZE_BYTES = Number(process.env.MAX_COVER_SIZE_BYTES) || 2 * 1024 * 1024;
const GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const GOOGLE_FETCH_TIMEOUT = 10000;
const isFetchAvailable = typeof fetch === "function";

mongoose.set("strictQuery", true);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    email: this.email,
  };
};

const User = mongoose.model("User", userSchema);

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    author: { type: String, trim: true },
    publisher: { type: String, trim: true },
    city: { type: String, trim: true },
    year: { type: String, trim: true },
    pages: { type: String, trim: true },
    language: { type: String, trim: true },
    specialty: { type: String, trim: true },
    link: { type: String, trim: true },
    cover: { type: String, trim: true },
    hasExternalLink: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Book = mongoose.model("Book", bookSchema);

const normalizeBookRecord = (record = {}) => ({
  title: record.title?.toString().trim() || "",
  author: record.author?.toString().trim() || "",
  publisher: record.publisher?.toString().trim() || "",
  city: record.city?.toString().trim() || "",
  year: record.year?.toString().trim() || "",
  pages: record.pages?.toString().trim() || "",
  language: record.language?.toString().trim() || "",
  specialty: record.specialty?.toString().trim() || "",
  link: record.link?.toString().trim() || "",
  cover: record.cover?.toString().trim() || "",
  hasExternalLink: Boolean(record.hasExternalLink),
});

const createFileUserStore = (filePath = USERS_FILE) => {
  const usersByEmail = new Map();
  const usersById = new Map();

  const cloneUser = (user) => (user ? { ...user } : null);

  const loadUsersFromDisk = async () => {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((user) => {
          if (user?.email && user?.passwordHash && (user.id || user._id)) {
            const userId = user.id || user._id;
            const normalized = {
              id: userId,
              email: user.email,
              passwordHash: user.passwordHash,
            };
            usersByEmail.set(normalized.email, normalized);
            usersById.set(normalized.id, normalized);
          }
        });
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn("Не удалось загрузить файл пользователей", error.message);
      }
    }
  };

  const persistUsersToDisk = async () => {
    const serialized = JSON.stringify(
      Array.from(usersById.values()).map((user) => ({
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
      })),
      null,
      2
    );

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, serialized);
  };

  const ready = loadUsersFromDisk();

  const ensureReady = async () => {
    try {
      await ready;
    } catch (error) {
      console.warn("Хранилище пользователей доступно в режиме чтения", error.message);
    }
  };

  return {
    type: "file",
    ready,
    async findByEmail(email) {
      await ensureReady();
      return cloneUser(usersByEmail.get(email));
    },
    async findByEmailWithPassword(email) {
      await ensureReady();
      return cloneUser(usersByEmail.get(email));
    },
    async findById(id) {
      await ensureReady();
      return cloneUser(usersById.get(id));
    },
    async createUser(email, passwordHash) {
      await ensureReady();
      const user = {
        id: crypto.randomUUID(),
        email,
        passwordHash,
      };
      usersByEmail.set(email, user);
      usersById.set(user.id, user);
      try {
        await persistUsersToDisk();
      } catch (error) {
        console.error("Не удалось сохранить файл пользователей", error);
        throw new Error("Ошибка сохранения пользователя. Попробуйте позже.");
      }
      return cloneUser(user);
    },
  };
};

const createFileBookStore = (filePath = BOOKS_FILE) => ({
  type: "file",
  async listBooks() {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((book) => normalizeBookRecord(book));
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn("Не удалось прочитать каталог книг", error.message);
      }
    }
    return [];
  },
});

const createMongoBookStore = () => ({
  type: "mongo",
  async listBooks() {
    const docs = await Book.find({}).lean();
    return docs.map((book) => normalizeBookRecord(book));
  },
  async seedFromFileIfEmpty() {
    const existingCount = await Book.estimatedDocumentCount();
    if (existingCount > 0) {
      return;
    }
    const fallbackBooks = await createFileBookStore().listBooks();
    if (fallbackBooks.length === 0) {
      return;
    }
    await Book.insertMany(fallbackBooks, { ordered: false });
  },
});

const createMongoUserStore = () => ({
  type: "mongo",
  async findByEmail(email) {
    return User.findOne({ email });
  },
  async findByEmailWithPassword(email) {
    return User.findOne({ email }).select("+passwordHash");
  },
  async findById(id) {
    return User.findById(id);
  },
  async createUser(email, passwordHash) {
    return User.create({ email, passwordHash });
  },
});

let userStore = createFileUserStore();
let bookStore = createFileBookStore();
let sqliteCatalogCache = { data: null, loadedAt: 0 };
const SQLITE_CACHE_TTL = 5 * 60 * 1000;

const normalizeSqliteText = (value) => {
  if (value == null) {
    return "";
  }
  return value.toString().replace(/\s+/g, " ").trim();
};

const normalizeCoverKey = (value = "") => {
  const normalized = value
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || null;
};

const normalizeHttpUrl = (value = "") => {
  try {
    const url = new URL(value);
    if (![
      "http:",
      "https:",
    ].includes(url.protocol)) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch (error) {
    return null;
  }
};

const guessCoverExtension = (contentType = "", remoteUrl = "") => {
  const baseContentType = contentType.split(";")[0]?.trim().toLowerCase();
  const typeMap = new Map([
    ["image/jpeg", ".jpg"],
    ["image/jpg", ".jpg"],
    ["image/png", ".png"],
    ["image/webp", ".webp"],
  ]);

  if (typeMap.has(baseContentType)) {
    return typeMap.get(baseContentType);
  }

  try {
    const ext = path.extname(new URL(remoteUrl).pathname).toLowerCase();
    if (ALLOWED_COVER_EXTENSIONS.includes(ext)) {
      return ext;
    }
  } catch (error) {
    // ignore
  }

  return ".jpg";
};

const buildPublicCoverUrl = (filename, req) => {
  if (!filename) {
    return "";
  }
  const host = req?.get("host");
  const protocol = req?.protocol || "http";
  const origin = host ? `${protocol}://${host}` : "";
  return `${origin}/covers/${encodeURIComponent(filename)}`;
};

const findCachedCover = async (baseName) => {
  if (!baseName) {
    return null;
  }

  for (const ext of ALLOWED_COVER_EXTENSIONS) {
    const filename = `${baseName}${ext}`;
    const filePath = path.join(COVER_CACHE_DIR, filename);
    try {
      await fs.access(filePath);
      return filename;
    } catch (error) {
      // try next extension
    }
  }

  return null;
};

const downloadCoverToDisk = async (remoteUrl, baseName) => {
  const normalizedUrl = normalizeHttpUrl(remoteUrl);
  if (!normalizedUrl) {
    throw new Error("Некорректный адрес обложки");
  }

  if (!isFetchAvailable) {
    throw new Error("Загрузка обложек недоступна в этой среде");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(normalizedUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error("Не удалось скачать обложку");
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      throw new Error("Ответ не содержит изображение");
    }

    const declaredSize = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_COVER_SIZE_BYTES) {
      throw new Error("Обложка превышает допустимый размер");
    }
    const chunks = [];
    let downloaded = 0;
    for await (const chunk of response.body) {
      downloaded += chunk.length;
      if (downloaded > MAX_COVER_SIZE_BYTES) {
        throw new Error("Обложка превышает допустимый размер");
      }
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    const extension = guessCoverExtension(contentType, remoteUrl);
    const filename = `${baseName}${extension}`;
    const filePath = path.join(COVER_CACHE_DIR, filename);
    await fs.mkdir(COVER_CACHE_DIR, { recursive: true });
    await fs.writeFile(filePath, buffer);
    return filename;
  } finally {
    clearTimeout(timeoutId);
  }
};

const revokedTokens = new Map();

const cleanupRevokedTokens = () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of revokedTokens.entries()) {
    if (exp && exp < nowSeconds) {
      revokedTokens.delete(jti);
    }
  }
};

const revokeToken = (payload) => {
  if (!payload?.jti) {
    return;
  }
  revokedTokens.set(payload.jti, payload.exp || null);
};

const isTokenRevoked = (payload) => {
  if (!payload?.jti) {
    return false;
  }
  cleanupRevokedTokens();
  return revokedTokens.has(payload.jti);
};

const runSqliteQuery = async (query) =>
  new Promise((resolve, reject) => {
    execFile(
      "sqlite3",
      ["-json", SQLITE_DB_PATH, query],
      { maxBuffer: 20 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          return reject(error);
        }
        try {
          const parsed = JSON.parse(stdout || "[]");
          resolve(parsed);
        } catch (parseError) {
          reject(parseError);
        }
      }
    );
  });

const loadSqliteCatalog = async () => {
  const now = Date.now();
  if (
    sqliteCatalogCache.data &&
    now - sqliteCatalogCache.loadedAt < SQLITE_CACHE_TTL
  ) {
    return sqliteCatalogCache.data;
  }

  try {
    await fs.access(SQLITE_DB_PATH);
  } catch (error) {
    console.warn("SQLite файл недоступен", error.message);
    return null;
  }

  try {
    const [categories, languages, books, links] = await Promise.all([
      runSqliteQuery(
        "SELECT Oid AS id, BookCategoryNameRu AS nameRu, BookCategoryNameTM AS nameTm FROM BookCategory WHERE IFNULL(GCRecord, 0) = 0"
      ),
      runSqliteQuery(
        "SELECT Oid AS id, LanguageName AS name FROM Language WHERE IFNULL(GCRecord, 0) = 0"
      ),
      runSqliteQuery(
        "SELECT Oid AS id, BookNameRu AS titleRu, AuthorsNameRu AS authorRu, BookNameTm AS titleTm, AuthorsNameTm AS authorTm, PublisherName AS publisher, PublicationCity AS city, PublicationYear AS year, PageCount AS pages, UDK, BBK, ISBN, BookImage AS bookImageId, File AS fileId, BookLanguage AS languageId FROM Book WHERE IFNULL(GCRecord, 0) = 0"
      ),
      runSqliteQuery(
        "SELECT Books AS bookId, Categories AS categoryId FROM BookCategoryCategories_BookBooks WHERE Books IS NOT NULL AND Categories IS NOT NULL"
      ),
    ]);

    const languageMap = new Map(
      languages.map((language) => [
        language.id,
        normalizeSqliteText(language.name),
      ])
    );

    const categoryMap = new Map(
      categories.map((category) => [
        category.id,
        {
          id: category.id,
          nameRu: normalizeSqliteText(category.nameRu),
          nameTm: normalizeSqliteText(category.nameTm),
          count: 0,
        },
      ])
    );

    const bookCategoryLookup = new Map();
    links.forEach((link) => {
      const list = bookCategoryLookup.get(link.bookId) || [];
      list.push(link.categoryId);
      bookCategoryLookup.set(link.bookId, list);
    });

    const normalizedBooks = books.map((book) => {
      const categoriesForBook = (bookCategoryLookup.get(book.id) || [])
        .map((categoryId) => categoryMap.get(categoryId))
        .filter(Boolean);

      categoriesForBook.forEach((category) => {
        category.count += 1;
      });

      return {
        id: book.id,
        titleRu: normalizeSqliteText(book.titleRu),
        titleTm: normalizeSqliteText(book.titleTm),
        authorRu: normalizeSqliteText(book.authorRu),
        authorTm: normalizeSqliteText(book.authorTm),
        publisher: normalizeSqliteText(book.publisher),
        city: normalizeSqliteText(book.city),
        year: normalizeSqliteText(book.year),
        pages: typeof book.pages === "number" ? book.pages : null,
        language: normalizeSqliteText(languageMap.get(book.languageId)),
        isbn: normalizeSqliteText(book.ISBN),
        udk: normalizeSqliteText(book.UDK),
        bbk: normalizeSqliteText(book.BBK),
        categories: categoriesForBook.map((category) => ({
          id: category.id,
          nameRu: category.nameRu,
          nameTm: category.nameTm,
        })),
      };
    });

    const categoriesWithCounts = Array.from(categoryMap.values()).sort((a, b) =>
      a.nameRu.localeCompare(b.nameRu, "ru", { sensitivity: "accent" })
    );

    const catalog = {
      categories: categoriesWithCounts,
      books: normalizedBooks,
      stats: {
        books: normalizedBooks.length,
        categories: categoriesWithCounts.length,
      },
    };

    sqliteCatalogCache = { data: catalog, loadedAt: now };
    return catalog;
  } catch (error) {
    console.warn("Не удалось загрузить каталог из SQLite", error.message);
    return null;
  }
};

async function initializeUserStore() {
  await userStore.ready.catch((error) => {
    console.warn("Файловое хранилище пользователей не инициализировалось", error.message);
  });

  if (!MONGODB_URI) {
    console.warn("MONGODB_URI не указан. Используем файловое хранилище.");
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log("MongoDB connected");
    userStore = createMongoUserStore();
    bookStore = createMongoBookStore();
    await bookStore.seedFromFileIfEmpty().catch((error) => {
      console.warn("Не удалось импортировать каталог в MongoDB", error.message);
    });
  } catch (error) {
    console.warn(
      "Не удалось подключиться к MongoDB. Используем файловое хранилище.",
      error.message
    );
  }
}

initializeUserStore();

const app = express();

app.use(helmet());
app.use(cors());
// Явно разрешаем preflight-запросы для всех маршрутов, чтобы браузеры не
// получали ошибку 405 при попытке обратиться к API авторизации с других
// источников.
app.options("*", cors());
app.use(express.json({ limit: MAX_JSON_BODY_SIZE }));
app.use(morgan("tiny"));
[
  STATIC_BUILD_DIR,
  PUBLIC_ASSETS_DIR,
  __dirname,
]
  .filter((dir) => fsSync.existsSync(dir))
  .forEach((dir) => {
    app.use(
      express.static(dir, {
        maxAge: dir === STATIC_BUILD_DIR ? "7d" : 0,
        redirect: false,
      })
    );
  });

// Явные маршруты для основных файлов статики, чтобы они были доступны
// даже если сборка не содержит их копий (например, при неполной сборке dist).
const STATIC_ENTRY_FILES = [
  "config.js",
  "scripts.js",
  "pwa.js",
  path.join("src", "main.js"),
];

STATIC_ENTRY_FILES.forEach((relativePath) => {
  const routePath = `/${relativePath.replace(/\\/g, "/")}`;
  const absolutePath = path.join(__dirname, relativePath);

  app.get(routePath, async (req, res, next) => {
    try {
      await fs.access(absolutePath);
      return res.sendFile(absolutePath);
    } catch (error) {
      return next();
    }
  });
});
app.use(
  "/covers",
  express.static(COVER_CACHE_DIR, {
    maxAge: "7d",
    immutable: true,
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много попыток. Попробуйте позже." },
});

const coverCacheLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много попыток загрузки обложек. Попробуйте позже." },
});

app.use(
  ["/register", "/login", "/auth/google", "/password/forgot", "/email/resend"],
  authLimiter
);

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const validateEmail = (email = "") => /.+@.+\..+/.test(email);

const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }

  if (typeof user.toSafeObject === "function") {
    return user.toSafeObject();
  }

  const { id, _id, email } = user;
  const userId = id || (typeof _id === "object" ? _id.toString() : _id);
  return userId && email
    ? {
        id: userId,
        email,
      }
    : null;
};

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const logMailAction = (action, email, exists) => {
  const suffix = exists === false ? " (пользователь не найден)" : "";
  console.info(`[mail] ${action} для ${email}${suffix}`);
};

const generateToken = (user) =>
  jwt.sign(
    {
      userId: user.id,
      email: user.email,
      jti: crypto.randomUUID(),
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );

const buildTokenResponse = (user) => {
  const token = generateToken(user);
  const decoded = jwt.decode(token) || {};
  return {
    token,
    user,
    expiresAt: decoded?.exp ? decoded.exp * 1000 : undefined,
    issuedAt: decoded?.iat ? decoded.iat * 1000 : undefined,
  };
};

const isGoogleAuthEnabled = () => isFetchAvailable && GOOGLE_CLIENT_IDS.length > 0;

const verifyGoogleCredential = async (idToken) => {
  if (!isGoogleAuthEnabled()) {
    throw new Error("Вход через Google недоступен. Укажите GOOGLE_CLIENT_ID");
  }

  if (!idToken) {
    throw new Error("Отсутствует credential от Google");
  }

  if (!isFetchAvailable) {
    throw new Error("Сервер не поддерживает проверку токенов Google (нет fetch)");
  }

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = setTimeout(() => controller?.abort(), GOOGLE_FETCH_TIMEOUT);

  try {
    const response = await fetch(
      `${GOOGLE_TOKEN_INFO_URL}?id_token=${encodeURIComponent(idToken)}`,
      controller ? { signal: controller.signal } : undefined
    );

    if (!response.ok) {
      throw new Error("Google не подтвердил токен. Попробуйте снова");
    }

    const payload = await response.json();
    const audience = payload?.aud || "";
    if (!GOOGLE_CLIENT_IDS.includes(audience)) {
      throw new Error("Полученный токен выдан для другого клиента Google");
    }

    const email = payload?.email;
    if (!email) {
      throw new Error("Google не вернул адрес электронной почты");
    }

    if (payload?.email_verified !== "true") {
      throw new Error("Google не подтвердил email пользователя");
    }

    if (GOOGLE_ALLOWED_HD && payload?.hd && payload.hd !== GOOGLE_ALLOWED_HD) {
      throw new Error("Учетная запись Google не принадлежит разрешенному домену");
    }

    return {
      email: email.trim().toLowerCase(),
      name: payload?.name,
      picture: payload?.picture,
      locale: payload?.locale,
      sub: payload?.sub,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Google не ответил вовремя. Повторите попытку");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");
  if (!token) {
    return res.status(401).json({ message: "Токен отсутствует" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      clockTolerance: Math.ceil(TOKEN_REFRESH_LEEWAY_MS / 1000),
    });
    if (isTokenRevoked(payload)) {
      return res.status(401).json({ message: "Токен отозван" });
    }
    const user = await userStore.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ message: "Пользователь не найден" });
    }
    req.user = user;
    req.auth = payload;
    req.token = token;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Неверный или истекший токен" });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", store: userStore.type });
});

const loadBooksFromStore = async () => {
  const books = await bookStore.listBooks();
  if (books.length > 0) {
    return books;
  }
  return createFileBookStore().listBooks();
};

const buildSpecialtyIndex = (books = []) => {
  const specialties = new Map();

  books.forEach((book) => {
    const specialty = book?.specialty?.toString().trim();
    if (!specialty) {
      return;
    }
    const key = specialty.toLowerCase();
    const entry = specialties.get(key) || { name: specialty, count: 0 };
    entry.count += 1;
    specialties.set(key, entry);
  });

  return Array.from(specialties.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "ru", { sensitivity: "accent" })
  );
};

app.get(
  "/books",
  asyncHandler(async (req, res) => {
    const books = await loadBooksFromStore();
    res.json({ books });
  })
);

app.get(
  "/specialties",
  asyncHandler(async (req, res) => {
    const books = await loadBooksFromStore();
    const specialties = buildSpecialtyIndex(books);
    res.json({ specialties });
  })
);

app.post(
  "/covers/cache",
  coverCacheLimiter,
  asyncHandler(async (req, res) => {
    const { url, key } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ message: "Не указан URL обложки" });
    }

    const normalizedUrl = normalizeHttpUrl(url);
    if (!normalizedUrl) {
      return res.status(400).json({ message: "Некорректный адрес обложки" });
    }

    const normalizedKey = normalizeCoverKey(key || normalizedUrl) || crypto.randomUUID();
    const existing = await findCachedCover(normalizedKey);
    if (existing) {
      return res.json({ localUrl: buildPublicCoverUrl(existing, req) });
    }

    try {
      const filename = await downloadCoverToDisk(normalizedUrl, normalizedKey);
      res.json({ localUrl: buildPublicCoverUrl(filename, req) });
    } catch (error) {
      console.warn("Не удалось сохранить обложку", error.message);
      res
        .status(500)
        .json({ message: error.message || "Не удалось сохранить обложку" });
    }
  })
);

app.get(
  "/db/catalog",
  asyncHandler(async (req, res) => {
    const catalog = await loadSqliteCatalog();
    if (!catalog) {
      return res.status(503).json({ message: "Каталог SQLite недоступен" });
    }
    res.json(catalog);
  })
);

app.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email = "", password = "" } = req.body || {};
    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Укажите корректный email" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Пароль должен содержать минимум 6 символов" });
    }

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await userStore.findByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ message: "Пользователь уже зарегистрирован" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await userStore.createUser(normalizedEmail, passwordHash);
    return res.status(201).json({
      message: "Пользователь зарегистрирован",
      user: sanitizeUser(user),
    });
  })
);

app.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email = "", password = "" } = req.body || {};

    if (!validateEmail(email) || !password) {
      return res.status(400).json({ message: "Неверный email или пароль" });
    }

    const user = await userStore.findByEmailWithPassword(normalizeEmail(email));
    if (!user) {
      return res.status(400).json({ message: "Неверный email или пароль" });
    }

    const passwordHash = user.passwordHash;
    const isMatch = await bcrypt.compare(password, passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Неверный email или пароль" });
    }

    const tokenResponse = buildTokenResponse(sanitizeUser(user));
    return res.json({
      message: "Вход выполнен",
      ...tokenResponse,
    });
  })
);

app.post(
  "/password/forgot",
  asyncHandler(async (req, res) => {
    const { email = "" } = req.body || {};
    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Укажите корректный email" });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await userStore.findByEmail(normalizedEmail);
    logMailAction("Запрошено восстановление пароля", normalizedEmail, Boolean(user));

    return res.json({
      message:
        "Если указанный email зарегистрирован, мы отправили письмо со ссылкой для смены пароля.",
    });
  })
);

app.post(
  "/email/resend",
  asyncHandler(async (req, res) => {
    const { email = "" } = req.body || {};
    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Укажите корректный email" });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await userStore.findByEmail(normalizedEmail);
    logMailAction("Переотправка письма с подтверждением", normalizedEmail, Boolean(user));

    return res.json({
      message:
        "Если пользователь зарегистрирован, письмо отправлено повторно. Проверьте входящие и папку спама.",
    });
  })
);

app.post(
  "/auth/google",
  asyncHandler(async (req, res) => {
    if (!isGoogleAuthEnabled()) {
      return res
        .status(503)
        .json({ message: "Вход через Google не настроен на сервере" });
    }

    const { credential } = req.body || {};
    if (!credential) {
      return res.status(400).json({ message: "Отсутствует credential" });
    }

    try {
      const profile = await verifyGoogleCredential(credential);
      if (!profile?.email) {
        throw new Error("Google не вернул email пользователя");
      }

      let user = await userStore.findByEmail(profile.email);
      if (!user) {
        const placeholderSecret = `${profile.sub || "google"}:${crypto
          .randomBytes(32)
          .toString("hex")}`;
        const passwordHash = await bcrypt.hash(placeholderSecret, SALT_ROUNDS);
        user = await userStore.createUser(profile.email, passwordHash);
      }

      const safeUser = sanitizeUser(user);
      const tokenResponse = buildTokenResponse(safeUser);
      return res.json({
        message: "Вход выполнен через Google",
        provider: "google",
        profile: {
          name: profile.name,
          picture: profile.picture,
          locale: profile.locale,
        },
        ...tokenResponse,
      });
    } catch (error) {
      console.error("Ошибка входа через Google", error);
      const statusCode =
        error?.message && error.message.includes("credential") ? 400 : 401;
      return res
        .status(statusCode)
        .json({ message: error.message || "Не удалось подтвердить аккаунт Google" });
    }
  })
);

app.get(
  "/session",
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({
      user: sanitizeUser(req.user),
      tokenIssuedAt: req.auth?.iat ? req.auth.iat * 1000 : undefined,
      tokenExpiresAt: req.auth?.exp ? req.auth.exp * 1000 : undefined,
    });
  })
);

app.get(
  "/protected",
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ message: "Доступ разрешен", user: sanitizeUser(req.user) });
  })
);

app.post(
  "/token/refresh",
  authenticate,
  asyncHandler(async (req, res) => {
    const safeUser = sanitizeUser(req.user);
    const tokenResponse = buildTokenResponse(safeUser);
    if (req.auth) {
      revokeToken(req.auth);
    }

    res.json({
      message: "Токен обновлен",
      ...tokenResponse,
    });
  })
);

app.post(
  "/logout",
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.auth) {
      revokeToken(req.auth);
    }
    res.json({ message: "Выход выполнен, токен отозван" });
  })
);

app.use((req, res, next) => {
  res.status(404).json({ message: "Маршрут не найден" });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || "Ошибка сервера" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

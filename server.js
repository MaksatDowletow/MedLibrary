const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
require("dotenv").config();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/medlibrary";
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";
const GOOGLE_CLIENT_IDS = (process.env.GOOGLE_CLIENT_ID || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const GOOGLE_ALLOWED_HD = process.env.GOOGLE_ALLOWED_HD?.trim();
const SALT_ROUNDS = 12;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const USERS_FILE = process.env.USERS_FILE || path.join(DATA_DIR, "users.json");
const BOOKS_FILE = process.env.BOOKS_FILE || path.join(DATA_DIR, "books.json");
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
app.use(express.json());
app.use(morgan("tiny"));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много попыток. Попробуйте позже." },
});

app.use(["/register", "/login", "/auth/google"], authLimiter);

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

const generateToken = (user) =>
  jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );

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
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await userStore.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ message: "Пользователь не найден" });
    }
    req.user = user;
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
  "/register",
  asyncHandler(async (req, res) => {
    const { email = "", password = "" } = req.body || {};
    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Укажите корректный email" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Пароль должен содержать минимум 6 символов" });
    }

    const normalizedEmail = email.trim().toLowerCase();
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

    const user = await userStore.findByEmailWithPassword(email.trim().toLowerCase());
    if (!user) {
      return res.status(400).json({ message: "Неверный email или пароль" });
    }

    const passwordHash = user.passwordHash;
    const isMatch = await bcrypt.compare(password, passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Неверный email или пароль" });
    }

    const token = generateToken(sanitizeUser(user));
    return res.json({
      message: "Вход выполнен",
      token,
      user: sanitizeUser(user),
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
      const token = generateToken(safeUser);
      return res.json({
        message: "Вход выполнен через Google",
        token,
        user: safeUser,
        provider: "google",
        profile: {
          name: profile.name,
          picture: profile.picture,
          locale: profile.locale,
        },
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
    res.json({ user: sanitizeUser(req.user) });
  })
);

app.get(
  "/protected",
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ message: "Доступ разрешен", user: sanitizeUser(req.user) });
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

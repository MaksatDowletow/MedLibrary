const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
require("dotenv").config();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/medlibrary";
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";
const SALT_ROUNDS = 12;

mongoose.set("strictQuery", true);
mongoose
  .connect(MONGODB_URI, {
    autoIndex: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((error) => {
    console.error("MongoDB connection error", error);
    process.exit(1);
  });

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

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    email: this.email,
  };
};

const User = mongoose.model("User", userSchema);

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

app.use(["/register", "/login"], authLimiter);

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const validateEmail = (email = "") => /.+@.+\..+/.test(email);

const sanitizeUser = (user) => user?.toSafeObject();

const generateToken = (user) =>
  jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");
  if (!token) {
    return res.status(401).json({ message: "Токен отсутствует" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.userId);
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
  res.json({ status: "ok" });
});

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
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "Пользователь уже зарегистрирован" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ email: normalizedEmail, passwordHash });
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

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
      "+passwordHash"
    );
    if (!user) {
      return res.status(400).json({ message: "Неверный email или пароль" });
    }

    const isMatch = await user.comparePassword(password);
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

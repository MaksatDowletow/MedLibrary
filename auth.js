// Установите необходимые пакеты: express, sqlite3, bcrypt, jsonwebtoken, cookie-parser, dotenv
// npm install express sqlite3 bcrypt jsonwebtoken cookie-parser cors dotenv

require("dotenv").config();
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();
const db = new sqlite3.Database("users.db");
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key";

app.use(express.json());
app.use(cors({ origin: "https://maksatdowletow.github.io", credentials: true }));
app.use(cookieParser());

// Создание таблицы пользователей
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
)`);

// Регистрация пользователя
app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: "Заполните все поля" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", 
            [name, email, hashedPassword], (err) => {
            if (err) return res.status(400).json({ error: "Email уже зарегистрирован" });
            res.json({ message: "Регистрация успешна!" });
        });
    } catch (error) {
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// Авторизация пользователя
app.post("/login", (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Введите email и пароль" });
        }

        db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
            if (!user || !(await bcrypt.compare(password, user.password))) {
                return res.status(400).json({ error: "Неверный email или пароль" });
            }
            const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: "1h" });
            res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "None" });
            res.json({ message: "Вход выполнен!" });
        });
    } catch (error) {
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// Проверка авторизации
app.get("/profile", (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ error: "Не авторизован" });

        jwt.verify(token, SECRET_KEY, (err, decoded) => {
            if (err) return res.status(403).json({ error: "Неверный токен" });
            res.json({ message: "Доступ разрешен", user: decoded });
        });
    } catch (error) {
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// Выход пользователя
app.post("/logout", (req, res) => {
    res.clearCookie("token", { httpOnly: true, secure: true, sameSite: "None" });
    res.json({ message: "Вы вышли из системы" });
});

// Запуск сервера
app.listen(3000, () => console.log("Сервер запущен на порту 3000"));

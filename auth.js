const TOKEN_KEY = "medlibraryToken";

document.addEventListener("DOMContentLoaded", () => {
  const apiBase = resolveApiBase(document.body?.dataset.apiBase);
  if (document.body) {
    document.body.dataset.apiBase = apiBase;
  }

  initRegisterForm(apiBase);
  const refreshSession = initLoginForm(apiBase);
  initGoogleIdentity(apiBase, refreshSession);
});

function initRegisterForm(apiBase) {
  const form = document.getElementById("registerForm");
  if (!form) {
    return;
  }

  const emailInput = document.getElementById("register-email");
  const passwordInput = document.getElementById("register-password");
  const statusElement = document.getElementById("registerMessage");
  const endpoint = buildEndpoint(apiBase, "/register");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!isEmailValid(email)) {
      setStatus(statusElement, "Введите корректный email", "error");
      return;
    }

    if (password.length < 6) {
      setStatus(statusElement, "Пароль должен содержать минимум 6 символов", "error");
      return;
    }

    setStatus(statusElement, "Создаем аккаунт...", "pending");
    try {
      const data = await apiRequest(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setStatus(statusElement, data?.message || "Регистрация завершена", "success");
      form.reset();
    } catch (error) {
      setStatus(statusElement, error?.message || "Не удалось зарегистрироваться", "error");
    }
  });
}

function initLoginForm(apiBase) {
  const form = document.getElementById("loginForm");
  const statusElement = document.getElementById("loginMessage");
  const sessionStatus = document.getElementById("sessionStatus");
  const logoutButton = document.getElementById("logout");
  if (!form) {
    return () => {};
  }

  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const loginEndpoint = buildEndpoint(apiBase, "/login");
  const sessionEndpoint = buildEndpoint(apiBase, "/session");

  const refreshSession = async (showLoading = true) => {
    const token = safeGetToken();
    if (!token) {
      setStatus(sessionStatus, "Вы не авторизованы");
      if (logoutButton) {
        logoutButton.hidden = true;
      }
      return;
    }

    if (showLoading) {
      setStatus(sessionStatus, "Проверяем сессию...", "pending");
    }

    try {
      const data = await apiRequest(sessionEndpoint, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const email = data?.user?.email;
      setStatus(
        sessionStatus,
        email ? `Вы вошли как ${email}` : "Вход выполнен",
        "success"
      );
      if (logoutButton) {
        logoutButton.hidden = false;
      }
    } catch (error) {
      safeRemoveToken();
      setStatus(sessionStatus, error?.message || "Сессия недействительна", "error");
      if (logoutButton) {
        logoutButton.hidden = true;
      }
    }
  };

  logoutButton?.addEventListener("click", () => {
    safeRemoveToken();
    setStatus(sessionStatus, "Вы вышли из аккаунта");
    if (logoutButton) {
      logoutButton.hidden = true;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!isEmailValid(email)) {
      setStatus(statusElement, "Введите корректный email", "error");
      return;
    }

    setStatus(statusElement, "Авторизуемся...", "pending");
    try {
      const data = await apiRequest(loginEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (data?.token) {
        safeStoreToken(data.token);
      }
      setStatus(statusElement, data?.message || "Вход выполнен", "success");
      form.reset();
      refreshSession(false);
    } catch (error) {
      setStatus(statusElement, error?.message || "Не удалось войти", "error");
    }
  });

  refreshSession(false);
  return refreshSession;
}

function initGoogleIdentity(apiBase, refreshSession = () => {}) {
  const container = document.getElementById("google-signin-button");
  if (!container) {
    return;
  }

  const statusElement = document.getElementById("loginMessage");
  const sessionStatus = document.getElementById("sessionStatus");
  const logoutButton = document.getElementById("logout");
  const googleClientId = resolveGoogleClientId();

  if (!googleClientId) {
    container.textContent =
      "Укажите GOOGLE_CLIENT_ID и data-google-client-id, чтобы включить Google вход";
    container.classList.add("is-error");
    return;
  }

  const endpoint = buildEndpoint(apiBase, "/auth/google");

  const handleCredential = async (credential) => {
    if (!credential) {
      setStatus(statusElement, "Google не вернул credential", "error");
      return;
    }

    setStatus(statusElement, "Подтверждаем аккаунт Google...", "pending");
    try {
      const data = await apiRequest(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      if (data?.token) {
        safeStoreToken(data.token);
      }
      setStatus(statusElement, data?.message || "Вход выполнен через Google", "success");
      if (typeof refreshSession === "function") {
        refreshSession(false);
      } else if (sessionStatus) {
        const email = data?.user?.email;
        setStatus(
          sessionStatus,
          email ? `Вы вошли как ${email}` : "Вход выполнен через Google",
          "success"
        );
        if (logoutButton) {
          logoutButton.hidden = false;
        }
      }
    } catch (error) {
      setStatus(statusElement, error?.message || "Не удалось войти через Google", "error");
    }
  };

  const renderButton = () => {
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
    container.classList.remove("is-error");
    container.textContent = "";
    return true;
  };

  if (!renderButton()) {
    container.textContent =
      container.dataset.loadingText || "Подключаем Google Identity...";
    window.addEventListener(
      "load",
      () => {
        renderButton();
      },
      { once: true }
    );
  }
}

function setStatus(element, message, state) {
  if (!element) {
    return;
  }
  element.textContent = message || "";
  element.classList.remove("success", "error", "pending");
  if (state) {
    element.classList.add(state);
  }
}

function resolveApiBase(attributeBase = "") {
  const params = new URLSearchParams(window.location.search);
  const overrideBase = params.get("apiBase");
  let base = (overrideBase || attributeBase || "").trim();

  if (!base) {
    base = window.location.origin;
  }

  return base.replace(/\/$/, "");
}

function resolveGoogleClientId() {
  const params = new URLSearchParams(window.location.search);
  const override = params.get("googleClientId");
  if (override) {
    return override.trim();
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

function isEmailValid(email) {
  return /.+@.+\..+/.test(email);
}

function apiRequest(url, options = {}) {
  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort(), 10000);

  return fetch(url, { ...options, signal: controller.signal })
    .then(async (response) => {
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        const message =
          (payload && typeof payload === "object" && payload.message) ||
          (typeof payload === "string" && payload) ||
          "Запрос завершился ошибкой";
        throw new Error(message);
      }

      return payload;
    })
    .finally(() => {
      window.clearTimeout(timerId);
    });
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
    return window.localStorage?.getItem(TOKEN_KEY);
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

const TOKEN_KEY = "medlibraryToken";
const TOKEN_EXP_KEY = "medlibraryTokenExp";
const SESSION_REFRESH_OFFSET = 5 * 60 * 1000;

const tokenCleanupListeners = new Set();
let logoutTimerId = null;
let refreshTimerId = null;
const statusClearTimers = new WeakMap();

document.addEventListener("DOMContentLoaded", () => {
  const apiBase = resolveApiBase(document.body?.dataset.apiBase);
  if (document.body) {
    document.body.dataset.apiBase = apiBase;
  }

  initRegisterForm(apiBase);
  const refreshSession = initLoginForm(apiBase);
  initGoogleIdentity(apiBase, refreshSession);
  initSupportDialogs(apiBase);
});

function initRegisterForm(apiBase) {
  const form = document.getElementById("registerForm");
  if (!form) {
    return;
  }

  const emailInput = document.getElementById("register-email");
  const passwordInput = document.getElementById("register-password");
  const confirmInput = document.getElementById("register-password-confirm");
  const passwordRequirementList = document.getElementById("passwordRequirements");
  const confirmHint = document.getElementById("confirmHint");
  const submitButton = document.getElementById("register");
  const statusElement = document.getElementById("registerMessage");
  const endpoint = buildEndpoint(apiBase, "/register");

  initPasswordToggle(
    document.querySelector(".password-toggle[data-target~='register-password']"),
    [passwordInput, confirmInput]
  );

  const renderPasswordHints = () => {
    const password = passwordInput.value;
    const confirm = confirmInput?.value || "";
    const requirements = validatePassword(password);

    updateRequirementList(passwordRequirementList, requirements);

    if (confirmHint) {
      if (!confirm && password) {
        confirmHint.textContent = "Повторите пароль для подтверждения";
        confirmHint.classList.remove("error");
      } else if (!confirm && !password) {
        confirmHint.textContent = "";
        confirmHint.classList.remove("error");
      } else if (password === confirm) {
        confirmHint.textContent = "Пароли совпадают";
        confirmHint.classList.remove("error");
      } else {
        confirmHint.textContent = "Пароли не совпадают";
        confirmHint.classList.add("error");
      }
    }

    if (submitButton) {
      const canSubmit =
        isEmailValid(emailInput.value.trim()) &&
        requirements.isValid &&
        password === confirm &&
        password.length > 0;
      submitButton.disabled = !canSubmit;
    }
  };

  passwordInput.addEventListener("input", () => {
    renderPasswordHints();
  });

  confirmInput?.addEventListener("input", () => {
    renderPasswordHints();
  });

  emailInput.addEventListener("input", () => {
    renderPasswordHints();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const confirm = confirmInput?.value.trim() || "";
    const passwordResult = validatePassword(password);

    if (!isEmailValid(email)) {
      setStatus(statusElement, "Введите корректный email", "error");
      return;
    }

    if (!passwordResult.isValid) {
      setStatus(
        statusElement,
        "Пароль должен содержать минимум 6 символов, цифру, букву и спецсимвол",
        "error"
      );
      return;
    }

    if (password !== confirm) {
      setStatus(statusElement, "Пароли должны совпадать", "error");
      return;
    }

    setStatus(statusElement, "Идёт отправка…", "pending");
    setButtonLoading(submitButton, true);
    try {
      const data = await apiRequest(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setStatus(
        statusElement,
        data?.message || "Регистрация завершена",
        "success",
        { autoClear: true }
      );
      form.reset();
      renderPasswordHints();
    } catch (error) {
      setStatus(statusElement, error?.message || "Не удалось зарегистрироваться", "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });

  renderPasswordHints();
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
  const refreshEndpoint = buildEndpoint(apiBase, "/token/refresh");
  const logoutEndpoint = buildEndpoint(apiBase, "/logout");

  initPasswordToggle(
    document.querySelector(".password-toggle[data-target~='login-password']"),
    [passwordInput]
  );

  const expireSession = (message) => {
    safeRemoveToken();
    setStatus(sessionStatus, message || "Срок действия сессии истек. Войдите снова.", "error");
    if (logoutButton) {
      logoutButton.hidden = true;
    }
  };

  const scheduleSessionTimers = (token) => {
    clearSessionTimers();
    const expiresAt = getTokenExpiresAt(token);
    if (!expiresAt) {
      return;
    }

    const timeLeft = expiresAt - Date.now();
    if (timeLeft <= 0) {
      expireSession("Срок действия сессии истек. Войдите снова.");
      return;
    }

    logoutTimerId = window.setTimeout(() => {
      expireSession("Срок действия сессии истек. Войдите снова.");
    }, timeLeft);

    const refreshDelay = Math.max(
      Math.min(timeLeft - SESSION_REFRESH_OFFSET, timeLeft - 5000),
      0
    );

    refreshTimerId = window.setTimeout(() => {
      refreshToken();
    }, refreshDelay);
  };

  const refreshToken = async () => {
    const token = safeGetToken();
    if (!token) {
      return;
    }

    setStatus(sessionStatus, "Обновляем сессию...", "pending");
    try {
      const data = await apiRequest(refreshEndpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data?.token) {
        safeStoreToken(data.token, data.expiresAt);
        scheduleSessionTimers(data.token);
      }
      setStatus(sessionStatus, "Сессия обновлена", "success");
    } catch (error) {
      expireSession(error?.message || "Не удалось обновить сессию");
    }
  };

  registerTokenCleanup(() => {
    clearSessionTimers();
    if (sessionStatus) {
      if (!sessionStatus.classList.contains("error")) {
        setStatus(sessionStatus, "Вы не авторизованы");
      }
    }
    if (logoutButton) {
      logoutButton.hidden = true;
    }
  });

  const refreshSession = async (showLoading = true) => {
    const token = safeGetToken();
    if (!token) {
      setStatus(sessionStatus, "Вы не авторизованы");
      if (logoutButton) {
        logoutButton.hidden = true;
      }
      return;
    }

    const expiresAt = getTokenExpiresAt(token);
    if (expiresAt && expiresAt <= Date.now()) {
      expireSession("Срок действия сессии истек. Войдите снова.");
      return;
    }

    if (expiresAt) {
      safeStoreToken(token, expiresAt);
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
      if (data?.tokenExpiresAt) {
        safeStoreToken(token, data.tokenExpiresAt);
      }
      setStatus(
        sessionStatus,
        email ? `Вы вошли как ${email}` : "Вход выполнен",
        "success"
      );
      if (logoutButton) {
        logoutButton.hidden = false;
      }
      scheduleSessionTimers(token);
    } catch (error) {
      safeRemoveToken();
      setStatus(sessionStatus, error?.message || "Сессия недействительна", "error");
      if (logoutButton) {
        logoutButton.hidden = true;
      }
    }
  };

  logoutButton?.addEventListener("click", async () => {
    const token = safeGetToken();
    safeRemoveToken();
    setStatus(sessionStatus, "Вы вышли из аккаунта");
    if (logoutButton) {
      logoutButton.hidden = true;
    }
    if (!token) {
      return;
    }
    try {
      await apiRequest(logoutEndpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.warn("Не удалось отозвать токен на сервере", error);
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

    setStatus(statusElement, "Идёт отправка…", "pending");
    setButtonLoading(loginButton, true);
    try {
      const data = await apiRequest(loginEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (data?.token) {
        safeStoreToken(data.token, data.expiresAt);
        scheduleSessionTimers(data.token);
      }
      setStatus(statusElement, data?.message || "Вход выполнен", "success", { autoClear: true });
      form.reset();
      refreshSession(false);
    } catch (error) {
      setStatus(statusElement, error?.message || "Не удалось войти", "error");
    } finally {
      setButtonLoading(loginButton, false);
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
        safeStoreToken(data.token, data.expiresAt);
        scheduleSessionTimers(data.token);
      }
      setStatus(
        statusElement,
        data?.message || "Вход выполнен через Google",
        "success",
        { autoClear: true }
      );
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
    attachGoogleScriptHandlers(container, renderButton);
  }
}

function initSupportDialogs(apiBase) {
  const forgotModal = createModalController(
    document.getElementById("forgotPasswordModal")
  );
  const resendModal = createModalController(
    document.getElementById("resendVerificationModal")
  );

  document
    .getElementById("forgotPasswordTrigger")
    ?.addEventListener("click", () => forgotModal.open());
  document
    .getElementById("resendEmailTrigger")
    ?.addEventListener("click", () => resendModal.open());

  initRecoveryForm({
    formId: "forgotPasswordForm",
    emailInputId: "forgot-password-email",
    submitId: "forgot-password-submit",
    statusId: "forgotPasswordMessage",
    endpoint: buildEndpoint(apiBase, "/password/forgot"),
    successMessage:
      "Если email зарегистрирован, мы отправили ссылку для смены пароля.",
    modalController: forgotModal,
  });

  initRecoveryForm({
    formId: "resendVerificationForm",
    emailInputId: "resend-email",
    submitId: "resend-email-submit",
    statusId: "resendEmailMessage",
    endpoint: buildEndpoint(apiBase, "/email/resend"),
    successMessage:
      "Если аккаунт зарегистрирован, письмо отправлено повторно.",
    modalController: resendModal,
  });
}

function initRecoveryForm(options) {
  const {
    formId,
    emailInputId,
    submitId,
    statusId,
    endpoint,
    successMessage,
    modalController,
  } = options;

  const form = document.getElementById(formId);
  if (!form) {
    return;
  }

  const emailInput = document.getElementById(emailInputId);
  const submitButton = document.getElementById(submitId);
  const statusElement = document.getElementById(statusId);

  modalController?.onOpen?.(() => {
    clearStatus(statusElement);
    form.reset();
    emailInput?.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput?.value.trim();
    if (!isEmailValid(email)) {
      setStatus(statusElement, "Введите корректный email", "error");
      return;
    }

    setStatus(statusElement, "Идёт отправка…", "pending");
    setButtonLoading(submitButton, true);
    try {
      const data = await apiRequest(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(
        statusElement,
        data?.message || successMessage || "Запрос отправлен",
        "success",
        { autoClear: true }
      );
      form.reset();
      window.setTimeout(() => modalController?.close?.(), 1400);
    } catch (error) {
      setStatus(
        statusElement,
        error?.message || "Не удалось отправить запрос",
        "error"
      );
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}

function clearStatus(element) {
  if (!element) {
    return;
  }
  const timerId = statusClearTimers.get(element);
  if (timerId) {
    window.clearTimeout(timerId);
    statusClearTimers.delete(element);
  }
  element.textContent = "";
  element.classList.remove("success", "error", "pending");
}

function validatePassword(password = "") {
  const length = password.length >= 6;
  const digit = /\d/.test(password);
  const letter = /\p{L}/u.test(password);
  const special = /[^\p{L}\d]/u.test(password);

  return {
    length,
    digit,
    letter,
    special,
    isValid: length && digit && letter && special,
  };
}

function updateRequirementList(listElement, requirements) {
  if (!listElement) {
    return;
  }

  Array.from(listElement.querySelectorAll("[data-requirement]"))
    .filter((item) => item.dataset.requirement)
    .forEach((item) => {
      const key = item.dataset.requirement;
      const isValid = Boolean(requirements?.[key]);
      item.classList.toggle("is-valid", isValid);
    });
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

function attachGoogleScriptHandlers(container, onReady) {
  const script = document.querySelector(
    'script[src*="accounts.google.com/gsi/client"]'
  );
  if (!script || !container) {
    return;
  }

  const showError = () => {
    container.textContent =
      container.dataset.errorText ||
      "Не удалось загрузить Google Identity. Проверьте соединение и разрешите accounts.google.com";
    container.classList.add("google-signin-placeholder", "is-error");
  };

  const handleLoad = () => {
    if (typeof onReady === "function" && window.google?.accounts?.id) {
      onReady();
      return;
    }
    showError();
  };

  script.addEventListener("load", handleLoad, { once: true });
  script.addEventListener("error", showError, { once: true });

  if (script.readyState === "complete") {
    setTimeout(handleLoad, 0);
  }
}

function decodeTokenPayload(token = "") {
  try {
    const [, payload = ""] = token.split(".");
    if (!payload) {
      return null;
    }
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (error) {
    console.warn("Не удалось декодировать токен", error);
    return null;
  }
}

function getTokenExpiresAt(token = "") {
  const payload = decodeTokenPayload(token);
  if (payload?.exp) {
    return payload.exp * 1000;
  }

  try {
    const stored = window.localStorage?.getItem(TOKEN_EXP_KEY);
    if (stored) {
      const parsed = Number(stored);
      return Number.isNaN(parsed) ? null : parsed;
    }
  } catch (error) {
    console.error("Не удалось получить срок действия токена", error);
  }

  return null;
}

function clearSessionTimers() {
  if (logoutTimerId) {
    window.clearTimeout(logoutTimerId);
    logoutTimerId = null;
  }
  if (refreshTimerId) {
    window.clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
}

function registerTokenCleanup(listener) {
  if (typeof listener === "function") {
    tokenCleanupListeners.add(listener);
  }
  return () => tokenCleanupListeners.delete(listener);
}

function notifyTokenCleanup() {
  tokenCleanupListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error("Ошибка в обработчике очистки токена", error);
    }
  });
}

function buildEndpoint(apiBase, path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return apiBase ? `${apiBase}${normalizedPath}` : normalizedPath;
}

function isEmailValid(email) {
  return /.+@.+\..+/.test(email);
}

async function apiRequest(url, options = {}) {
  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort("timeout"), 10000);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        (payload && typeof payload === "object" && payload.message) ||
        (typeof payload === "string" && payload) ||
        "Запрос завершился ошибкой";
      if (response.status === 401) {
        safeRemoveToken();
        const error = new Error(
          `${message}. Пожалуйста, войдите снова для продолжения работы.`
        );
        error.status = 401;
        throw error;
      }
      throw new Error(message);
    }

    return payload;
  } catch (error) {
    if (controller.signal.aborted || error?.name === "AbortError") {
      if (controller.signal.reason === "timeout") {
        const timeoutError = new Error(
          "Превышено время ожидания запроса. Проверьте подключение и повторите попытку."
        );
        timeoutError.code = "TIMEOUT";
        throw timeoutError;
      }
      const abortError = new Error(
        "Запрос был отменён. Попробуйте ещё раз после проверки соединения."
      );
      abortError.code = "ABORT";
      throw abortError;
    }
    throw error instanceof Error ? error : new Error("Не удалось выполнить запрос");
  } finally {
    window.clearTimeout(timerId);
  }
}

function setStatus(element, message, state, options = {}) {
  if (!element) {
    return;
  }
  clearStatus(element);
  element.textContent = message || "";
  element.classList.remove("success", "error", "pending");
  if (state) {
    element.classList.add(state);
  }
  if (options.autoClear && state === "success") {
    const timerId = window.setTimeout(() => clearStatus(element), 3500);
    statusClearTimers.set(element, timerId);
  }
}

function setButtonLoading(button, isLoading, loadingText = "Идёт отправка…") {
  if (!button) {
    return;
  }

  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.dataset.originalDisabled = String(button.disabled);
    button.disabled = true;
    button.classList.add("is-loading");
    button.textContent = loadingText;
    return;
  }

  const wasDisabled = button.dataset.originalDisabled === "true";
  button.classList.remove("is-loading");
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
  }
  button.disabled = wasDisabled;
  delete button.dataset.originalDisabled;
  delete button.dataset.originalText;
}

function createModalController(modalElement) {
  if (!modalElement) {
    return {
      open: () => {},
      close: () => {},
      onOpen: () => {},
      onClose: () => {},
    };
  }

  const openListeners = new Set();
  const closeListeners = new Set();
  const dialog = modalElement.querySelector(".modal__dialog");
  const closeButton = modalElement.querySelector("[data-modal-close]");

  const emit = (listeners) => {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("Ошибка в обработчике модалки", error);
      }
    });
  };

  const close = () => {
    if (modalElement.hidden) {
      return;
    }
    modalElement.hidden = true;
    modalElement.dataset.open = "false";
    document.removeEventListener("keydown", handleEscape);
    emit(closeListeners);
  };

  const handleEscape = (event) => {
    if (event.key === "Escape") {
      close();
    }
  };

  const handleBackdropClick = (event) => {
    if (event.target === modalElement) {
      close();
    }
  };

  const open = () => {
    modalElement.hidden = false;
    modalElement.dataset.open = "true";
    document.addEventListener("keydown", handleEscape);
    emit(openListeners);
    const focusTarget =
      dialog?.querySelector("input, button, [tabindex]") || dialog;
    focusTarget?.focus?.();
  };

  modalElement.addEventListener("click", handleBackdropClick);
  closeButton?.addEventListener("click", close);

  return {
    open,
    close,
    onOpen(listener) {
      if (typeof listener === "function") {
        openListeners.add(listener);
      }
      return () => openListeners.delete(listener);
    },
    onClose(listener) {
      if (typeof listener === "function") {
        closeListeners.add(listener);
      }
      return () => closeListeners.delete(listener);
    },
  };
}

function initPasswordToggle(toggleButton, inputs = []) {
  if (!toggleButton || !inputs.length) {
    return;
  }

  const handleToggle = () => {
    const shouldShow = toggleButton.dataset.visible !== "true";
    inputs.forEach((input) => {
      if (!input) {
        return;
      }
      input.type = shouldShow ? "text" : "password";
    });
    toggleButton.dataset.visible = shouldShow ? "true" : "false";
    toggleButton.textContent = shouldShow ? "Скрыть пароль" : "Показать пароль";
  };

  toggleButton.addEventListener("click", handleToggle);
}

function safeStoreToken(token, expiresAt) {
  try {
    window.localStorage?.setItem(TOKEN_KEY, token);
    const expiration = expiresAt || getTokenExpiresAt(token);
    if (expiration) {
      window.localStorage?.setItem(TOKEN_EXP_KEY, String(expiration));
    } else {
      window.localStorage?.removeItem(TOKEN_EXP_KEY);
    }
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
  clearSessionTimers();
  try {
    window.localStorage?.removeItem(TOKEN_KEY);
    window.localStorage?.removeItem(TOKEN_EXP_KEY);
  } catch (error) {
    console.error("Не удалось удалить токен", error);
  }
  notifyTokenCleanup();
}

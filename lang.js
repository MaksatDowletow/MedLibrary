
function setLanguage(lang) {
  document.querySelectorAll('[data-lang]').forEach(element => {
    if (element.dataset.lang === lang) {
      element.hidden = false;
    } else {
      element.hidden = true;
    }
  });
}

// Установить язык по умолчанию (например, русский)
setLanguage('tm');

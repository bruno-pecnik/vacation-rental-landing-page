// ---------------------------------------------------------------------------
// Section switching: show exactly one <section class="page-section"> at a
// time, driven by the nav links and the URL hash (so links are shareable
// and the browser back/forward buttons work as expected).
// ---------------------------------------------------------------------------
(function () {
  const SECTION_IDS = ["apartman", "okolica", "novalja", "book-direct"];
  const DEFAULT_SECTION = "apartman";

  function showSection(id) {
    if (!SECTION_IDS.includes(id)) {
      id = DEFAULT_SECTION;
    }

    document.querySelectorAll(".page-section").forEach((section) => {
      section.hidden = section.id !== id;
    });

    document.querySelectorAll(".nav-link").forEach((link) => {
      const isActive = link.dataset.section === id;
      link.classList.toggle("active", isActive);
    });
  }

  function sectionFromHash() {
    return window.location.hash.replace("#", "");
  }

  function init() {
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const id = link.dataset.section;
        showSection(id);
        history.pushState(null, "", "#" + id);
      });
    });

    window.addEventListener("popstate", () => {
      showSection(sectionFromHash());
    });

    showSection(sectionFromHash());
  }

  init();
})();

// ---------------------------------------------------------------------------
// Language switching: swap text on every [data-i18n] element using the
// dictionaries in translations.js, remember the choice in localStorage,
// and set <html lang="..."> to the correct BCP-47 code (note "cz" is our
// own internal key matching the flag/country, but the real ISO 639-1
// language code for Czech is "cs" — that's what the lang attribute needs).
// ---------------------------------------------------------------------------
(function () {
  const HTML_LANG_CODE = {
    en: "en",
    it: "it",
    de: "de",
    pl: "pl",
    cz: "cs",
  };

  const STORAGE_KEY = "preferredLang";

  function applyLanguage(lang) {
    const dict = (window.translations && window.translations[lang]) || window.translations.en;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });

    document.querySelectorAll(".lang-switcher button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });

    document.documentElement.lang = HTML_LANG_CODE[lang] || "en";

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // localStorage can throw in some private-browsing contexts; not critical.
    }
  }

  function init() {
    document.querySelectorAll(".lang-switcher button").forEach((btn) => {
      btn.addEventListener("click", () => applyLanguage(btn.dataset.lang));
    });

    let savedLang = "en";
    try {
      savedLang = localStorage.getItem(STORAGE_KEY) || "en";
    } catch (e) {
      // ignore
    }

    applyLanguage(savedLang);
  }

  init();
})();

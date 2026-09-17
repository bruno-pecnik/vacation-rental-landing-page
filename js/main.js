// ---------------------------------------------------------------------------
// Section switching: show exactly one <section class="page-section"> at a
// time, driven by the nav links and the URL hash (so links are shareable
// and the browser back/forward buttons work as expected).
// ---------------------------------------------------------------------------
(function () {
  const SECTION_IDS = ["apartman", "novalja", "host"];
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


// ---------------------------------------------------------------------------
// Guest reviews carousel: shows 3 real guest reviews at a time out of the
// full set, with prev/next arrows that rotate the window by one review.
// ---------------------------------------------------------------------------
(function () {
  const REVIEWS = [
    {
      stars: 5,
      quote: "Everything was great. Quiet location, next to Babe Beach \u2014 about 12 minutes on foot. Great owners.",
      author: "Andrej, Slovakia",
    },
    {
      stars: 5,
      quote: "A few minutes' walk from the sea, with a choice of beaches nearby \u2014 sandy, pebble, rocky, even dog-friendly. The pool is excellent and cleaned every day.",
      author: "Angerman, Hungary",
    },
    {
      stars: 5,
      quote: "We stayed as a group of four and had a wonderful time. The owner was very friendly and helpful, Uber and Bolt are easy to get, and the pool was a big plus.",
      author: "Manuel, Italy",
    },
    {
      stars: 5,
      quote: "Absolutely perfect accommodation!",
      author: "Radek, Czech Republic",
    },
    {
      stars: 5,
      quote: null,
      author: "Artem, Ukraine",
    },
  ];

  const VISIBLE = 3;
  let start = 0;

  function renderReviews() {
    const grid = document.getElementById("reviews-grid");
    if (!grid) return;

    grid.innerHTML = "";

    for (let i = 0; i < VISIBLE; i++) {
      const review = REVIEWS[(start + i) % REVIEWS.length];

      const card = document.createElement("div");
      card.className = "review-card";

      const stars = document.createElement("p");
      stars.className = "review-card__stars";
      stars.setAttribute("aria-hidden", "true");
      stars.textContent = "\u2605".repeat(review.stars);
      card.appendChild(stars);

      const quote = document.createElement("p");
      quote.className = "review-card__quote";
      quote.textContent = review.quote
        ? "\u201C" + review.quote + "\u201D"
        : "Rated 10/10 \u2014 Exceptional.";
      card.appendChild(quote);

      const author = document.createElement("p");
      author.className = "review-card__author";
      author.textContent = review.author;
      card.appendChild(author);

      grid.appendChild(card);
    }
  }

  const TRANSITION_MS = 280;
  let animating = false;

  function goTo(direction) {
    if (animating) return;

    const grid = document.getElementById("reviews-grid");
    const prevBtn = document.getElementById("reviews-prev");
    const nextBtn = document.getElementById("reviews-next");
    if (!grid) return;

    animating = true;
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;

    // Slide out in the direction of travel, swap the content while it's
    // invisible, then slide the new set in from the opposite side.
    grid.style.setProperty("--reviews-slide", direction > 0 ? "-14px" : "14px");
    grid.classList.add("reviews__grid--transitioning");

    window.setTimeout(() => {
      start = (start + direction + REVIEWS.length) % REVIEWS.length;
      renderReviews();

      grid.style.setProperty("--reviews-slide", direction > 0 ? "14px" : "-14px");

      // Force layout so the browser registers the reversed offset before
      // transitioning back to 0, instead of collapsing the two into one.
      // eslint-disable-next-line no-unused-expressions
      grid.offsetHeight;

      grid.classList.remove("reviews__grid--transitioning");

      window.setTimeout(() => {
        animating = false;
        if (prevBtn) prevBtn.disabled = false;
        if (nextBtn) nextBtn.disabled = false;
      }, TRANSITION_MS);
    }, TRANSITION_MS);
  }

  function init() {
    const grid = document.getElementById("reviews-grid");
    if (!grid) return;

    const prevBtn = document.getElementById("reviews-prev");
    const nextBtn = document.getElementById("reviews-next");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => goTo(-1));
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => goTo(1));
    }

    renderReviews();
  }

  init();
})();

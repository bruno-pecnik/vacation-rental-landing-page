// ---------------------------------------------------------------------------
// Section switching: show exactly one <section class="page-section"> at a
// time, driven by the nav links and the URL hash (so links are shareable
// and the browser back/forward buttons work as expected).
// ---------------------------------------------------------------------------
(function () {
  const SECTION_IDS = ["apartman", "novalja", "host"];
  const DEFAULT_SECTION = "apartman";

  // Stop the browser from restoring a mid-page scroll position on reload
  // or back/forward navigation — every visit should land at the top.
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

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
  const TRANSITION_MS = 450;
  const SLIDE_PX = 36;

  let start = 0;
  let animating = false;
  let currentGrid = null;

  function buildGrid(startIndex) {
    const grid = document.createElement("div");
    grid.className = "reviews__grid";

    for (let i = 0; i < VISIBLE; i++) {
      const review = REVIEWS[(startIndex + i) % REVIEWS.length];

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

    return grid;
  }

  // Rather than swapping content in place, a fresh set of 3 cards slides
  // and fades in from the direction of travel while the old set slides
  // and fades out the opposite way — a real, visible motion instead of a
  // flat cross-fade. Both sets are absolutely positioned inside a
  // fixed-height viewport, so the page never jumps.
  function goTo(direction, viewport, prevBtn, nextBtn) {
    if (animating || !currentGrid) return;
    animating = true;
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;

    const nextStart = (start + direction + REVIEWS.length) % REVIEWS.length;
    const incoming = buildGrid(nextStart);

    incoming.style.transform = "translateX(" + (direction > 0 ? SLIDE_PX : -SLIDE_PX) + "px)";
    incoming.style.opacity = "0";
    viewport.appendChild(incoming);

    // Force layout so the browser registers the starting position above
    // before we transition both sets to their resting/exit state.
    // eslint-disable-next-line no-unused-expressions
    incoming.offsetHeight;

    const outgoing = currentGrid;
    outgoing.style.transform = "translateX(" + (direction > 0 ? -SLIDE_PX : SLIDE_PX) + "px)";
    outgoing.style.opacity = "0";

    incoming.style.transform = "translateX(0)";
    incoming.style.opacity = "1";

    currentGrid = incoming;
    start = nextStart;

    window.setTimeout(() => {
      if (outgoing.parentNode) outgoing.parentNode.removeChild(outgoing);
      animating = false;
      if (prevBtn) prevBtn.disabled = false;
      if (nextBtn) nextBtn.disabled = false;
    }, TRANSITION_MS);
  }

  function init() {
    const viewport = document.getElementById("reviews-viewport");
    if (!viewport) return;

    const prevBtn = document.getElementById("reviews-prev");
    const nextBtn = document.getElementById("reviews-next");

    currentGrid = buildGrid(start);
    viewport.appendChild(currentGrid);

    if (prevBtn) {
      prevBtn.addEventListener("click", () => goTo(-1, viewport, prevBtn, nextBtn));
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => goTo(1, viewport, prevBtn, nextBtn));
    }
  }

  init();
})();

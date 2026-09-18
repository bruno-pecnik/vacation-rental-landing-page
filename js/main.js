// ---------------------------------------------------------------------------
// Section switching: show exactly one <section class="page-section"> at a
// time, driven by the nav links and the URL hash (so links are shareable
// and the browser back/forward buttons work as expected).
// ---------------------------------------------------------------------------
(function () {
  const SECTION_IDS = ["apartman", "novalja", "host"];
  const DEFAULT_SECTION = "apartman";

  // (Scroll restoration is disabled by an inline script at the very top
  // of <head>, which runs before this file — see index.html.)

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

    // Lets other modules (the reviews carousel, which renders its text
    // dynamically rather than through data-i18n elements) react to a
    // language switch too.
    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
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
// Guest reviews: a single "spotlight" testimonial at a time (rather than a
// row of small cards), with prev/next arrows and a row of clickable
// pagination dots that jump straight to any review.
// ---------------------------------------------------------------------------
(function () {
  // Only the stable bits live here (which review, how many stars, the
  // en fallback quote flag) — the actual quote/author text is
  // translated per language in translations.js, looked up by id, so the
  // carousel reads in whichever language is currently selected.
  const REVIEWS = [
    { id: "andrej", stars: 5 },
    { id: "angerman", stars: 5 },
    { id: "manuel", stars: 5 },
    { id: "radek", stars: 5 },
    { id: "artem", stars: 5, noQuote: true },
  ];

  const STORAGE_KEY = "preferredLang";

  function currentDict() {
    let lang = "en";
    try {
      lang = localStorage.getItem(STORAGE_KEY) || "en";
    } catch (e) {
      // ignore
    }
    return (window.translations && window.translations[lang]) || (window.translations && window.translations.en) || {};
  }

  function quoteTextFor(review, dict) {
    if (review.noQuote) {
      return dict.review_fallback_quote || "Rated 10/10 \u2014 Exceptional.";
    }
    const raw = dict["review_" + review.id + "_quote"];
    return raw ? "\u201C" + raw + "\u201D" : "";
  }

  function authorTextFor(review, dict) {
    return dict["review_" + review.id + "_author"] || "";
  }

  const TRANSITION_MS = 500;
  const SLIDE_PX = 60;

  let current = 0;
  let animating = false;
  let currentSlide = null;
  const dotEls = [];

  function buildSlide(index) {
    const review = REVIEWS[index];
    const dict = currentDict();

    const slide = document.createElement("div");
    slide.className = "review-spotlight";

    const inner = document.createElement("div");
    inner.className = "review-spotlight__inner";
    slide.appendChild(inner);

    const stars = document.createElement("p");
    stars.className = "review-spotlight__stars";
    stars.setAttribute("aria-hidden", "true");
    stars.textContent = "\u2605".repeat(review.stars);
    inner.appendChild(stars);

    const quote = document.createElement("p");
    quote.className = "review-spotlight__quote";
    quote.textContent = quoteTextFor(review, dict);
    inner.appendChild(quote);

    const author = document.createElement("p");
    author.className = "review-spotlight__author";
    author.textContent = authorTextFor(review, dict);
    inner.appendChild(author);

    return slide;
  }

  function updateDots(index) {
    dotEls.forEach((dot, i) => {
      const isActive = i === index;
      dot.classList.toggle("active", isActive);
      dot.setAttribute("aria-current", isActive ? "true" : "false");
    });
  }

  // Rather than swapping content in place, the incoming slide slides and
  // fades in from the direction of travel while the outgoing one slides
  // and fades out the opposite way — a real, visible motion instead of a
  // flat cross-fade. Both slides are absolutely positioned inside a
  // fixed-height viewport, so the page never jumps.
  function goTo(targetIndex, direction, viewport, prevBtn, nextBtn) {
    if (animating || !currentSlide || targetIndex === current) return;
    animating = true;
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;

    const incoming = buildSlide(targetIndex);

    incoming.style.transform = "translateX(" + (direction > 0 ? SLIDE_PX : -SLIDE_PX) + "px)";
    incoming.style.opacity = "0";
    viewport.appendChild(incoming);

    // Force layout so the browser registers the starting position above
    // before we transition both slides to their resting/exit state.
    // eslint-disable-next-line no-unused-expressions
    incoming.offsetHeight;

    const outgoing = currentSlide;
    outgoing.style.transform = "translateX(" + (direction > 0 ? -SLIDE_PX : SLIDE_PX) + "px)";
    outgoing.style.opacity = "0";

    incoming.style.transform = "translateX(0)";
    incoming.style.opacity = "1";

    currentSlide = incoming;
    current = targetIndex;
    updateDots(current);

    window.setTimeout(() => {
      if (outgoing.parentNode) outgoing.parentNode.removeChild(outgoing);
      animating = false;
      if (prevBtn) prevBtn.disabled = false;
      if (nextBtn) nextBtn.disabled = false;
    }, TRANSITION_MS);
  }

  function step(delta, viewport, prevBtn, nextBtn) {
    const targetIndex = (current + delta + REVIEWS.length) % REVIEWS.length;
    goTo(targetIndex, delta, viewport, prevBtn, nextBtn);
  }

  const AUTO_ADVANCE_MS = 6000;
  let autoAdvanceTimer = null;

  function init() {
    const viewport = document.getElementById("reviews-viewport");
    const carousel = document.querySelector(".reviews__carousel");
    const dotsContainer = document.getElementById("reviews-dots");
    if (!viewport) return;

    const prevBtn = document.getElementById("reviews-prev");
    const nextBtn = document.getElementById("reviews-next");

    currentSlide = buildSlide(current);
    viewport.appendChild(currentSlide);

    // Switching languages doesn't rebuild the slide (that would restart
    // its slide/fade animation) — it just swaps the quote/author text
    // inside whichever slide is currently showing.
    document.addEventListener("langchange", () => {
      if (!currentSlide) return;
      const dict = currentDict();
      const review = REVIEWS[current];
      const quoteEl = currentSlide.querySelector(".review-spotlight__quote");
      const authorEl = currentSlide.querySelector(".review-spotlight__author");
      if (quoteEl) quoteEl.textContent = quoteTextFor(review, dict);
      if (authorEl) authorEl.textContent = authorTextFor(review, dict);
    });

    function stopAutoAdvance() {
      if (autoAdvanceTimer) {
        window.clearInterval(autoAdvanceTimer);
        autoAdvanceTimer = null;
      }
    }

    function startAutoAdvance() {
      stopAutoAdvance();
      autoAdvanceTimer = window.setInterval(() => {
        step(1, viewport, prevBtn, nextBtn);
      }, AUTO_ADVANCE_MS);
    }

    function restartAutoAdvance() {
      // A manual click shouldn't fight the next auto-advance tick — give
      // the visitor a full interval before it resumes on its own.
      startAutoAdvance();
    }

    if (dotsContainer) {
      REVIEWS.forEach((review, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "reviews__dot" + (i === current ? " active" : "");
        dot.setAttribute("role", "tab");
        dot.setAttribute("aria-current", i === current ? "true" : "false");
        dot.setAttribute("aria-label", "Show review " + (i + 1) + " of " + REVIEWS.length);
        dot.addEventListener("click", () => {
          if (i === current) return;
          const direction = i > current ? 1 : -1;
          goTo(i, direction, viewport, prevBtn, nextBtn);
          restartAutoAdvance();
        });
        dotsContainer.appendChild(dot);
        dotEls.push(dot);
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        step(-1, viewport, prevBtn, nextBtn);
        restartAutoAdvance();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        step(1, viewport, prevBtn, nextBtn);
        restartAutoAdvance();
      });
    }

    if (carousel) {
      carousel.addEventListener("mouseenter", stopAutoAdvance);
      carousel.addEventListener("mouseleave", startAutoAdvance);
      carousel.addEventListener("focusin", stopAutoAdvance);
      carousel.addEventListener("focusout", startAutoAdvance);
    }

    // Don't auto-advance testimonials for a visitor who's asked for
    // reduced motion.
    const prefersReducedMotion = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

    if (!prefersReducedMotion) {
      startAutoAdvance();
    }
  }

  init();
})();

// ---------------------------------------------------------------------------
// Mobile photo carousel: six small photos in a 2-column grid read poorly on
// a phone, so below the 640px breakpoint .gallery becomes a native
// scroll-snap row (touch-swipe support comes free from the browser) and
// this just adds dot pagination plus a gentle auto-advance on top. On
// wider screens .gallery stays a plain grid and this quietly no-ops.
// ---------------------------------------------------------------------------
(function () {
  const AUTO_ADVANCE_MS = 4500;
  const MOBILE_QUERY = "(max-width: 640px)";
  let autoAdvanceTimer = null;
  let currentIndex = 0;

  function init() {
    const gallery = document.getElementById("gallery");
    const dotsContainer = document.getElementById("gallery-dots");
    if (!gallery) return;

    const slides = Array.from(gallery.querySelectorAll("img"));
    const slideCount = slides.length;
    if (slideCount === 0) return;

    const dotEls = [];
    const isMobile = () =>
      window.matchMedia ? window.matchMedia(MOBILE_QUERY).matches : false;

    function updateActiveDot(index) {
      dotEls.forEach((dot, i) => {
        const isActive = i === index;
        dot.classList.toggle("active", isActive);
        dot.setAttribute("aria-current", isActive ? "true" : "false");
      });
    }

    function goTo(index, behavior) {
      const clamped = (index + slideCount) % slideCount;
      const slide = slides[clamped];
      if (!slide) return;
      const targetLeft =
        slide.getBoundingClientRect().left -
        gallery.getBoundingClientRect().left +
        gallery.scrollLeft;
      gallery.scrollTo({ left: targetLeft, behavior: behavior || "smooth" });
      currentIndex = clamped;
      updateActiveDot(currentIndex);
    }

    function step(delta) {
      const proposed = currentIndex + delta;
      const wraps = proposed < 0 || proposed >= slideCount;
      goTo(proposed, wraps ? "auto" : "smooth");
    }

    if (dotsContainer) {
      slides.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "gallery-dots__dot" + (i === 0 ? " active" : "");
        dot.setAttribute("role", "tab");
        dot.setAttribute("aria-current", i === 0 ? "true" : "false");
        dot.setAttribute("aria-label", "Show photo " + (i + 1) + " of " + slideCount);
        dot.addEventListener("click", () => {
          if (i === currentIndex) return;
          goTo(i);
          restartAutoAdvance();
        });
        dotsContainer.appendChild(dot);
        dotEls.push(dot);
      });
    }

    function stopAutoAdvance() {
      if (autoAdvanceTimer) {
        window.clearInterval(autoAdvanceTimer);
        autoAdvanceTimer = null;
      }
    }

    function startAutoAdvance() {
      stopAutoAdvance();
      // Only the narrow layout turns .gallery into a one-photo-at-a-time
      // carousel — on a grid there's nothing to advance.
      if (!isMobile()) return;
      autoAdvanceTimer = window.setInterval(() => {
        step(1);
      }, AUTO_ADVANCE_MS);
    }

    function restartAutoAdvance() {
      startAutoAdvance();
    }

    // A manual swipe fires scroll events throughout the gesture; wait for
    // them to settle before trusting scrollLeft, then sync the dots and
    // let auto-advance resume so it never fights the visitor's own swipe.
    let scrollSettleTimer = null;
    gallery.addEventListener("scroll", () => {
      if (scrollSettleTimer) window.clearTimeout(scrollSettleTimer);
      scrollSettleTimer = window.setTimeout(() => {
        const width = gallery.clientWidth || 1;
        const index = Math.round(gallery.scrollLeft / width);
        const clamped = Math.max(0, Math.min(slideCount - 1, index));
        if (clamped !== currentIndex) {
          currentIndex = clamped;
        }
        updateActiveDot(currentIndex);
        restartAutoAdvance();
      }, 120);
    });

    gallery.addEventListener("touchstart", stopAutoAdvance, { passive: true });
    gallery.addEventListener("mouseenter", stopAutoAdvance);
    gallery.addEventListener("mouseleave", startAutoAdvance);

    window.addEventListener("resize", restartAutoAdvance);

    const prefersReducedMotion = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

    if (!prefersReducedMotion) {
      startAutoAdvance();
    }
  }

  init();
})();

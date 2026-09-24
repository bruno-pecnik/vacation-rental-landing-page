// ---------------------------------------------------------------------------
// Section switching: show exactly one <section class="page-section"> at a
// time, driven by the nav links and the URL hash (so links are shareable
// and the browser back/forward buttons work as expected).
// ---------------------------------------------------------------------------
(function () {
  const SECTION_IDS = ["apartman", "host"];
  const DEFAULT_SECTION = "apartman";

  // (Scroll restoration is disabled by an inline script at the very top
  // of <head>, which runs before this file — see index.html.)

  function showSection(id) {
    if (!SECTION_IDS.includes(id)) {
      id = DEFAULT_SECTION;
    }

    document.querySelectorAll(".page-section").forEach((section) => {
      // The contact section below also uses .page-section (for its
      // decorative background/border treatment) but isn't one of the
      // tab-switched sections, so it's left alone here.
      if (!SECTION_IDS.includes(section.id)) return;
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
    hr: "hr",
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

    // Placeholders aren't text content, so they need their own attribute
    // and their own pass (the contact form's inputs use this).
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.dataset.i18nPlaceholder;
      if (dict[key]) {
        el.setAttribute("placeholder", dict[key]);
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

    // Force the layout the browser needs to register the starting
    // position above, before we transition both slides to their
    // resting/exit state. The viewport's height itself is fixed (set
    // once by applyFixedHeight, not touched here) so the box never
    // visibly resizes as you flip between reviews.
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

    // Measures one review without it ever being visible — built,
    // measured and removed in the same tick, so there's no flash of
    // the wrong review while sizing.
    function measureSlideHeight(index) {
      const probe = buildSlide(index);
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.transform = "none";
      probe.style.opacity = "1";
      probe.style.pointerEvents = "none";
      viewport.appendChild(probe);
      const height = probe.offsetHeight;
      viewport.removeChild(probe);
      return height;
    }

    // The box holds one stable height — the tallest of the current
    // language's reviews — set once rather than resized on every slide,
    // so flipping through reviews never makes the box visibly grow or
    // shrink. Only a real reason to resize (switching language, since
    // translated text can need more or less room, or the viewport
    // itself changing width) re-measures it.
    function applyFixedHeight() {
      let max = 0;
      for (let i = 0; i < REVIEWS.length; i++) {
        max = Math.max(max, measureSlideHeight(i));
      }
      viewport.style.height = max + "px";
    }

    currentSlide = buildSlide(current);
    viewport.appendChild(currentSlide);
    applyFixedHeight();

    // Switching languages doesn't rebuild the slide (that would restart
    // its slide/fade animation) — it just swaps the quote/author text
    // inside whichever slide is currently showing, then re-measures the
    // fixed height for the new language's text.
    document.addEventListener("langchange", () => {
      if (!currentSlide) return;
      const dict = currentDict();
      const review = REVIEWS[current];
      const quoteEl = currentSlide.querySelector(".review-spotlight__quote");
      const authorEl = currentSlide.querySelector(".review-spotlight__author");
      if (quoteEl) quoteEl.textContent = quoteTextFor(review, dict);
      if (authorEl) authorEl.textContent = authorTextFor(review, dict);
      applyFixedHeight();
    });

    // The slides' width (and so how their text wraps) depends on the
    // viewport's width, which a window resize or orientation change can
    // alter — re-measure so the fixed height still fits every review at
    // the new width instead of clipping the tallest one.
    window.addEventListener("resize", () => {
      applyFixedHeight();
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

    const slides = Array.from(gallery.querySelectorAll(".gallery__item"));
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

// ---------------------------------------------------------------------------
// Scroll reveal: each major block (an intro paragraph, the stat band, the
// gallery, the map, a review, the host card, the contact form...) fades and
// rises gently into place the first time it scrolls into view, instead of
// the whole page just being there. The hidden starting state is applied by
// CSS the moment the html.js-reveal class exists (added synchronously in
// <head>, before this file even loads) so there's no flash of visible
// content before it gets hidden — this script's only job is to flip each
// element to .is-visible once it's actually in view, or to cancel the whole
// effect (removing js-reveal) when it can't run properly.
// ---------------------------------------------------------------------------
(function () {
  // Scoped to #apartman specifically (plus the always-visible contact
  // form): that's the one tab long enough for a scroll-triggered reveal
  // to make sense as you move down it. #host is short, and — critically —
  // querySelectorAll() runs once at load time, so if it were included
  // here, switching to the Host tab (or landing directly on #host via a
  // shared link) would only ever reveal its content once the visitor
  // scrolls, since IntersectionObserver never got a chance to see it
  // while the section was display:none. Until then, the whole tab reads
  // as a blank page.
  const SELECTOR = [
    "#apartman .section-body > p",
    "#apartman .section-body > h2",
    ".stat-band",
    ".rating-card",
    ".booking-badge",
    ".content-band",
    ".map-embed",
    ".contact-form",
  ].join(", ");

  function revealEverythingImmediately() {
    document.documentElement.classList.remove("js-reveal");
  }

  function init() {
    if (!document.documentElement.classList.contains("js-reveal")) return;

    if (!("IntersectionObserver" in window)) {
      revealEverythingImmediately();
      return;
    }

    const prefersReducedMotion = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
    if (prefersReducedMotion) {
      revealEverythingImmediately();
      return;
    }

    const targets = document.querySelectorAll(SELECTOR);
    if (!targets.length) {
      revealEverythingImmediately();
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((el) => observer.observe(el));
  }

  init();
})();

// ---------------------------------------------------------------------------
// Header: transparent over the hero photo at the top of the page, filling
// in to the site's usual navy once the visitor scrolls past it. Toggled by
// scroll position rather than an IntersectionObserver on the hero itself,
// since the header needs to react immediately as the page loads already
// scrolled (a reload mid-page, or a shared #host link) — not only on the
// first scroll gesture.
// ---------------------------------------------------------------------------
(function () {
  const SCROLL_THRESHOLD = 60;

  function init() {
    const header = document.querySelector(".site-header");
    if (!header) return;

    function syncHeaderState() {
      header.classList.toggle("is-scrolled", window.scrollY > SCROLL_THRESHOLD);
    }

    syncHeaderState();
    window.addEventListener("scroll", syncHeaderState, { passive: true });
  }

  init();
})();

// ---------------------------------------------------------------------------
// Contact form: this is a static site with no backend to send a form to, so
// instead of emailing anywhere it builds the same kind of wa.me message the
// WhatsApp buttons elsewhere on the page use, and opens it in a new tab —
// giving visitors who'd rather type into a form than open WhatsApp directly
// a way to do that, while every message still ends up in WhatsApp exactly
// like the direct buttons.
// ---------------------------------------------------------------------------
(function () {
  const WHATSAPP_NUMBER = "385981753381";
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Renders an <input type="date"> value ("YYYY-MM-DD") as "12 Jul 2026" —
  // a fixed, always-in-English format regardless of the visitor's chosen
  // site language, so the date in the WhatsApp message is unambiguous
  // (no MM/DD-vs-DD/MM guessing) whichever language Nada reads it in.
  function formatDate(isoDate) {
    const parts = (isoDate || "").split("-");
    if (parts.length !== 3) return isoDate || "";
    const [year, month, day] = parts;
    const monthIndex = parseInt(month, 10) - 1;
    if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return isoDate;
    return parseInt(day, 10) + " " + MONTH_NAMES[monthIndex] + " " + year;
  }

  function buildMessage(name, phone, checkin, checkout, message) {
    const lines = [
      "Hi, I'm interested in Luxury Apartments Cuba Novalja.",
      "",
      "Name: " + name,
    ];
    if (phone) {
      lines.push("Phone: " + phone);
    }
    if (checkin || checkout) {
      const checkinText = checkin ? formatDate(checkin) : "?";
      const checkoutText = checkout ? formatDate(checkout) : "?";
      lines.push("Dates: " + checkinText + " – " + checkoutText);
    }
    lines.push("Message: " + message);
    return lines.join("\n");
  }

  function init() {
    const form = document.getElementById("contact-form");
    if (!form) return;

    const nameInput = document.getElementById("contact-name");
    const phoneInput = document.getElementById("contact-phone");
    const checkinInput = document.getElementById("contact-checkin");
    const checkoutInput = document.getElementById("contact-checkout");
    const messageInput = document.getElementById("contact-message");

    // Nobody can book the past, and a check-out before check-in is never
    // valid — both fields stay optional, but when a visitor does pick
    // dates, the picker itself steers them away from an impossible range
    // instead of only catching it after the fact.
    if (checkinInput && checkoutInput) {
      const today = new Date();
      const todayIso = today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");
      checkinInput.min = todayIso;
      checkoutInput.min = todayIso;

      checkinInput.addEventListener("change", () => {
        if (checkinInput.value) {
          checkoutInput.min = checkinInput.value;
          if (checkoutInput.value && checkoutInput.value < checkinInput.value) {
            checkoutInput.value = checkinInput.value;
          }
        } else {
          checkoutInput.min = todayIso;
        }
      });
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      const checkin = checkinInput ? checkinInput.value.trim() : "";
      const checkout = checkoutInput ? checkoutInput.value.trim() : "";
      const message = messageInput.value.trim();
      if (!name || !message) return;

      const text = buildMessage(name, phone, checkin, checkout, message);
      const url = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text);
      window.open(url, "_blank", "noopener");
      form.reset();
    });
  }

  init();
})();

// ---------------------------------------------------------------------------
// Photo lightbox: clicking any gallery photo (desktop grid or mobile
// carousel alike) opens a single, reused full-screen viewer with prev/next
// arrows and keyboard support, instead of the grid being purely decorative.
// ---------------------------------------------------------------------------
(function () {
  function init() {
    const items = Array.from(document.querySelectorAll(".gallery__item"));
    if (!items.length) return;

    const overlay = document.createElement("div");
    overlay.className = "lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Photo viewer");
    overlay.innerHTML =
      '<button type="button" class="lightbox__close" aria-label="Close">&times;</button>' +
      '<button type="button" class="lightbox__arrow lightbox__arrow--prev" aria-label="Previous photo">&#8249;</button>' +
      '<img class="lightbox__img" alt="">' +
      '<button type="button" class="lightbox__arrow lightbox__arrow--next" aria-label="Next photo">&#8250;</button>';
    document.body.appendChild(overlay);

    const imgEl = overlay.querySelector(".lightbox__img");
    const closeBtn = overlay.querySelector(".lightbox__close");
    const prevBtn = overlay.querySelector(".lightbox__arrow--prev");
    const nextBtn = overlay.querySelector(".lightbox__arrow--next");

    let index = 0;
    let lastFocused = null;

    function show(i) {
      index = (i + items.length) % items.length;
      const img = items[index].querySelector("img");
      if (!img) return;
      imgEl.src = img.currentSrc || img.src;
      imgEl.alt = img.alt || "";
    }

    function onKeydown(event) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") show(index - 1);
      if (event.key === "ArrowRight") show(index + 1);
    }

    function open(i) {
      lastFocused = document.activeElement;
      show(i);
      overlay.classList.add("is-open");
      document.body.style.overflow = "hidden";
      closeBtn.focus();
      document.addEventListener("keydown", onKeydown);
    }

    function close() {
      overlay.classList.remove("is-open");
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeydown);
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      }
    }

    items.forEach((item, i) => {
      item.addEventListener("click", () => open(i));
    });

    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", () => show(index - 1));
    nextBtn.addEventListener("click", () => show(index + 1));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
  }

  init();
})();

// ---------------------------------------------------------------------------
// Map loading skeleton: the Google Maps iframe is loading="lazy", so this
// spinner only appears once a visitor actually scrolls near it, then fades
// out the moment the iframe fires its own load event — never a blank grey
// rectangle while it's fetching.
// ---------------------------------------------------------------------------
(function () {
  function init() {
    const iframe = document.getElementById("map-iframe");
    const loading = document.getElementById("map-loading");
    if (!iframe || !loading) return;

    function hide() {
      loading.classList.add("is-hidden");
    }

    iframe.addEventListener("load", hide);
  }

  init();
})();

// ---------------------------------------------------------------------------
// Page loader: a brief branded overlay while the hero image and fonts
// finish loading, hidden on window's load event with a safety timeout so
// it can never get stuck covering the page if a resource stalls.
// ---------------------------------------------------------------------------
(function () {
  function init() {
    const loader = document.getElementById("page-loader");
    if (!loader) return;

    let hidden = false;
    function hide() {
      if (hidden) return;
      hidden = true;
      loader.classList.add("is-hidden");
      window.setTimeout(() => {
        if (loader.parentNode) loader.parentNode.removeChild(loader);
      }, 450);
    }

    if (document.readyState === "complete") {
      hide();
    } else {
      window.addEventListener("load", hide);
    }
    // Never let a slow-loading resource keep the loader up indefinitely.
    window.setTimeout(hide, 2500);
  }

  init();
})();

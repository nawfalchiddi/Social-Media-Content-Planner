"use strict";

/**
 * Shared helpers used by every page (storage, dates, toast, navigation).
 * Exposed on a single global namespace: window.SF
 * (plain scripts instead of ES modules so the site also works when opened via file://)
 */
window.SF = (() => {
  const STORAGE_KEY = "socialflow.contentPlanner.v1";
  const PLATFORMS = ["Instagram", "Facebook", "LinkedIn"];
  const STATUSES = ["Draft", "Published"];

  /* ---------- Storage ---------- */

  function isValidStoredPost(post) {
    return Boolean(post) &&
      typeof post.id === "string" &&
      typeof post.title === "string" &&
      PLATFORMS.includes(post.platform) &&
      typeof post.date === "string" && isValidDate(post.date) &&
      STATUSES.includes(post.status);
  }

  function loadPosts() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(isValidStoredPost) : [];
    } catch (error) {
      console.error("Could not load saved posts:", error);
      return [];
    }
  }

  function savePosts(posts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
      return true;
    } catch (error) {
      console.error("Could not save posts:", error);
      showToast("Could not save changes. Check your browser's storage settings.", true);
      return false;
    }
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  /* ---------- Dates (always LOCAL time, never UTC) ---------- */

  const pad = number => String(number).padStart(2, "0");

  function toISO(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function fromISO(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function todayISO() {
    return toISO(new Date());
  }

  function isValidDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
  }

  /** ISO strings compare correctly as plain strings. */
  function isPastDate(value) {
    return value < todayISO();
  }

  function addDays(date, amount) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
  }

  /** Weeks start on Monday. */
  function startOfWeek(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return start;
  }

  function formatDate(dateString) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric", month: "short", year: "numeric"
    }).format(fromISO(dateString));
  }

  function formatShortDate(dateString) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric", month: "short"
    }).format(fromISO(dateString));
  }

  /* ---------- Misc ---------- */

  function escapeHTML(value = "") {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(value).replace(/[&<>"']/g, character => entities[character]);
  }

  const platformClass = {
    Instagram: "platform-instagram",
    Facebook: "platform-facebook",
    LinkedIn: "platform-linkedin"
  };

  let toastTimeout;
  function showToast(message, isError = false) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.classList.toggle("error-toast", isError);
    toast.classList.add("show");
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  /** Re-run a render function when another tab changes the saved posts. */
  function onPostsChangedElsewhere(callback) {
    window.addEventListener("storage", event => {
      if (event.key === STORAGE_KEY || event.key === null) callback();
    });
  }

  /* ---------- Shared page chrome ---------- */

  function initNavigation() {
    const toggle = document.querySelector("#menuToggle");
    const navigation = document.querySelector("#navigation");

    if (toggle && navigation) {
      const setOpen = isOpen => {
        navigation.classList.toggle("open", isOpen);
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
      };

      toggle.addEventListener("click", () => setOpen(!navigation.classList.contains("open")));
      navigation.addEventListener("click", event => {
        if (event.target.closest("a")) setOpen(false);
      });
      document.addEventListener("keydown", event => {
        if (event.key === "Escape") setOpen(false);
      });
    }

    const year = document.querySelector("#currentYear");
    if (year) year.textContent = new Date().getFullYear();
  }

  document.addEventListener("DOMContentLoaded", initNavigation);

  return {
    PLATFORMS, STATUSES, platformClass,
    loadPosts, savePosts, createId,
    toISO, fromISO, todayISO, isValidDate, isPastDate,
    addDays, startOfWeek, formatDate, formatShortDate,
    escapeHTML, showToast, onPostsChangedElsewhere
  };
})();

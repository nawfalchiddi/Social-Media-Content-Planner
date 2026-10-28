"use strict";

(() => {
  const {
    loadPosts, savePosts, toISO, fromISO, todayISO, isValidDate, isPastDate,
    addDays, startOfWeek, formatShortDate, escapeHTML, onPostsChangedElsewhere
  } = window.SF;

  const $ = selector => document.querySelector(selector);

  const el = {
    grid: $("#weekGrid"),
    range: $("#weekRange"),
    prev: $("#prevWeekBtn"),
    next: $("#nextWeekBtn"),
    today: $("#thisWeekBtn"),
    total: $("#weekTotal"),
    drafts: $("#weekDrafts"),
    published: $("#weekPublished"),
    empty: $("#weekEmptyDays"),
    legend: $("#weekLegend"),
    emptyNote: $("#weekEmptyNote"),
    addBtn: $("#addPostBtn")
  };

  const colorClass = { Instagram: "post-purple", LinkedIn: "post-green", Facebook: "post-orange" };
  const dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  let posts = loadPosts();
  let weekStart = initialWeekStart();

  function initialWeekStart() {
    const param = new URLSearchParams(window.location.search).get("week");
    return startOfWeek(param && isValidDate(param) ? fromISO(param) : new Date());
  }

  function syncUrl() {
    const isCurrent = toISO(weekStart) === toISO(startOfWeek(new Date()));
    const url = isCurrent ? window.location.pathname : `${window.location.pathname}?week=${toISO(weekStart)}`;
    window.history.replaceState({}, "", url);
  }

  function formatRange(start) {
    const end = addDays(start, 6);
    const sameYear = start.getFullYear() === end.getFullYear();
    const fmt = (date, withYear) => new Intl.DateTimeFormat("en-GB", {
      day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {})
    }).format(date);
    return `${fmt(start, !sameYear)} – ${fmt(end, true)}`;
  }

  function render() {
    const today = todayISO();
    const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
    const isoDays = days.map(toISO);

    const weekPosts = posts
      .filter(post => isoDays.includes(post.date))
      .sort((a, b) => a.title.localeCompare(b.title));

    el.range.textContent = formatRange(weekStart);
    el.today.disabled = isoDays.includes(today);

    // Stats
    const emptyDays = isoDays.filter(iso => !weekPosts.some(p => p.date === iso)).length;
    el.total.textContent = weekPosts.length;
    el.drafts.textContent = weekPosts.filter(p => p.status === "Draft").length;
    el.published.textContent = weekPosts.filter(p => p.status === "Published").length;
    el.empty.textContent = emptyDays;

    // Legend with counts
    el.legend.innerHTML = [
      ["Instagram", "legend-purple"], ["Facebook", "legend-orange"], ["LinkedIn", "legend-green"]
    ].map(([name, cls]) => {
      const count = weekPosts.filter(p => p.platform === name).length;
      return `<span><i class="${cls}"></i> ${name} <b>${count}</b></span>`;
    }).join("");

    el.emptyNote.hidden = weekPosts.length > 0;

    // Grid
    el.grid.innerHTML = days.map((date, index) => {
      const iso = isoDays[index];
      const isToday = iso === today;
      const isPast = isPastDate(iso);
      const dayPosts = weekPosts.filter(p => p.date === iso);

      const postsHTML = dayPosts.map(post => `
        <button type="button" class="week-post ${colorClass[post.platform]}${post.status === "Published" ? " is-published" : ""}"
           data-action="edit" data-id="${escapeHTML(post.id)}"
           title="Edit “${escapeHTML(post.title)}”">
          <small>${escapeHTML(post.platform.toUpperCase())} · ${post.status === "Published" ? "PUBLISHED" : "DRAFT"}</small>
          <strong>${escapeHTML(post.title)}</strong>
        </button>`).join("");

      const addHTML = isPast
        ? (dayPosts.length ? "" : '<span class="week-nothing">—</span>')
        : `<button type="button" class="week-add" data-action="add" data-date="${iso}" aria-label="Add a post on ${escapeHTML(formatShortDate(iso))}">＋ <span>Add post</span></button>`;

      return `
        <div class="week-column${isToday ? " is-today" : ""}${isPast ? " is-past" : ""}">
          <div class="week-day-head">
            <span>${dayNames[index]}</span>
            <b>${date.getDate()}</b>
            ${isToday ? '<em>Today</em>' : ""}
          </div>
          <div class="week-day-posts">${postsHTML}${addHTML}</div>
        </div>`;
    }).join("");

    syncUrl();
  }

  /* ---------- Create / edit without leaving this page ---------- */

  const postDialog = window.SF.initPostDialog({
    getPosts: () => posts,
    setPosts(next) {
      const previous = posts;
      posts = next;
      if (!savePosts(posts)) {
        posts = previous;
        return false;
      }
      // Jump to the week of the saved post so it is visible right away.
      const saved = next.find(p => !previous.some(q => q.id === p.id)) ||
        next.find(p => { const old = previous.find(q => q.id === p.id); return old && JSON.stringify(old) !== JSON.stringify(p); });
      if (saved) weekStart = startOfWeek(fromISO(saved.date));
      render();
      return true;
    }
  });

  el.grid.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "add") postDialog.openCreate(button.dataset.date);
    else if (button.dataset.action === "edit") postDialog.openEdit(button.dataset.id);
  });

  el.addBtn.addEventListener("click", () => {
    // Pre-fill with today, or the first upcoming day of the week being viewed.
    const today = todayISO();
    const week = Array.from({ length: 7 }, (_, i) => toISO(addDays(weekStart, i)));
    postDialog.openCreate(week.find(iso => iso >= today) || today);
  });

  function goToWeek(offset) {
    weekStart = addDays(weekStart, offset * 7);
    render();
  }

  el.prev.addEventListener("click", () => goToWeek(-1));
  el.next.addEventListener("click", () => goToWeek(1));
  el.today.addEventListener("click", () => {
    weekStart = startOfWeek(new Date());
    render();
  });

  document.addEventListener("keydown", event => {
    if (event.target.closest("input, select, textarea")) return;
    if (event.key === "ArrowLeft") goToWeek(-1);
    if (event.key === "ArrowRight") goToWeek(1);
  });

  onPostsChangedElsewhere(() => {
    posts = loadPosts();
    render();
  });

  render();
})();

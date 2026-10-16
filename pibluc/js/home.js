"use strict";

/** Fills the hero preview card on the home page with the user's real current week. */
(() => {
  const {
    loadPosts, toISO, todayISO, addDays, startOfWeek,
    formatShortDate, escapeHTML, onPostsChangedElsewhere
  } = window.SF;

  const calendar = document.querySelector("#heroCalendar");
  if (!calendar) return;

  const names = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const icons = {
    Instagram: ["instagram-icon", "◎"],
    Facebook: ["facebook-icon", "f"],
    LinkedIn: ["linkedin-icon", "in"]
  };
  const pad = value => String(value).padStart(2, "0");

  function render() {
    const posts = loadPosts();
    const today = todayISO();
    const start = startOfWeek(new Date());
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const isoDays = days.map(toISO);
    const weekPosts = posts.filter(p => isoDays.includes(p.date));

    document.querySelector("#heroPlanned").textContent = pad(weekPosts.length);
    document.querySelector("#heroDrafts").textContent =
      pad(weekPosts.filter(p => p.status === "Draft").length);
    document.querySelector("#heroPublished").textContent =
      pad(weekPosts.filter(p => p.status === "Published").length);

    calendar.innerHTML = days.map((date, i) => {
      const iso = isoDays[i];
      const dayPosts = weekPosts.filter(p => p.date === iso);
      const dot = dayPosts.length
        ? `<span class="day-dot${dayPosts.every(p => p.status === "Published") ? " dot-green" : ""}"></span>`
        : "";
      return `<div class="day${iso === today ? " active-day" : ""}"><small>${names[i]}</small><b>${date.getDate()}</b>${dot}</div>`;
    }).join("");

    const upcoming = weekPosts
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
      .slice(0, 2);

    document.querySelector("#heroPosts").innerHTML = upcoming.length
      ? upcoming.map(post => {
          const [cls, symbol] = icons[post.platform];
          return `
            <div class="mini-post">
              <div class="mini-post-icon ${cls}">${symbol}</div>
              <div class="mini-post-copy"><strong>${escapeHTML(post.title)}</strong><small>${escapeHTML(post.platform)} · ${escapeHTML(formatShortDate(post.date))}</small></div>
              <span class="status-pill ${post.status === "Published" ? "status-published" : "status-draft"}">${escapeHTML(post.status)}</span>
            </div>`;
        }).join("")
      : `<div class="mini-empty">Nothing planned this week yet.<br /><a href="planner.html?new=${today}">Create your first post ↗</a></div>`;
  }

  onPostsChangedElsewhere(render);
  render();
})();

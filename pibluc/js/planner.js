"use strict";

(() => {
  const {
    platformClass, loadPosts, savePosts, isPastDate, formatDate,
    escapeHTML, showToast, onPostsChangedElsewhere
  } = window.SF;

  const $ = selector => document.querySelector(selector);

  const el = {
    postList: $("#postList"),
    totalCount: $("#totalCount"),
    draftCount: $("#draftCount"),
    publishedCount: $("#publishedCount"),
    resultsLabel: $("#resultsLabel"),
    searchInput: $("#searchInput"),
    platformFilter: $("#platformFilter"),
    statusFilter: $("#statusFilter"),
    clearFiltersBtn: $("#clearFiltersBtn"),
    addPostBtn: $("#addPostBtn"),
    exportBtn: $("#exportBtn")
  };

  let posts = loadPosts();

  /* ---------- Filtering & rendering ---------- */

  function getVisiblePosts() {
    const query = el.searchInput.value.trim().toLowerCase();
    const platform = el.platformFilter.value;
    const status = el.statusFilter.value;

    return posts
      .filter(post =>
        (platform === "all" || post.platform === platform) &&
        (status === "all" || post.status === status) &&
        (!query ||
          post.title.toLowerCase().includes(query) ||
          (post.caption || "").toLowerCase().includes(query) ||
          post.platform.toLowerCase().includes(query)))
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  }

  function renderStats() {
    el.totalCount.textContent = posts.length;
    el.draftCount.textContent = posts.filter(p => p.status === "Draft").length;
    el.publishedCount.textContent = posts.filter(p => p.status === "Published").length;
  }

  function hasActiveFilters() {
    return el.searchInput.value.trim() !== "" ||
      el.platformFilter.value !== "all" ||
      el.statusFilter.value !== "all";
  }

  function renderPosts() {
    const visible = getVisiblePosts();
    renderStats();

    el.resultsLabel.textContent =
      `${visible.length} ${visible.length === 1 ? "post" : "posts"} shown`;

    if (visible.length === 0) {
      const filtered = hasActiveFilters();
      el.postList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${filtered ? "⌕" : "✳"}</div>
          <h3>${filtered ? "No matching posts" : "Your plan starts here"}</h3>
          <p>${filtered
            ? "Try changing your search or filters to find your content."
            : "Create your first post to start organizing your social media content."}</p>
          ${filtered
            ? '<button class="button button-outline" data-action="clear-filters">Clear filters</button>'
            : '<button class="button button-primary" data-action="add">Create your first post <span>↗</span></button>'}
        </div>`;
      return;
    }

    el.postList.innerHTML = visible.map(post => {
      const id = escapeHTML(post.id);
      const isPublished = post.status === "Published";
      const isOverdue = !isPublished && isPastDate(post.date);
      const caption = post.caption || "";

      return `
        <article class="post-card" data-id="${id}">
          <div class="post-main">
            <div class="post-topline">
              <span class="platform-tag ${platformClass[post.platform]}">${escapeHTML(post.platform)}</span>
              <span class="post-date">◷ ${escapeHTML(formatDate(post.date))}</span>
              <span class="status-pill ${isPublished ? "status-published" : "status-draft"}">${escapeHTML(post.status)}</span>
              ${isOverdue ? '<span class="status-pill status-overdue">Overdue</span>' : ""}
            </div>
            <h4>${escapeHTML(post.title)}</h4>
            <p class="post-caption ${caption ? "" : "is-empty"}">${caption ? escapeHTML(caption) : "No caption added yet."}</p>
          </div>
          <div class="post-actions">
            <button class="action-button" data-action="copy" data-id="${id}">Copy caption</button>
            <button class="action-button" data-action="edit" data-id="${id}">Edit</button>
            <button class="action-button" data-action="toggle-status" data-id="${id}">Mark ${isPublished ? "draft" : "published"}</button>
            <button class="action-button delete-action" data-action="delete" data-id="${id}">Delete</button>
          </div>
        </article>`;
    }).join("");
  }

  function clearFilters() {
    el.searchInput.value = "";
    el.platformFilter.value = "all";
    el.statusFilter.value = "all";
    renderPosts();
  }

  /* ---------- Create / edit dialog (shared with the weekly preview) ---------- */

  const postDialog = window.SF.initPostDialog({
    getPosts: () => posts,
    setPosts(next) {
      const previous = posts;
      posts = next;
      if (!savePosts(posts)) {
        posts = previous;
        return false;
      }
      renderPosts();
      return true;
    }
  });

  const openCreateDialog = date => postDialog.openCreate(date);
  const openEditDialog = id => postDialog.openEdit(id);

  /* ---------- Row actions ---------- */

  async function copyCaption(id) {
    const post = posts.find(item => item.id === id);
    if (!post) return;

    if (!post.caption) {
      showToast("This post does not have a caption to copy.", true);
      return;
    }

    try {
      await navigator.clipboard.writeText(post.caption);
      showToast("Caption copied to clipboard.");
    } catch (error) {
      const temp = document.createElement("textarea");
      temp.value = post.caption;
      temp.setAttribute("readonly", "");
      temp.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(temp);
      temp.select();

      let copied = false;
      try { copied = document.execCommand("copy"); } catch { copied = false; }
      temp.remove();

      showToast(
        copied ? "Caption copied to clipboard." : "Clipboard access failed. Please copy the caption manually.",
        !copied
      );
    }
  }

  function togglePostStatus(id) {
    const post = posts.find(item => item.id === id);
    if (!post) return;

    const nextStatus = post.status === "Draft" ? "Published" : "Draft";
    const previous = posts;
    posts = posts.map(item => (item.id === id ? { ...item, status: nextStatus } : item));

    if (!savePosts(posts)) {
      posts = previous;
      return;
    }

    renderPosts();
    showToast(`Status changed to ${nextStatus}. No social post was published.`);
  }

  function deletePost(id) {
    const post = posts.find(item => item.id === id);
    if (!post) return;

    if (!window.confirm(`Delete "${post.title}" from your plan? This cannot be undone.`)) return;

    const previous = posts;
    posts = posts.filter(item => item.id !== id);

    if (!savePosts(posts)) {
      posts = previous;
      return;
    }

    renderPosts();
    showToast("Post deleted from your plan.");
  }

  function exportCSV() {
    const visible = getVisiblePosts();

    if (visible.length === 0) {
      showToast("There are no posts to export.", true);
      return;
    }

    const headers = ["Title", "Platform", "Publication date", "Caption", "Status"];
    const rows = visible.map(p => [p.title, p.platform, p.date, p.caption || "", p.status]);

    const escapeCSV = value => {
      let text = String(value ?? "");
      // Prevent spreadsheet formula injection.
      if (/^\s*[=+\-@]/.test(text)) text = "'" + text;
      return `"${text.replace(/"/g, '""')}"`;
    };

    const csv = [headers, ...rows].map(row => row.map(escapeCSV).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "socialflow-content-plan.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showToast("Your content plan has been exported.");
  }

  /* ---------- Events ---------- */

  el.addPostBtn.addEventListener("click", () => openCreateDialog());
  [el.searchInput, el.platformFilter, el.statusFilter].forEach(control => {
    control.addEventListener("input", renderPosts);
    control.addEventListener("change", renderPosts);
  });
  el.clearFiltersBtn.addEventListener("click", clearFilters);
  el.exportBtn.addEventListener("click", exportCSV);

  el.postList.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const { action, id } = button.dataset;
    if (action === "add") openCreateDialog();
    else if (action === "clear-filters") clearFilters();
    else if (action === "edit") openEditDialog(id);
    else if (action === "delete") deletePost(id);
    else if (action === "copy") copyCaption(id);
    else if (action === "toggle-status") togglePostStatus(id);
  });

  onPostsChangedElsewhere(() => {
    posts = loadPosts();
    renderPosts();
  });

  /* ---------- Deep links from other pages ---------- */
  // planner.html?new=2026-10-20  → open "Create" with that date
  // planner.html?edit=<id>       → open "Edit" for that post

  function handleDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const newDate = params.get("new");
    const editId = params.get("edit");

    if (newDate !== null) openCreateDialog(newDate);
    else if (editId) openEditDialog(editId);

    if (newDate !== null || editId) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  renderPosts();
  handleDeepLink();
})();

"use strict";

(() => {
  const {
    PLATFORMS, platformClass, loadPosts, savePosts, createId,
    todayISO, isValidDate, isPastDate, formatDate,
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
    exportBtn: $("#exportBtn"),
    dialog: $("#postDialog"),
    form: $("#postForm"),
    dialogTitle: $("#dialogTitle"),
    postId: $("#postId"),
    title: $("#postTitle"),
    platform: $("#postPlatform"),
    date: $("#postDate"),
    caption: $("#postCaption"),
    status: $("#postStatus"),
    captionCount: $("#captionCount"),
    saveBtn: $("#savePostBtn"),
    closeBtn: $("#closeDialogBtn"),
    cancelBtn: $("#cancelDialogBtn"),
    errorSummary: $("#formErrorSummary"),
    dateHint: $("#dateHint")
  };

  const fieldMap = {
    title: { input: el.title, error: $("#titleError") },
    platform: { input: el.platform, error: $("#platformError") },
    date: { input: el.date, error: $("#dateError") }
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

  /* ---------- Form validation ---------- */

  function clearErrors() {
    Object.values(fieldMap).forEach(({ input, error }) => {
      error.textContent = "";
      input.removeAttribute("aria-invalid");
    });
    el.errorSummary.textContent = "";
  }

  function setFieldError(field, message) {
    fieldMap[field].error.textContent = message;
    fieldMap[field].input.setAttribute("aria-invalid", "true");
  }

  function clearFieldError(field) {
    fieldMap[field].error.textContent = "";
    fieldMap[field].input.removeAttribute("aria-invalid");
  }

  /** The date this form is allowed to keep even though it is in the past (edit mode only). */
  function getOriginalDate() {
    const existing = posts.find(p => p.id === el.postId.value);
    return existing ? existing.date : null;
  }

  function validateDate(value) {
    if (!value || !isValidDate(value)) {
      return "Please choose a valid publication date.";
    }
    // New posts can't be scheduled in the past. When editing, an old post may
    // keep its original date, but can't be moved to a different past date.
    if (isPastDate(value) && value !== getOriginalDate()) {
      return "The publication date can't be in the past. Choose today or a future date.";
    }
    return "";
  }

  function validateForm() {
    clearErrors();
    let valid = true;

    if (!el.title.value.trim()) {
      setFieldError("title", "Please enter a post title.");
      valid = false;
    }

    if (!PLATFORMS.includes(el.platform.value)) {
      setFieldError("platform", "Please choose a valid platform.");
      valid = false;
    }

    const dateError = validateDate(el.date.value);
    if (dateError) {
      setFieldError("date", dateError);
      valid = false;
    }

    if (!valid) {
      el.errorSummary.textContent = "Please correct the highlighted fields before saving.";
    }
    return valid;
  }

  /* ---------- Dialog ---------- */

  function updateCaptionCount() {
    el.captionCount.textContent = `${el.caption.value.length} / 5000`;
  }

  /** Re-computed every time the dialog opens so it stays right after midnight. */
  function applyDateMin(originalDate) {
    const today = todayISO();
    const min = originalDate && originalDate < today ? originalDate : today;
    el.date.min = min;
    el.dateHint.textContent = originalDate && originalDate < today
      ? "This post is in the past. You can keep its date, but not pick another past date."
      : "Today or a future date.";
  }

  function openCreateDialog(presetDate = "") {
    el.form.reset();
    clearErrors();

    el.postId.value = "";
    el.dialogTitle.textContent = "Create a post";
    el.saveBtn.innerHTML = 'Save post <span>↗</span>';
    el.status.value = "Draft";

    applyDateMin(null);
    el.date.value = presetDate && isValidDate(presetDate) && !isPastDate(presetDate)
      ? presetDate
      : todayISO();

    updateCaptionCount();
    el.dialog.showModal();
    el.title.focus();
  }

  function openEditDialog(id) {
    const post = posts.find(item => item.id === id);
    if (!post) {
      showToast("That post could not be found.", true);
      return;
    }

    el.form.reset();
    clearErrors();

    el.postId.value = post.id;
    el.title.value = post.title;
    el.platform.value = post.platform;
    applyDateMin(post.date);
    el.date.value = post.date;
    el.caption.value = post.caption || "";
    el.status.value = post.status;

    el.dialogTitle.textContent = "Edit your post";
    el.saveBtn.innerHTML = 'Save changes <span>↗</span>';

    updateCaptionCount();
    el.dialog.showModal();
    el.title.focus();
  }

  function handleFormSubmit(event) {
    event.preventDefault();

    if (!validateForm()) {
      el.form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    const id = el.postId.value;
    const existing = posts.find(post => post.id === id);

    const postData = {
      id: existing ? existing.id : createId(),
      title: el.title.value.trim(),
      platform: el.platform.value,
      date: el.date.value,
      caption: el.caption.value.trim(),
      status: el.status.value
    };

    const previous = posts;
    posts = existing
      ? posts.map(post => (post.id === id ? postData : post))
      : [...posts, postData];

    if (!savePosts(posts)) {
      posts = previous;
      return;
    }

    renderPosts();
    el.dialog.close();
    showToast(existing ? "Post updated successfully." : "Post added to your plan.");
  }

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
  el.form.addEventListener("submit", handleFormSubmit);
  el.closeBtn.addEventListener("click", () => el.dialog.close());
  el.cancelBtn.addEventListener("click", () => el.dialog.close());

  el.dialog.addEventListener("mousedown", event => {
    // Backdrop click only (mousedown avoids closing when a text selection ends outside).
    if (event.target === el.dialog) el.dialog.close();
  });

  el.title.addEventListener("input", () => {
    if (el.title.value.trim()) clearFieldError("title");
  });
  el.platform.addEventListener("change", () => {
    if (el.platform.value) clearFieldError("platform");
  });
  el.date.addEventListener("input", () => {
    const message = validateDate(el.date.value);
    if (message) setFieldError("date", message);
    else clearFieldError("date");
  });
  el.caption.addEventListener("input", updateCaptionCount);

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

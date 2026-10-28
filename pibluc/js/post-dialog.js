"use strict";

/**
 * Shared "Create / Edit post" dialog.
 * Used by BOTH the planner page and the weekly preview, so a post can be
 * created or edited without leaving the page the user is on.
 *
 *   const dialog = SF.initPostDialog({ getPosts, setPosts });
 *   dialog.openCreate("2026-10-28");   // preset date (optional)
 *   dialog.openEdit(postId);
 *
 * The page keeps ownership of its own `posts` array: the dialog reads it
 * through getPosts() and writes the new list through setPosts(list), which
 * should persist + re-render. It returns false if the save failed.
 */
(() => {
  const SF = window.SF;
  const {
    PLATFORMS, createId, todayISO, isValidDate, isPastDate, savePosts, showToast
  } = SF;

  SF.initPostDialog = function initPostDialog({ getPosts, setPosts }) {
    const $ = selector => document.querySelector(selector);

    const el = {
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

    /* ---------- Validation ---------- */

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

    /** The date this form may keep even though it is in the past (edit mode only). */
    function getOriginalDate() {
      const existing = getPosts().find(p => p.id === el.postId.value);
      return existing ? existing.date : null;
    }

    function validateDate(value) {
      if (!value || !isValidDate(value)) {
        return "Please choose a valid publication date.";
      }
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

    /* ---------- Open / close ---------- */

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

    function openCreate(presetDate = "") {
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
      if (!el.dialog.open) el.dialog.showModal();
      el.title.focus();
    }

    function openEdit(id) {
      const post = getPosts().find(item => item.id === id);
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
      if (!el.dialog.open) el.dialog.showModal();
      el.title.focus();
    }

    /* ---------- Submit ---------- */

    function handleSubmit(event) {
      event.preventDefault();

      if (!validateForm()) {
        el.form.querySelector('[aria-invalid="true"]')?.focus();
        return;
      }

      const posts = getPosts();
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

      const next = existing
        ? posts.map(post => (post.id === id ? postData : post))
        : [...posts, postData];

      if (setPosts(next) === false) return;

      el.dialog.close();
      showToast(existing ? "Post updated successfully." : "Post added to your plan.");
    }

    el.form.addEventListener("submit", handleSubmit);
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

    return { openCreate, openEdit };
  };
})();

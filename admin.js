document.addEventListener('DOMContentLoaded', () => {
  const SITE_CONTENT_API = '/api/site-content';
  const IMAGE_OVERRIDE_STORAGE_KEY = 'hb:image-overrides:v1';
  const IMAGE_SELECTOR_OVERRIDE_STORAGE_KEY = 'hb:image-selector-overrides:v1';
  const TEXT_SELECTOR_OVERRIDE_STORAGE_KEY = 'hb:text-selector-overrides:v1';

  const imageTargets = [
    { label: 'Navigation Logo (Top Left)', type: 'selector', selector: '.nav-logo-mark', selectValue: 'selector:.nav-logo-mark' },
    { label: 'Footer Logo', type: 'selector', selector: 'footer .footer-brand .nav-logo img', selectValue: 'selector:footer .footer-brand .nav-logo img' },
    { label: 'Hero Slider - Slide 1', type: 'key', key: 'hero-slide-1', selectValue: 'hero-slide-1' },
    { label: 'Hero Slider - Slide 2', type: 'key', key: 'hero-slide-2', selectValue: 'hero-slide-2' },
    { label: 'Hero Slider - Slide 3', type: 'key', key: 'hero-slide-3', selectValue: 'hero-slide-3' },
    { label: 'About Section - Main Image', type: 'key', key: 'about-main', selectValue: 'about-main' },
    { label: 'Services - Real Estate Card', type: 'key', key: 'service-real-estate', selectValue: 'service-real-estate' },
    { label: 'Services - Business Setup Card', type: 'key', key: 'service-business-setup', selectValue: 'service-business-setup' },
    { label: 'Services - Portfolio Card', type: 'key', key: 'service-portfolio', selectValue: 'service-portfolio' },
    { label: 'Team - Member 1 Photo', type: 'key', key: 'team-member-1', selectValue: 'team-member-1' },
    { label: 'Team - Member 2 Photo', type: 'key', key: 'team-member-2', selectValue: 'team-member-2' },
    { label: 'Team - Member 3 Photo', type: 'key', key: 'team-member-3', selectValue: 'team-member-3' },
    { label: 'Team - Member 4 Photo', type: 'key', key: 'team-member-4', selectValue: 'team-member-4' }
  ];

  const textSelectorMap = {
    'nav-about': '.nav-links li:nth-child(1) a',
    'nav-services': '.nav-links li:nth-child(2) a',
    'nav-gallery': '.nav-links li:nth-child(3) a',
    'nav-team': '.nav-links li:nth-child(4) a',
    'nav-contact': '.nav-links li:nth-child(5) a',
    'hero-eyebrow': '.hero-eyebrow',
    'hero-heading': '.hero-headline',
    'hero-description': '.hero-sub',
    'east-africa-badge-title': '#about .hero-location-badge strong',
    'east-africa-badge-countries': '#about .hero-location-badge',
    'about-heading': '#about .about-text h2',
    'services-heading': '#services .services-header h2',
    'team-heading': '#team .gallery-header h2',
    'values-heading': '#values .values-text h2',
    'values-copy': '#values .values-text p',
    'value-1-title': '#values .value-row:nth-child(1) .value-content h3',
    'value-1-copy': '#values .value-row:nth-child(1) .value-content p',
    'value-2-title': '#values .value-row:nth-child(2) .value-content h3',
    'value-2-copy': '#values .value-row:nth-child(2) .value-content p',
    'contact-office': '#contact .contact-detail:nth-child(1) .contact-detail-text span',
    'contact-email': '#contact .contact-detail:nth-child(2) .contact-detail-text span',
    'contact-phone': '#contact .contact-detail:nth-child(3) .contact-detail-text span',
    'contact-heading': '#contact .contact-info h2',
    'footer-description': 'footer .footer-brand p'
  };

  const textElementDropdown = document.getElementById('text-element');
  const oldTextInput = document.getElementById('old-text');
  const newTextInput = document.getElementById('new-text');
  const saveTextButton = document.getElementById('save-text');

  const imageElementDropdown = document.getElementById('image-element');
  const customImageSelectorWrap = document.getElementById('custom-image-selector-wrap');
  const customImageSelectorInput = document.getElementById('custom-image-selector');
  const imageTargetNote = document.getElementById('image-target-note');
  const newImageInput = document.getElementById('new-image');
  const imageCaptionInput = document.getElementById('image-caption');
  const saveImageButton = document.getElementById('save-image');
  const deleteImageButton = document.getElementById('delete-image');
  const imageManagerGrid = document.getElementById('image-manager-grid');
  const cardImageInput = document.getElementById('card-image-input');

  const contentDisplay = document.getElementById('content-display');
  let pendingCardTarget = null;
  let defaultSources = { byKey: {}, bySelector: {} };
  let isHydratingFromRemote = false;
  let syncTimer = null;

  function readJsonStorage(key, fallbackValue) {
    try {
      const rawValue = localStorage.getItem(key);
      return rawValue ? JSON.parse(rawValue) : fallbackValue;
    } catch (error) {
      return fallbackValue;
    }
  }

  function scheduleRemoteSync() {
    if (isHydratingFromRemote) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      pushLocalOverridesToRemote();
    }, 250);
  }

  function writeJsonStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    scheduleRemoteSync();
  }

  function getLocalOverrideBundle() {
    return {
      textOverrides: readJsonStorage(TEXT_SELECTOR_OVERRIDE_STORAGE_KEY, []),
      imageKeyOverrides: readJsonStorage(IMAGE_OVERRIDE_STORAGE_KEY, {}),
      imageSelectorOverrides: readJsonStorage(IMAGE_SELECTOR_OVERRIDE_STORAGE_KEY, [])
    };
  }

  async function pushLocalOverridesToRemote() {
    const localBundle = getLocalOverrideBundle();
    let payload = localBundle;

    try {
      const remoteResponse = await fetch(SITE_CONTENT_API);
      if (remoteResponse.ok) {
        const remotePayload = await remoteResponse.json();
        if (remotePayload && remotePayload.ok && remotePayload.data) {
          const existing = remotePayload.data;

          const textMap = Object.create(null);
          (existing.textOverrides || []).forEach((item) => {
            if (item && typeof item.selector === 'string') {
              textMap[item.selector] = item;
            }
          });
          (localBundle.textOverrides || []).forEach((item) => {
            if (item && typeof item.selector === 'string') {
              textMap[item.selector] = item;
            }
          });

          const selectorMap = Object.create(null);
          (existing.imageSelectorOverrides || []).forEach((item) => {
            if (item && typeof item.selector === 'string') {
              selectorMap[item.selector] = item;
            }
          });
          (localBundle.imageSelectorOverrides || []).forEach((item) => {
            if (item && typeof item.selector === 'string') {
              selectorMap[item.selector] = item;
            }
          });

          payload = {
            textOverrides: Object.keys(textMap).map((selector) => textMap[selector]),
            imageKeyOverrides: Object.assign({}, existing.imageKeyOverrides || {}, localBundle.imageKeyOverrides || {}),
            imageSelectorOverrides: Object.keys(selectorMap).map((selector) => selectorMap[selector])
          };
        }
      }
    } catch (error) {
      console.warn('Remote merge failed, using local bundle:', error);
      payload = localBundle;
    }

    try {
      const response = await fetch(SITE_CONTENT_API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.warn('Remote sync failed with status', response.status);
      }
    } catch (error) {
      console.warn('Remote sync failed:', error);
    }
  }

  async function hydrateFromRemote() {
    try {
      const response = await fetch(SITE_CONTENT_API);
      if (!response.ok) return;

      const payload = await response.json();
      if (!payload || !payload.ok || !payload.data) return;

      const data = payload.data;
      isHydratingFromRemote = true;
      localStorage.setItem(TEXT_SELECTOR_OVERRIDE_STORAGE_KEY, JSON.stringify(Array.isArray(data.textOverrides) ? data.textOverrides : []));
      localStorage.setItem(IMAGE_OVERRIDE_STORAGE_KEY, JSON.stringify(data.imageKeyOverrides && typeof data.imageKeyOverrides === 'object' ? data.imageKeyOverrides : {}));
      localStorage.setItem(IMAGE_SELECTOR_OVERRIDE_STORAGE_KEY, JSON.stringify(Array.isArray(data.imageSelectorOverrides) ? data.imageSelectorOverrides : []));
      isHydratingFromRemote = false;
    } catch (error) {
      isHydratingFromRemote = false;
    }
  }

  function getSelectedImageTarget() {
    const selectedValue = imageElementDropdown.value;

    if (selectedValue.startsWith('selector:')) {
      return {
        type: 'selector',
        selector: selectedValue.replace('selector:', '').trim(),
        selectValue: selectedValue
      };
    }

    if (selectedValue === 'custom-selector') {
      return {
        type: 'selector',
        selector: customImageSelectorInput.value.trim(),
        selectValue: selectedValue
      };
    }

    return {
      type: 'key',
      key: selectedValue,
      selectValue: selectedValue
    };
  }

  function normalizeKeyOverride(value) {
    if (typeof value === 'string') {
      return { src: value.trim(), alt: '', caption: '' };
    }
    if (value && typeof value === 'object') {
      return {
        src: typeof value.src === 'string' ? value.src.trim() : '',
        alt: typeof value.alt === 'string' ? value.alt.trim() : '',
        caption: typeof value.caption === 'string' ? value.caption.trim() : ''
      };
    }
    return { src: '', alt: '', caption: '' };
  }

  function getOverrideForTarget(target) {
    if (target.type === 'key') {
      const keyOverrides = readJsonStorage(IMAGE_OVERRIDE_STORAGE_KEY, {});
      const value = keyOverrides[target.key];
      if (!value) return null;
      return normalizeKeyOverride(value);
    }

    const selectorOverrides = readJsonStorage(IMAGE_SELECTOR_OVERRIDE_STORAGE_KEY, []);
    const item = selectorOverrides.find((entry) => entry && entry.selector === target.selector);
    if (!item) return null;
    return {
      src: typeof item.src === 'string' ? item.src.trim() : '',
      alt: typeof item.alt === 'string' ? item.alt.trim() : '',
      caption: typeof item.caption === 'string' ? item.caption.trim() : ''
    };
  }

  function getEffectiveImageData(target) {
    const override = getOverrideForTarget(target);
    const defaultSrc = target.type === 'key' ? (defaultSources.byKey[target.key] || '') : (defaultSources.bySelector[target.selector] || '');

    return {
      src: override && override.src ? override.src : defaultSrc,
      alt: override && override.alt ? override.alt : '',
      caption: override && override.caption ? override.caption : '',
      hasOverride: Boolean(override)
    };
  }

  function updateImageTargetUi() {
    const selectedText = imageElementDropdown.options[imageElementDropdown.selectedIndex].text;
    const isCustomSelector = imageElementDropdown.value === 'custom-selector';
    customImageSelectorWrap.classList.toggle('hidden', !isCustomSelector);
    imageTargetNote.textContent = 'Target: ' + selectedText;
  }

  function normalizeText(value) {
    return typeof value === 'string'
      ? value.replace(/\s+/g, ' ').trim()
      : '';
  }

  async function populateOldTextForSelectedTarget() {
    const selector = textSelectorMap[textElementDropdown.value];
    if (!selector) {
      oldTextInput.value = '';
      return;
    }

    const currentText = await resolveCurrentSiteText(selector);
    oldTextInput.value = currentText || '';
  }

  async function resolveCurrentSiteText(selector) {
    const textOverrides = readJsonStorage(TEXT_SELECTOR_OVERRIDE_STORAGE_KEY, []);
    const existingOverride = textOverrides.find((item) => item && item.selector === selector);
    if (existingOverride && typeof existingOverride.text === 'string') {
      return existingOverride.text;
    }

    try {
      const response = await fetch('index.html');
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const target = doc.querySelector(selector);
      if (!target) return '';
      const rawText = typeof target.innerText === 'string' ? target.innerText : target.textContent;
      return normalizeText(rawText);
    } catch (error) {
      return '';
    }
  }

  async function loadDefaultImageSources() {
    try {
      const response = await fetch('index.html');
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const byKey = {};
      const bySelector = {};

      imageTargets.forEach((target) => {
        if (target.type === 'key') {
          const imageEl = doc.querySelector('[data-image-key="' + target.key + '"]');
          byKey[target.key] = imageEl ? imageEl.getAttribute('src') || '' : '';
        } else {
          const imageEl = doc.querySelector(target.selector);
          bySelector[target.selector] = imageEl ? imageEl.getAttribute('src') || '' : '';
        }
      });

      defaultSources = { byKey, bySelector };
    } catch (error) {
      defaultSources = { byKey: {}, bySelector: {} };
    }
  }

  function refreshSummaryPanel() {
    const summary = {
      textOverrides: readJsonStorage(TEXT_SELECTOR_OVERRIDE_STORAGE_KEY, []),
      imageKeyOverrides: readJsonStorage(IMAGE_OVERRIDE_STORAGE_KEY, {}),
      imageSelectorOverrides: readJsonStorage(IMAGE_SELECTOR_OVERRIDE_STORAGE_KEY, [])
    };
    contentDisplay.textContent = JSON.stringify(summary, null, 2);
  }

  function renderImageManager() {
    imageManagerGrid.innerHTML = '';

    imageTargets.forEach((target) => {
      const imageData = getEffectiveImageData(target);
      const card = document.createElement('article');
      card.className = 'image-card';

      const preview = document.createElement('img');
      preview.className = 'image-card-preview';
      preview.src = imageData.src || '';
      preview.alt = imageData.alt || target.label;
      card.appendChild(preview);

      const title = document.createElement('div');
      title.className = 'image-card-title';
      title.textContent = target.label;
      card.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'image-card-meta';
      meta.textContent = imageData.hasOverride ? 'Custom image active' : 'Default image active';
      card.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'image-card-actions';

      const addNewBtn = document.createElement('button');
      addNewBtn.type = 'button';
      addNewBtn.textContent = 'Add New';
      addNewBtn.addEventListener('click', () => {
        pendingCardTarget = target;
        cardImageInput.click();
      });
      actions.appendChild(addNewBtn);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        const nextCaption = window.prompt('Edit image description/caption (optional):', imageData.caption || imageData.alt || '');
        if (nextCaption === null) return;

        const existingSrc = imageData.src;
        if (!existingSrc) {
          alert('No image found to edit for this section.');
          return;
        }

        saveImageForTarget(target, existingSrc, nextCaption.trim());
        alert('Image caption updated.');
      });
      actions.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'danger-btn';
      deleteBtn.addEventListener('click', () => {
        if (!window.confirm('Delete custom image for this section and revert to default?')) return;
        const deleted = deleteImageOverrideForTarget(target);
        if (!deleted) {
          alert('No custom image exists for this section.');
          return;
        }
        refreshSummaryPanel();
        renderImageManager();
        alert('Custom image deleted and reverted to default.');
      });
      actions.appendChild(deleteBtn);

      card.appendChild(actions);
      imageManagerGrid.appendChild(card);
    });
  }

  function deleteImageOverrideForTarget(target) {
    if (target.type === 'key') {
      const keyOverrides = readJsonStorage(IMAGE_OVERRIDE_STORAGE_KEY, {});
      if (!Object.prototype.hasOwnProperty.call(keyOverrides, target.key)) return false;
      delete keyOverrides[target.key];
      writeJsonStorage(IMAGE_OVERRIDE_STORAGE_KEY, keyOverrides);
      return true;
    }

    const selectorOverrides = readJsonStorage(IMAGE_SELECTOR_OVERRIDE_STORAGE_KEY, []);
    const next = selectorOverrides.filter((item) => !(item && item.selector === target.selector));
    if (next.length === selectorOverrides.length) return false;
    writeJsonStorage(IMAGE_SELECTOR_OVERRIDE_STORAGE_KEY, next);
    return true;
  }

  function saveImageForTarget(target, imageSrc, imageCaption) {
    const caption = imageCaption || '';
    if (target.type === 'key') {
      const keyOverrides = readJsonStorage(IMAGE_OVERRIDE_STORAGE_KEY, {});
      keyOverrides[target.key] = {
        src: imageSrc,
        alt: caption,
        caption
      };
      writeJsonStorage(IMAGE_OVERRIDE_STORAGE_KEY, keyOverrides);
    } else {
      const selectorOverrides = readJsonStorage(IMAGE_SELECTOR_OVERRIDE_STORAGE_KEY, []);
      const existingIndex = selectorOverrides.findIndex((item) => item && item.selector === target.selector);
      const entry = {
        selector: target.selector,
        src: imageSrc,
        alt: caption,
        caption
      };

      if (existingIndex >= 0) {
        selectorOverrides[existingIndex] = entry;
      } else {
        selectorOverrides.push(entry);
      }

      writeJsonStorage(IMAGE_SELECTOR_OVERRIDE_STORAGE_KEY, selectorOverrides);
    }

    refreshSummaryPanel();
    renderImageManager();
  }

  function findKnownTargetFromSelectValue(value) {
    return imageTargets.find((target) => target.selectValue === value) || null;
  }

  updateImageTargetUi();
  populateOldTextForSelectedTarget();

  hydrateFromRemote().then(() => {
    refreshSummaryPanel();
    loadDefaultImageSources().then(() => {
      renderImageManager();
    });
  });

  imageElementDropdown.addEventListener('change', updateImageTargetUi);
  textElementDropdown.addEventListener('change', populateOldTextForSelectedTarget);

  cardImageInput.addEventListener('change', () => {
    const file = cardImageInput.files[0];
    const target = pendingCardTarget;
    pendingCardTarget = null;

    if (!file || !target) {
      cardImageInput.value = '';
      return;
    }

    const caption = window.prompt('Optional image description/caption:', '') || '';
    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!imageDataUrl) {
        alert('Failed to read uploaded image.');
        return;
      }
      saveImageForTarget(target, imageDataUrl, caption.trim());
      alert('Image saved for ' + target.label + '.');
    };
    reader.readAsDataURL(file);
    cardImageInput.value = '';
  });

  saveTextButton.addEventListener('click', async () => {
    const targetKey = textElementDropdown.value;
    const selector = textSelectorMap[targetKey];
    const oldText = oldTextInput.value.trim();
    const newText = newTextInput.value.trim();

    if (!selector || !oldText || !newText) {
      alert('Please select a text area and enter both old and new text.');
      return;
    }

    const currentText = await resolveCurrentSiteText(selector);
    if (normalizeText(currentText) && normalizeText(currentText) !== normalizeText(oldText)) {
      const saveAnyway = window.confirm(
        'The text you entered does not match the current site text for this section.\n\n' +
        'Current site text:\n' + currentText + '\n\n' +
        'Save the new text anyway?'
      );
      if (!saveAnyway) return;
    }

    const textOverrides = readJsonStorage(TEXT_SELECTOR_OVERRIDE_STORAGE_KEY, []);
    const existingIndex = textOverrides.findIndex((item) => item && item.selector === selector);
    const newEntry = { selector, text: newText };

    if (existingIndex >= 0) {
      textOverrides[existingIndex] = newEntry;
    } else {
      textOverrides.push(newEntry);
    }

    writeJsonStorage(TEXT_SELECTOR_OVERRIDE_STORAGE_KEY, textOverrides);
    refreshSummaryPanel();
    alert('Text updated for selected site section. Refresh homepage to confirm.');
  });

  saveImageButton.addEventListener('click', () => {
    const target = getSelectedImageTarget();
    const newImageFile = newImageInput.files[0];
    const imageCaption = imageCaptionInput.value.trim();

    if (!newImageFile) {
      alert('Please upload an image file first.');
      return;
    }

    if (target.type === 'selector' && !target.selector) {
      alert('Please enter a valid CSS selector for the custom target.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!imageDataUrl) {
        alert('Failed to read the uploaded image. Please try again.');
        return;
      }

      saveImageForTarget(target, imageDataUrl, imageCaption);
      alert('Image updated for selected site part. Refresh homepage to confirm.');
      newImageInput.value = '';
      imageCaptionInput.value = '';
    };

    reader.readAsDataURL(newImageFile);
  });

  deleteImageButton.addEventListener('click', () => {
    const target = getSelectedImageTarget();
    if (target.type === 'selector' && !target.selector) {
      alert('Please enter a valid CSS selector for delete action.');
      return;
    }

    if (!window.confirm('Delete custom image override for this selected section?')) return;

    const knownTarget = findKnownTargetFromSelectValue(target.selectValue);
    const targetToDelete = knownTarget || target;
    const deleted = deleteImageOverrideForTarget(targetToDelete);

    if (!deleted) {
      alert('No custom image override found for this selection.');
      return;
    }

    refreshSummaryPanel();
    renderImageManager();
    alert('Selected image override deleted and reverted to default image.');
  });
});
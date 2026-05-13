document.addEventListener('DOMContentLoaded', () => {
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
    'about-heading': '#about .about-text h2',
    'services-heading': '#services .services-header h2',
    'team-heading': '#team .gallery-header h2',
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

  function readJsonStorage(key, fallbackValue) {
    try {
      const rawValue = localStorage.getItem(key);
      return rawValue ? JSON.parse(rawValue) : fallbackValue;
    } catch (error) {
      return fallbackValue;
    }
  }

  function writeJsonStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
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
      return target.textContent.trim();
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
  refreshSummaryPanel();

  loadDefaultImageSources().then(() => {
    renderImageManager();
  });

  imageElementDropdown.addEventListener('change', updateImageTargetUi);

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
    if (currentText && currentText !== oldText) {
      alert('Old text does not match current site text for this section. Please check and try again.');
      return;
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
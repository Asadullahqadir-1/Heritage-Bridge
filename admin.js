document.addEventListener('DOMContentLoaded', () => {
  const IMAGE_OVERRIDE_STORAGE_KEY = 'hb:image-overrides:v1';
  const IMAGE_SELECTOR_OVERRIDE_STORAGE_KEY = 'hb:image-selector-overrides:v1';
  const TEXT_SELECTOR_OVERRIDE_STORAGE_KEY = 'hb:text-selector-overrides:v1';

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

  const contentDisplay = document.getElementById('content-display');

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
        selector: selectedValue.replace('selector:', '').trim()
      };
    }

    if (selectedValue === 'custom-selector') {
      return {
        type: 'selector',
        selector: customImageSelectorInput.value.trim()
      };
    }

    return {
      type: 'key',
      key: selectedValue
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

  function refreshSummaryPanel() {
    const summary = {
      textOverrides: readJsonStorage(TEXT_SELECTOR_OVERRIDE_STORAGE_KEY, []),
      imageKeyOverrides: readJsonStorage(IMAGE_OVERRIDE_STORAGE_KEY, {}),
      imageSelectorOverrides: readJsonStorage(IMAGE_SELECTOR_OVERRIDE_STORAGE_KEY, [])
    };
    contentDisplay.textContent = JSON.stringify(summary, null, 2);
  }

  updateImageTargetUi();
  refreshSummaryPanel();

  imageElementDropdown.addEventListener('change', updateImageTargetUi);

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

      if (target.type === 'key') {
        const keyOverrides = readJsonStorage(IMAGE_OVERRIDE_STORAGE_KEY, {});
        keyOverrides[target.key] = {
          src: imageDataUrl,
          alt: imageCaption,
          caption: imageCaption
        };
        writeJsonStorage(IMAGE_OVERRIDE_STORAGE_KEY, keyOverrides);
      } else {
        const selectorOverrides = readJsonStorage(IMAGE_SELECTOR_OVERRIDE_STORAGE_KEY, []);
        const existingIndex = selectorOverrides.findIndex((item) => item && item.selector === target.selector);
        const newEntry = {
          selector: target.selector,
          src: imageDataUrl,
          alt: imageCaption,
          caption: imageCaption
        };

        if (existingIndex >= 0) {
          selectorOverrides[existingIndex] = newEntry;
        } else {
          selectorOverrides.push(newEntry);
        }

        writeJsonStorage(IMAGE_SELECTOR_OVERRIDE_STORAGE_KEY, selectorOverrides);
      }

      refreshSummaryPanel();
      alert('Image updated for selected site part. Refresh homepage to confirm.');
    };

    reader.readAsDataURL(newImageFile);
  });
});
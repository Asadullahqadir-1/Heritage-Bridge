document.addEventListener('DOMContentLoaded', () => {
  const textElementDropdown = document.getElementById('text-element');
  const oldTextInput = document.getElementById('old-text');
  const newTextInput = document.getElementById('new-text');
  const saveTextButton = document.getElementById('save-text');

  const imageElementDropdown = document.getElementById('image-element');
  const newImageInput = document.getElementById('new-image');
  const saveImageButton = document.getElementById('save-image');

  // Load existing content.json data
  fetch('content.json')
    .then(response => response.json())
    .then(data => {
      const contentDisplay = document.getElementById('content-display');
      contentDisplay.textContent = JSON.stringify(data, null, 2);
    });

  // Save new text content
  saveTextButton.addEventListener('click', () => {
    const selectedElement = textElementDropdown.value;
    const oldText = oldTextInput.value;
    const newText = newTextInput.value;

    if (!selectedElement || !oldText || !newText) {
      alert('Please select an element and enter both old and new text.');
      return;
    }

    fetch('content.json')
      .then(response => response.json())
      .then(data => {
        const keys = selectedElement.split('-');
        let current = data;

        // Navigate to the correct key in the JSON object
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            alert('Invalid element selected.');
            return;
          }
          current = current[keys[i]];
        }

        // Verify old text matches
        if (current[keys[keys.length - 1]] !== oldText) {
          alert('Old text does not match the current text. Please check and try again.');
          return;
        }

        // Update the text
        current[keys[keys.length - 1]] = newText;

        // Save the updated JSON back to the file
        fetch('save-content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        })
          .then(() => {
            alert('Text updated successfully!');
            location.reload();
          })
          .catch(err => {
            console.error('Error saving content:', err);
            alert('Failed to save changes.');
          });
      });
  });

  // Save new image content
  saveImageButton.addEventListener('click', () => {
    const selectedImage = imageElementDropdown.value;
    const newImageFile = newImageInput.files[0];

    if (!selectedImage || !newImageFile) {
      alert('Please select an image element and upload a new image.');
      return;
    }

    const formData = new FormData();
    formData.append('image', newImageFile);
    formData.append('element', selectedImage);

    fetch('upload-image', {
      method: 'POST',
      body: formData,
    })
      .then(() => {
        alert('Image updated successfully!');
        location.reload();
      })
      .catch(err => {
        console.error('Error uploading image:', err);
        alert('Failed to upload image.');
      });
  });
});
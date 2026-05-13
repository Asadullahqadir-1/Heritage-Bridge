document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('text-override-form');
  const selectorInput = document.getElementById('css-selector');
  const textInput = document.getElementById('replacement-text');
  const saveButton = document.getElementById('save-text-override');

  // Load existing content.json data
  fetch('content.json')
    .then(response => response.json())
    .then(data => {
      const contentDisplay = document.getElementById('content-display');
      contentDisplay.innerHTML = JSON.stringify(data, null, 2);
    });

  // Save new text override
  saveButton.addEventListener('click', () => {
    const selector = selectorInput.value;
    const newText = textInput.value;

    if (!selector || !newText) {
      alert('Please fill in both fields.');
      return;
    }

    fetch('content.json')
      .then(response => response.json())
      .then(data => {
        const keys = selector.split('.');
        let current = data;

        // Navigate to the correct key in the JSON object
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
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
});
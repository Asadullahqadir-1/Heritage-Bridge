document.addEventListener('DOMContentLoaded', () => {
  const signinForm = document.getElementById('signin-form');

  signinForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Updated authentication logic with new credentials
    if (username === 'heritagebridge' && password === 'HeritageBridge@123') {
      localStorage.setItem('isAuthenticated', 'true');
      window.location.href = 'admin.html';
    } else {
      alert('Invalid username or password. Please try again.');
    }
  });
});
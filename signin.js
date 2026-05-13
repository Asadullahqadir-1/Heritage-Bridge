document.addEventListener('DOMContentLoaded', () => {
  const signinForm = document.getElementById('signin-form');

  signinForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Simple authentication logic (replace with a secure backend authentication system in production)
    if (username === 'admin' && password === 'password123') {
      localStorage.setItem('isAuthenticated', 'true');
      window.location.href = 'admin.html';
    } else {
      alert('Invalid username or password. Please try again.');
    }
  });
});
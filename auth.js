// Update the registration logic to use your own backend API
document.getElementById("register").addEventListener("click", () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    fetch('https://your-backend-api.com/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    })
    .then(response => response.json())
    .then(data => alert(data.message))
    .catch(error => alert(error.message));
});

document.getElementById("login").addEventListener("click", () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    fetch('https://your-backend-api.com/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    })
    .then(response => response.json())
    .then(data => alert(data.message))
    .catch(error => alert(error.message));
});

document.getElementById("logout").addEventListener("click", () => {
    fetch('https://your-backend-api.com/logout', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => alert(data.message))
    .catch(error => alert(error.message));
});

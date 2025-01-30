document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const name = document.getElementById("regName").value;
    const email = document.getElementById("regEmail").value;
    const password = document.getElementById("regPassword").value;

    const response = await fetch("http://localhost:3000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();
    document.getElementById("message").innerText = data.message;
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    const response = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    
    if (data.token) {
        localStorage.setItem("token", data.token);
        document.getElementById("message").innerText = "Вход выполнен!";
    } else {
        document.getElementById("message").innerText = data.error;
    }
});


const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem("authToken"); // Retrieve token from local storage or context
    if (!token) {
        throw new Error("Unauthorized: No token provided");
    }

    const headers = {
        ...options.headers,
        Authorization: `Bearer ${token}`,
    };

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "API Error");
    }

    return response.json();
};
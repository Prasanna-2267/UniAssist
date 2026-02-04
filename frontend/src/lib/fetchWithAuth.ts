export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("college_token");

  const isFormData = options.body instanceof FormData;

  const res = await fetch(`http://localhost:8000${url}`, {
    ...options,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    let message = "Request failed";

    if (typeof data?.detail === "string") message = data.detail;
    else if (Array.isArray(data?.detail)) message = data.detail.map((e: any) => e.msg).join(", ");
    else if (data?.message) message = data.message;

    throw new Error(message);
  }

  return data;
}

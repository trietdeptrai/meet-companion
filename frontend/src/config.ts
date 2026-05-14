export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "",
  useMockApi: import.meta.env.VITE_USE_MOCK_API === "true",
};

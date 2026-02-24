function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getVisitorId(): string {
  let id = localStorage.getItem("zlog_visitor_id");
  if (!id) {
    id = generateUUID();
    localStorage.setItem("zlog_visitor_id", id);
  }
  return id;
}

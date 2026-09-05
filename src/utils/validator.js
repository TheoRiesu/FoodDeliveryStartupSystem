/**
 * Util: input validation helpers. Pure functions, no database access.
 */

export function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

export function requirePositiveNumber(value, fieldName) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`${fieldName} must be a number >= 0.`);
  }
  return num;
}

export function requirePositiveInt(value, fieldName) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return num;
}

export function requirePhone(value) {
  const phone = requireNonEmptyString(value, "phone");
  if (!/^[+\d][\d\s\-()]{5,19}$/.test(phone)) {
    throw new Error(
      "phone format looks invalid (expected 6-20 digits with optional + - ( ) spaces).",
    );
  }
  return phone;
}

export function requireCategory(value) {
  const category = String(value || "")
    .trim()
    .toLowerCase();
  if (category !== "food" && category !== "drink") {
    throw new Error("category must be 'food' or 'drink'.");
  }
  return category;
}

export function requirePaymentMethod(value) {
  const method = String(value || "")
    .trim()
    .toLowerCase();
  if (method !== "cash" && method !== "card" && method !== "ewallet") {
    throw new Error("method must be one of: cash, card, ewallet.");
  }
  return method;
}

/**
 * Parse a CLI item token of the form "<menuId>:<qty>".
 * @param {string} token
 */
export function parseItemToken(token) {
  const parts = String(token).split(":");
  if (parts.length !== 2) {
    throw new Error(`Invalid item "${token}". Expected format <menuId>:<qty>.`);
  }
  return {
    menuItemId: requirePositiveInt(parts[0], "menuId"),
    quantity: requirePositiveInt(parts[1], "qty"),
  };
}

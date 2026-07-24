export const formatTimeInput = (value) => {
  const raw = String(value || "").toUpperCase();
  const suffix = raw.includes("P") ? "PM" : raw.includes("A") ? "AM" : "";
  const digits = raw.replace(/\D/g, "").slice(0, 4);

  let time = digits;
  if (digits.length === 3) time = `${digits.slice(0, 1)}:${digits.slice(1)}`;
  if (digits.length === 4) time = `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return `${time}${suffix ? ` ${suffix}` : ""}`;
};

export const parseTimeInput = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return null;

  const suffix = raw.includes("P") ? "PM" : raw.includes("A") ? "AM" : null;
  const digits = raw.replace(/\D/g, "");
  let hours;
  let minutes;

  if (raw.includes(":")) {
    const [hourPart, minutePart = ""] = raw.split(":");
    hours = Number(hourPart.replace(/\D/g, ""));
    minutes = Number(minutePart.replace(/\D/g, "").slice(0, 2) || 0);
  } else if (digits.length <= 2) {
    hours = Number(digits);
    minutes = 0;
  } else if (digits.length === 3) {
    hours = Number(digits.slice(0, 1));
    minutes = Number(digits.slice(1));
  } else if (digits.length === 4) {
    hours = Number(digits.slice(0, 2));
    minutes = Number(digits.slice(2));
  } else {
    return null;
  }

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59) return null;
  if (suffix) {
    if (hours < 1 || hours > 12) return null;
    if (suffix === "AM") hours = hours === 12 ? 0 : hours;
    if (suffix === "PM") hours = hours === 12 ? 12 : hours + 12;
  } else if (hours < 0 || hours > 23) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export const timeValueToInput = (value) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hour24 = Number(match[1]);
  const minutes = match[2];
  if (hour24 < 0 || hour24 > 23) return "";
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minutes} ${suffix}`;
};

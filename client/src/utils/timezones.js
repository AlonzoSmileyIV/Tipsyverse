export const COMMON_US_TIMEZONES = [
  ["America/Indiana/Indianapolis", "Indiana Eastern Time"],
  ["America/Indiana/Knox", "Indiana Central Time"],
  ["America/New_York", "Eastern Time"],
  ["America/Detroit", "Michigan Eastern Time"],
  ["America/Chicago", "Central Time"],
  ["America/Denver", "Mountain Time"],
  ["America/Boise", "Idaho Mountain Time"],
  ["America/Phoenix", "Arizona Time"],
  ["America/Los_Angeles", "Pacific Time"],
  ["America/Anchorage", "Alaska Time"],
  ["Pacific/Honolulu", "Hawaii Time"],
  ["UTC", "UTC"],
];

export const formatTimezoneConfirmation = (timezone) => {
  if (!timezone) return "Unknown timezone";
  let name = timezone;
  try {
    name = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longGeneric",
    })
      .formatToParts(new Date())
      .find(({ type }) => type === "timeZoneName")?.value || timezone;
  } catch {
    return timezone;
  }
  const city = timezone.split("/").pop()?.replaceAll("_", " ");
  return city && city !== "UTC" ? `${name} (${city})` : name;
};

export default COMMON_US_TIMEZONES;

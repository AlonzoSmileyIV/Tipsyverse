import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Container,
  FormControlLabel,
  MenuItem,
  Stack,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useSelector, shallowEqual } from "react-redux";
import PhoneTextField from "../../components/PhoneTextField/PhoneTextField";
import LocationInput from "../../components/LocationInput/LocationInput";
import { parseDateOnlyParts } from "../../utils/dateOnly";
import {
  formatTimeInput,
  parseTimeInput,
  timeValueToInput,
} from "../../utils/timeInput";
import api from "../../services/api";
import { getBrowserTimeZone, zonedLocalDateTimeToIso } from "../../utils/timestamps";
import { COMMON_US_TIMEZONES } from "../../utils/timezones";

/* ----------------------------- CONSTANTS ----------------------------- */

const EVENT_TYPES = [
  { label: "Birthday", value: "birthday" },
  { label: "Wedding", value: "wedding" },
  { label: "Corporate / Professional", value: "corporate" },
  { label: "Formal", value: "formal" },
  { label: "Holiday Party", value: "holiday" },
  { label: "Private Dinner", value: "private" },
  { label: "Fundraiser", value: "fundraiser" },
  { label: "Other", value: "other" },
];

const POLICY_ITEMS = [
  {
    key: "detailsConfirmed",
    title: "Service Summary",
    script:
      "Before submitting this request, please carefully review the event details you provided, including the event type, requested service date and time, venue address, primary contact information, guest count if known, requested bartending support, special instructions, and any other details that may affect pricing or staffing. Tipsyverse uses this information to review availability, estimate service needs, prepare follow-up questions, and determine whether the event can be staffed. If any information is incomplete or inaccurate, pricing, staffing, timing, or service recommendations may change during the confirmation process.",
  },
  {
    key: "paymentPolicy",
    title: "Payment Policy",
    script:
      "A nonrefundable deposit may be required to reserve the event date. Unless Tipsyverse approves different written terms, the remaining balance is due seven calendar days before the event. Events confirmed within seven days require full payment at confirmation. Tipsyverse may send a reminder fourteen days before the event and a past-due warning five days before the event. An unpaid event may be placed on Payment Hold seventy-two hours before it begins; bartenders remain assigned, but final instructions, optional purchases, and additional event changes are paused. By forty-eight hours before the event, Tipsyverse must approve a documented payment arrangement or may cancel for nonpayment. Deposits and already-incurred, nonrecoverable costs may be retained as permitted by the agreed terms and applicable law. Tipsyverse will not automatically charge an unpaid balance unless expressly authorized. Additional approved charges may be billed separately.",
  },
  {
    key: "cancellationPolicy",
    title: "Cancellation Policy",
    script:
      "If you need to cancel, postpone, or reschedule your event, please notify Tipsyverse as soon as possible so we can communicate with assigned staff and adjust planning. Refunds, credits, transferred deposits, and rescheduling options depend on the timing of the cancellation, expenses already incurred, staff already assigned, and any payment or cancellation terms communicated for your booking. Tipsyverse may not be able to guarantee the same staff, pricing, or availability for a rescheduled date. Last-minute cancellations may still result in charges for administrative work, staff commitments, travel, procurement, or other costs already incurred.",
  },
  {
    key: "alcoholPolicy",
    title: "Alcohol Policy",
    script:
      "Tipsyverse provides professional bartending and event service support. Unless Tipsyverse separately agrees in writing to handle procurement or supply coordination, the client is responsible for purchasing, providing, and making available all alcohol for the event. The client is responsible for ensuring alcohol is obtained legally and in compliance with venue rules and applicable laws. Tipsyverse bartenders do not guarantee that the alcohol supplied by the client is sufficient for the entire event, appropriate for the guest count, or compliant with venue restrictions unless that has been separately reviewed and confirmed.",
  },
  {
    key: "ageVerificationPolicy",
    title: "Age Verification",
    script:
      "Tipsyverse bartenders may check identification before serving alcohol and may request valid government-issued identification from any guest who appears underage or whose age cannot be reasonably verified. Guests who cannot provide valid identification may be refused alcohol service. Bartenders may also refuse service to any person who appears visibly intoxicated, impaired, unsafe, or otherwise unable to consume alcohol responsibly. These decisions are made to promote safety and compliance and may not be overridden by the client, host, venue, or guest.",
  },
  {
    key: "refusalPolicy",
    title: "Refusal of Service",
    script:
      "Tipsyverse bartenders reserve the right to refuse alcohol service to any guest who appears intoxicated, presents invalid or questionable identification, attempts to provide alcohol to an underage person, behaves aggressively, threatens staff or guests, violates venue rules, or creates an unsafe environment. Refusal of service may apply to one guest, multiple guests, or the event as a whole if safety becomes a concern. Tipsyverse may contact the event host, venue contact, or appropriate support personnel if service conditions become unsafe.",
  },
  {
    key: "staffingPolicy",
    title: "Staffing Policy",
    script:
      "Tipsyverse will make every reasonable effort to provide the requested number of qualified bartenders for your event. Staffing recommendations are based on event timing, guest count, service style, location, bartender availability, and operational judgment. In rare cases, staffing changes may become necessary because of illness, emergencies, transportation issues, schedule conflicts, severe weather, or other circumstances outside of Tipsyverse’s control. If this happens, Tipsyverse may assign substitute bartenders, adjust staffing plans, communicate alternative options, or discuss a contingency plan with you. A request for bartenders is not considered fully guaranteed until Tipsyverse confirms staffing and payment requirements have been satisfied.",
  },
  {
    key: "conductPolicy",
    title: "Guest Conduct",
    script:
      "Clients, hosts, venue representatives, and guests are expected to treat Tipsyverse staff with respect and provide a reasonably safe working environment. Threatening, abusive, discriminatory, harassing, sexually inappropriate, violent, or unsafe behavior toward bartenders or other Tipsyverse representatives is not permitted. If staff safety becomes a concern, Tipsyverse staff may pause service, contact the event host or venue, refuse service to specific guests, or leave the event. The client remains responsible for the conduct of guests and for helping address unsafe or disruptive behavior when notified by Tipsyverse staff.",
  },
  {
    key: "venueRequirements",
    title: "Venue Requirements",
    script:
      "The client is responsible for ensuring that the venue allows bartending services and that Tipsyverse staff have a safe, accessible, and reasonably equipped workspace. This may include a stable service area, adequate lighting, reasonable access to water, electricity if needed, trash disposal, parking or loading access, and enough room for bartenders to work without creating hazards. Outdoor events should include reasonable protection from unsafe weather conditions when possible. If the venue imposes rules, insurance requirements, vendor policies, alcohol restrictions, loading instructions, or service limitations, the client should communicate those requirements to Tipsyverse before the event.",
  },
  {
    key: "equipmentResponsibility",
    title: "Equipment Responsibility",
    script:
      "Unless a package, quote, or written agreement specifically states that Tipsyverse will provide certain supplies, the client is responsible for providing all alcohol, ice, mixers, cups, garnishes, napkins, straws, beverage containers, coolers, tables, bar setup items, and other supplies needed for service. Tipsyverse may provide recommendations, estimates, or shopping guidance, but those recommendations are not a guarantee that supplies will be exact for every guest’s consumption. If Tipsyverse agrees to purchase or pick up items on the client’s behalf, the client may be responsible for the item cost, proof of purchase, procurement fees, delivery or travel charges, and payment before the event begins.",
  },
  {
    key: "overtimePolicy",
    title: "Overtime Policy",
    script:
      "The booking is based on the scheduled start and end times provided during the confirmation process. If the event runs longer than scheduled and bartenders are available to stay, additional time may be billed at Tipsyverse’s standard overtime rate or another rate communicated for your event. Overtime is not guaranteed and depends on bartender availability, venue rules, safety, and scheduling constraints. If bartenders are not available to stay beyond the scheduled end time, service may end as originally planned even if the event continues.",
  },
  {
    key: "liabilityPolicy",
    title: "Liability",
    script:
      "Tipsyverse is not responsible for injuries, damages, property loss, venue charges, guest behavior, alcohol misuse, or incidents caused by guests, hosts, venues, third-party vendors, or alcohol and supplies provided by the client, except where responsibility is required by applicable law. The client is responsible for the event environment, guest conduct, venue compliance, and any alcohol or products the client supplies. Tipsyverse staff will use reasonable professional judgment while performing services, but Tipsyverse cannot control guest consumption, venue conditions, or actions taken by people outside of Tipsyverse’s staff.",
  },
  {
    key: "contactInformationPolicy",
    title: "Contact Information",
    script:
      "Please notify Tipsyverse as soon as possible if any event details change, including the venue, address, parking instructions, event timeline, guest count, bar setup, drink menu, alcohol availability, contact person, phone number, email address, or venue restrictions. Changes may affect pricing, staff recommendations, arrival time, supplies, and whether the event can be staffed as planned. Tipsyverse is not responsible for delays, staffing issues, or service limitations caused by inaccurate, missing, or late information.",
  },
  {
    key: "termsOfService",
    title: "Final Agreement",
    script:
      "By moving forward with this booking request, you acknowledge that you have had an opportunity to review these policies, that the information you provided is accurate to the best of your knowledge, and that you agree to the Tipsyverse booking terms, service policies, and agreement. You understand that Tipsyverse may contact you to confirm details, adjust pricing, request payment, clarify staffing needs, or decline service if the event cannot be supported. You also understand that final service details are subject to Tipsyverse review, confirmation, staffing availability, and any payment requirements communicated for your event.",
  },
];

const emptyPolicyChecks = POLICY_ITEMS.reduce(
  (acc, item) => ({ ...acc, [item.key]: false }),
  {}
);

/* -------------------------- PAYLOAD SHAPING -------------------------- */

function shapePayload(form) {
  const {
    eventType,
    description,
    contactFullName,
    contactEmail,
    phoneCode,
    phoneLocal,
    contactPhone,
    preferredContact,
    address1,
    address2,
    city,
    county,
    state,
    zipcode,
    country,
    formattedAddress,
    placeId,
    latitude,
    longitude,
    instructions,
    startAt,
    endAt,
    policyChecks,
    mediaPreference,
    acceptedTerms,
    timezone,
  } = form;

  const point =
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { type: "Point", coordinates: [Number(longitude), Number(latitude)] }
      : undefined;

  const sanitizedLocal = String(phoneLocal || "").replace(/\D/g, "");
  const phone =
    sanitizedLocal.length > 0
      ? `${phoneCode || "+1"}${sanitizedLocal}`
      : (contactPhone || "").trim();

  return {
    type: eventType,
    description: description?.trim() || "",
    additionalInstructions: instructions?.trim() || "",
    startAt: startAt
      ? zonedLocalDateTimeToIso(
          startAt.slice(0, 10),
          startAt.slice(11, 16),
          timezone || getBrowserTimeZone()
        )
      : null,
    endAt: endAt
      ? zonedLocalDateTimeToIso(
          endAt.slice(0, 10),
          endAt.slice(11, 16),
          timezone || getBrowserTimeZone()
        )
      : null,
    timezone: timezone || getBrowserTimeZone(),
    contact: {
      fullName: contactFullName?.trim() || "",
      email: contactEmail?.trim() || "",
      phone,
      preferred: preferredContact || "call", // 👈 HERE
    },
    location: {
      address1: address1?.trim() || "",
      address2: address2?.trim() || "",
      city: city?.trim() || "",
      county: county?.trim() || "",
      state: state?.trim() || "",
      zipcode: zipcode?.trim() || "",
      country: country?.trim() || "US",
      formatted: formattedAddress || "",
      placeId: placeId || "",
      point,
      timezone: timezone || getBrowserTimeZone(),
    },
    options: {
      barType: "unknown",
      procurementRequested: false,
      tipJarsAllowed: true,
    },
    agreements: {
      reviewedAt: new Date().toISOString(),
      reviewedBy: "customer",
      method: "self_service_booking",
      customerConfirmed: !!acceptedTerms,
      ...policyChecks,
      mediaPolicy: mediaPreference === "accepted",
      mediaPreference,
      acceptedTerms: !!acceptedTerms,
    },
  };
}

/* ------------------------------ HELPERS ------------------------------ */

const parseLocal = (s) => (s ? new Date(s) : null);

const formatWhen = (startStr, endStr) => {
  const s = parseLocal(startStr);
  const e = parseLocal(endStr);
  if (!s || !e || isNaN(s) || isNaN(e)) return "—";
  const sameDay = s.toDateString() === e.toDateString();

  const dateFmt = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const mins = Math.max(0, Math.round((e - s) / 60000));
  const dur =
    mins >= 60
      ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`
      : `${mins}m`;

  if (sameDay)
    return `${dateFmt.format(s)} • ${timeFmt.format(s)}–${timeFmt.format(
      e
    )} (${dur})`;
  return `${dateFmt.format(s)} ${timeFmt.format(s)} → ${dateFmt.format(
    e
  )} ${timeFmt.format(e)} (${dur})`;
};

const regionLabelFor = (c) =>
  ({ US: "State", CA: "Province", GB: "County/Region", AU: "State/Territory" }[
    c
  ] || "Region");
const regionRequiredFor = (c) => ["US", "CA", "AU"].includes(c);
const postalRuleFor = (c) => {
  switch (c) {
    case "US":
      return {
        required: true,
        pattern: /^\d{5}(-\d{4})?$/,
        hint: "##### or #####-####",
      };
    case "CA":
      return {
        required: true,
        pattern: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
        hint: "A1A 1A1",
      };
    case "GB":
      return {
        required: true,
        pattern:
          /^([Gg][Ii][Rr]\s?0[Aa]{2}|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-HJ-Ya-hj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-HJ-Ya-hj-y][0-9][A-Za-z]?))))\s?[0-9][A-Za-z]{2}))$/,
        hint: "e.g. SW1A 1AA",
      };
    case "AU":
      return { required: true, pattern: /^\d{4}$/, hint: "4 digits" };
    default:
      return { required: false, pattern: null, hint: "" };
  }
};
const postalLabelFor = (c) => (c === "US" ? "ZIP Code" : "Postal Code");
const TIME_INTERVAL_MINUTES = 15;
const emailLooksValid = (value) => /\S+@\S+\.\S+/.test(String(value || ""));
const snapTimeToInterval = (value) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const hours = Math.min(23, Math.max(0, Number(match[1]) || 0));
  const minutes = Math.min(59, Math.max(0, Number(match[2]) || 0));
  let total = hours * 60 + minutes;
  total = Math.round(total / TIME_INTERVAL_MINUTES) * TIME_INTERVAL_MINUTES;
  total = Math.min(total, 23 * 60 + (60 - TIME_INTERVAL_MINUTES));
  const snappedHour = Math.floor(total / 60);
  const snappedMinute = total % 60;
  return `${String(snappedHour).padStart(2, "0")}:${String(snappedMinute).padStart(2, "0")}`;
};

const formatDateInput = (value) => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const datePartsToInput = (value) => {
  const parts = parseDateOnlyParts(value);
  if (!parts) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${pad(parts.month)}/${pad(parts.day)}/${parts.year}`;
};

const datePartsToDatePart = (parts) => {
  if (!parts) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
};

const getNextWeekendWindow = () => {
  const start = new Date();
  const day = start.getDay();
  const daysUntilSaturday = day === 6 ? 7 : (6 - day + 7) % 7;
  start.setDate(start.getDate() + daysUntilSaturday);
  start.setHours(17, 0, 0, 0);
  const end = new Date(start);
  end.setHours(21, 0, 0, 0);
  return { start, end };
};

// put near the top of the file
function pickNonEmpty(obj) {
  const out = {};
  if (!obj) return out;
  // plain for..in avoids Object.entries/fromEntries for older environments
  for (const k in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
    const v = obj[k];
    if (v !== "" && v != null) out[k] = v;
  }
  return out;
}

/* =============================== COMPONENT =============================== */

export default function BookEventForm({
  onSubmit,
  onCancel,
  initialData,
  restrictCountry = "US",
}) {
  // stable, primitive-only selector so identity doesn't flip each render
  const logged = useSelector(
    (s) => ({
      fullName: s?.users?.loggedInUser?.user?.fullName ?? "",
      email: s?.users?.loggedInUser?.user?.email ?? "",
      phone: s?.users?.loggedInUser?.user?.profile?.phone ?? "",
      accountStatus: s?.users?.loggedInUser?.user?.accountStatus ?? null,
    }),
    shallowEqual
  );

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({});
  const [attemptedNext, setAttemptedNext] = useState(false);
  const showError = (field) =>
    Boolean(errors[field] && (touched[field] || attemptedNext));

  const [form, setForm] = useState({
    contactFullName: "",
    contactEmail: "",
    contactPhone: "",
    phoneCode: "+1",
    phoneLocal: "",
    preferredContact: "call",
    eventType: "",
    description: "",
    address1: "",
    address2: "",
    city: "",
    county: "",
    state: "",
    zipcode: "",
    country: "US",
    latitude: null,
    longitude: null,
    placeId: "",
    formattedAddress: "",
    instructions: "",
    startAt: "",
    endAt: "",
    policyChecks: emptyPolicyChecks,
    mediaPreference: "",
    acceptedTerms: false,
    timezone: getBrowserTimeZone(),
  });
  const [dateInputs, setDateInputs] = useState({ startAt: "", endAt: "" });
  const [timeInputs, setTimeInputs] = useState({ startAt: "", endAt: "" });
  const [bookingEligibility, setBookingEligibility] = useState({
    checking: false,
    eligible: true,
    reason: "",
  });

  // memoize initialData fields into a stable object to satisfy exhaustive-deps
  // replace your current initialShape useMemo with these two blocks:
  const initialShapeRaw = useMemo(
    () => ({
      contactFullName: initialData?.contactFullName ?? "",
      contactEmail: initialData?.contactEmail ?? "",
      contactPhone: initialData?.contactPhone ?? "",
      preferredContact:
        initialData?.preferredContact ?? initialData?.contactPreferred ?? "",
      eventType: initialData?.eventType ?? "",
      description: initialData?.description ?? "",
      address1: initialData?.address1 ?? "",
      city: initialData?.city ?? "",
      state: initialData?.state ?? "",
      zipcode: initialData?.zipcode ?? "",
      country: initialData?.country ?? "",
      startAt: initialData?.startAt ?? "",
      endAt: initialData?.endAt ?? "",
    }),
    [initialData]
  );

  const initialShape = useMemo(
    () => pickNonEmpty(initialShapeRaw),
    [initialShapeRaw]
  );

  // prefill from logged user + initialData; only set when it actually changes
  useEffect(() => {
    setForm((f) => {
      // logged-in defaults first
      let next = {
        ...f,
        contactFullName: f.contactFullName || logged.fullName || "",
        contactEmail: f.contactEmail || logged.email || "",
        contactPhone: f.contactPhone || logged.phone || "",
      };
      // only apply initialData fields that are non-empty
      if (Object.keys(initialShape).length) next = { ...next, ...initialShape };
      if (next.startAt || next.endAt) {
        setDateInputs((current) => ({
          startAt: next.startAt ? datePartsToInput(next.startAt) : current.startAt,
          endAt: next.endAt ? datePartsToInput(next.endAt) : current.endAt,
        }));
        setTimeInputs((current) => ({
          startAt: next.startAt
            ? timeValueToInput(toLocalInput(next.startAt).slice(11, 16))
            : current.startAt,
          endAt: next.endAt
            ? timeValueToInput(toLocalInput(next.endAt).slice(11, 16))
            : current.endAt,
        }));
      }

      // shallow compare to avoid unnecessary updates
      const keys = new Set([...Object.keys(f), ...Object.keys(next)]);
      for (const k of keys) if (f[k] !== next[k]) return next;
      return f;
    });
  }, [logged.fullName, logged.email, logged.phone, initialShape]);

  useEffect(() => {
    const status = logged.accountStatus || {};
    if (
      form.contactEmail &&
      logged.email &&
      form.contactEmail.toLowerCase() === logged.email.toLowerCase()
    ) {
      if (status.state === "Suspended") {
        setBookingEligibility({
          checking: false,
          eligible: false,
          reason:
            status.suspensionExplanation ||
            status.reasonForSuspension ||
            "Your account is currently suspended.",
        });
        return;
      }
      if (status.allowedToBookEvent === false) {
        setBookingEligibility({
          checking: false,
          eligible: false,
          reason:
            status.bookingRestrictionReason ||
            "This account is not currently allowed to book events.",
        });
        return;
      }
    }

    if (!emailLooksValid(form.contactEmail)) {
      setBookingEligibility({ checking: false, eligible: true, reason: "" });
      return;
    }

    let active = true;
    setBookingEligibility((current) => ({ ...current, checking: true }));
    const timer = window.setTimeout(async () => {
      try {
        const res = await api.get("/users/booking-eligibility", {
          params: { email: form.contactEmail },
        });
        if (!active) return;
        setBookingEligibility({
          checking: false,
          eligible: res?.data?.data?.eligible !== false,
          reason: res?.data?.data?.reason || "",
        });
      } catch {
        if (!active) return;
        setBookingEligibility({ checking: false, eligible: true, reason: "" });
      }
    }, 400);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [form.contactEmail, logged.accountStatus, logged.email]);

  /* --------------------------------- FORM --------------------------------- */

  const steps = ["Event and Contact Info", "Location", "Timing", "Policies", "Review"];

  const toLocalInput = (date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  const getDatePart = (value) => (value ? String(value).slice(0, 10) : "");
  const getTimePart = (value) => (value ? String(value).slice(11, 16) : "");
  const combineDateTime = (date, time) =>
    date && time ? `${date}T${time}` : "";
  const plusHoursLocal = (value, hours) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    date.setHours(date.getHours() + hours);
    return toLocalInput(date);
  };
  const nowMinLocal = toLocalInput(new Date());

  // one-time default for start/end
  useEffect(() => {
    const { start, end } = getNextWeekendWindow();
    const defaultStartAt = toLocalInput(start);
    const defaultEndAt = toLocalInput(end);

    setForm((f) => {
      if (f.startAt) return f;
      return {
        ...f,
        startAt: defaultStartAt,
        endAt: f.endAt || defaultEndAt,
      };
    });
    setDateInputs((current) => ({
      startAt: current.startAt || datePartsToInput(start),
      endAt: current.endAt || datePartsToInput(end),
    }));
    setTimeInputs((current) => ({
      startAt:
        current.startAt || timeValueToInput(getTimePart(defaultStartAt)),
      endAt: current.endAt || timeValueToInput(getTimePart(defaultEndAt)),
    }));
  }, []);

  const errors = useMemo(() => {
    const e = {};
    const phoneDigits = `${form.phoneLocal || form.contactPhone || ""}`.replace(
      /\D/g,
      ""
    );
    const wantsPhoneContact = ["call", "text"].includes(form.preferredContact);

    if (step === 0) {
      if (!form.eventType) e.eventType = "Select an event type.";
      if (!form.contactEmail) e.contactEmail = "Email is required.";
      if (!form.contactFullName) e.contactFullName = "Name is required.";
      if (wantsPhoneContact && phoneDigits.length < 10) {
        e.contactPhone = "Please enter phone number.";
      }
    }
    if (step === 1) {
      if (!form.address1) e.address1 = "Address is required.";
      if (!form.city) e.city = "City is required.";
      if (regionRequiredFor(form.country) && !form.state)
        e.state = `${regionLabelFor(form.country)} is required.`;
      const { required: zipReq, pattern: zipPattern } = postalRuleFor(
        form.country
      );
      if (zipReq && !form.zipcode)
        e.zipcode = `${postalLabelFor(form.country)} is required.`;
      else if (
        form.zipcode &&
        zipPattern &&
        !zipPattern.test(form.zipcode.trim())
      )
        e.zipcode = `Invalid ${postalLabelFor(form.country)} format.`;
      if (!form.country) e.country = "Country is required.";
    }
    if (step === 2) {
      if (!form.startAt) e.startAt = "Start is required.";
      if (!form.endAt) e.endAt = "End is required.";
      if (!parseDateOnlyParts(dateInputs.startAt)) e.startAt = "Enter arrival date as MM/DD/YYYY.";
      if (!parseDateOnlyParts(dateInputs.endAt)) e.endAt = "Enter leaving date as MM/DD/YYYY.";
      if (!parseTimeInput(timeInputs.startAt)) e.startAt = "Enter arrival time, such as 5:30 PM.";
      if (!parseTimeInput(timeInputs.endAt)) e.endAt = "Enter leaving time, such as 9:30 PM.";
      if (
        form.startAt &&
        form.endAt &&
        new Date(form.endAt) <= new Date(form.startAt)
      )
        e.endAt = "End must be after start.";
    }
    if (step === 3) {
      if (!form.acceptedTerms) e.acceptedTerms = "You must agree before submitting.";
      if (!form.mediaPreference) e.mediaPreference = "Choose a media preference.";
    }
    return e;
  }, [step, form, dateInputs, timeInputs]);

  const bookingBlocked = bookingEligibility.eligible === false;
  const hasErrors = Object.keys(errors).length > 0 || (step === 0 && bookingBlocked);

  const next = () => {
    setAttemptedNext(true);

    if (!hasErrors) {
      // The formatted date/time controls are the source of truth on this step.
      // Commit even untouched default times before rendering the review.
      if (step === 2) {
        const startDate = parseDateOnlyParts(dateInputs.startAt);
        const endDate = parseDateOnlyParts(dateInputs.endAt);
        const startTime = parseTimeInput(timeInputs.startAt);
        const endTime = parseTimeInput(timeInputs.endAt);

        setForm((current) => ({
          ...current,
          startAt: combineDateTime(datePartsToDatePart(startDate), startTime),
          endAt: combineDateTime(datePartsToDatePart(endDate), endTime),
        }));
      }
      setAttemptedNext(false);
      setTouched({});
      setStep((s) => Math.min(s + 1, steps.length - 1));
    }
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const update = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => {
      const n = { ...f, [k]: v };
      if (k === "startAt") {
        if (!f.endAt || new Date(f.endAt) <= new Date(v)) {
          const end = new Date(v);
          end.setHours(end.getHours() + 4);
          n.endAt = toLocalInput(end);
        }
      }
      return n;
    });
  };
  const updateDateTimePart = (field, part) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const current = f[field] || nowMinLocal;
      const date = part === "date" ? value : getDatePart(current);
      const time = part === "time" ? value : getTimePart(current);
      const nextValue = combineDateTime(date, time);
      const next = { ...f, [field]: nextValue };

      if (
        field === "startAt" &&
        (!f.endAt || new Date(f.endAt) <= new Date(nextValue))
      ) {
        next.endAt = plusHoursLocal(nextValue, 4);
        setTimeInputs((currentInputs) => ({
          ...currentInputs,
          endAt: timeValueToInput(getTimePart(next.endAt)),
        }));
      }

      return next;
    });
  };
  const updateDateTextPart = (field) => (e) => {
    const value = formatDateInput(e.target.value);
    setDateInputs((current) => ({ ...current, [field]: value }));
    const parts = parseDateOnlyParts(value);
    if (!parts) return;

    setForm((f) => {
      const current = f[field] || nowMinLocal;
      const date = datePartsToDatePart(parts);
      const time = getTimePart(current) || (field === "startAt" ? "17:00" : "21:00");
      const nextValue = combineDateTime(date, time);
      const next = { ...f, [field]: nextValue };

      if (
        field === "startAt" &&
        (!f.endAt || new Date(f.endAt) <= new Date(nextValue))
      ) {
        const endValue = combineDateTime(date, "21:00");
        next.endAt = endValue;
        setDateInputs((currentInputs) => ({ ...currentInputs, endAt: value }));
      }

      return next;
    });
  };
  const normalizeTimePart = (field) => () => {
    const parsed = parseTimeInput(timeInputs[field]);
    if (!parsed) return;
    setForm((f) => {
      const current = f[field] || nowMinLocal;
      const snappedTime = snapTimeToInterval(parsed);
      const nextValue = combineDateTime(getDatePart(current), snappedTime);
      const next = { ...f, [field]: nextValue };

      if (
        field === "startAt" &&
        (!f.endAt || new Date(f.endAt) <= new Date(nextValue))
      ) {
        next.endAt = plusHoursLocal(nextValue, 4);
      }

      return next;
    });
    const snappedTime = snapTimeToInterval(parsed);
    setTimeInputs((current) => ({
      ...current,
      [field]: timeValueToInput(snappedTime),
    }));
  };

  const updateTimeTextPart = (field) => (e) => {
    const displayValue = formatTimeInput(e.target.value);
    setTimeInputs((current) => ({ ...current, [field]: displayValue }));
    const parsed = parseTimeInput(displayValue);
    if (!parsed) return;
    updateDateTimePart(field, "time")({ target: { value: parsed } });
  };

  const handleSubmit = async () => {
    // final validation gate
    const finalErr =
      !form.eventType ||
      !form.address1 ||
      !form.city ||
      !form.state ||
      !form.zipcode ||
      !form.country ||
      !form.startAt ||
      !form.endAt ||
      !form.mediaPreference ||
      !form.acceptedTerms ||
      (form.startAt &&
        form.endAt &&
        new Date(form.endAt) <= new Date(form.startAt));

    if (finalErr) return;

    setSubmitting(true);
    try {
      const payload = shapePayload(form);
      await onSubmit?.(payload);
      // console.log('payload: ', payload);
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------------- RENDER -------------------------------- */

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Card sx={{ borderRadius: 3 }}>
        <CardHeader
          title={
            <Typography variant="h5" fontWeight={800}>
              Book an Event
            </Typography>
          }
          subheader="Tell us the basics — we’ll confirm the rest with you."
        />
        <CardContent>
          <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel
                  StepIconProps={{
                    sx: {
                      color: "grey", // idle
                      "&.Mui-active": {
                        color: "var(--primary-color) !important",
                      },
                      "&.Mui-completed": {
                        color: "var(--primary-color) !important",
                      },
                    },
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Step 0: Event */}
          {step === 0 && (
            <Stack spacing={2}>
              <TextField
                select
                fullWidth
                label="Event Type"
                value={form.eventType}
                onChange={update("eventType")}
                onBlur={() => setTouched((t) => ({ ...t, eventType: true }))}
                error={showError("eventType")}
                helperText={showError("eventType") ? errors.eventType : ""}
              >
                {EVENT_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Event Description (optional)"
                placeholder="Tell us a bit about the event or vibe."
                value={form.description}
                onChange={update("description")}
              />

              <TextField
                fullWidth
                label="Primary Contact Name"
                value={form.contactFullName}
                onChange={update("contactFullName")}
                error={showError("contactFullName")}
                onBlur={() =>
                  setTouched((t) => ({ ...t, contactFullName: true }))
                }
                helperText={
                  showError("contactFullName") ? errors.contactFullName : ""
                }
              />
              <TextField
                fullWidth
                type="email"
                label="Primary Contact Email"
                value={form.contactEmail}
                onChange={update("contactEmail")}
                onBlur={() => setTouched((t) => ({ ...t, contactEmail: true }))}
                error={showError("contactEmail")}
                helperText={
                  showError("contactEmail") ? errors.contactEmail : ""
                }
              />

              <PhoneTextField
                label="Primary Contact Phone"
                defaultCountry="us"
                value={`${form.phoneCode || "+1"}${form.phoneLocal || ""}`}
                error={showError("contactPhone")}
                helperText={
                  showError("contactPhone") ? errors.contactPhone : ""
                }
                onBlur={() => setTouched((t) => ({ ...t, contactPhone: true }))}
                onChange={(val, meta) => {
                  const dial = meta?.country?.dialCode
                    ? `+${meta.country.dialCode}`
                    : "+1";
                  const stripped = String(val)
                    .replace(new RegExp(`^\\+?${meta?.country?.dialCode}`), "")
                    .replace(/\D/g, "");

                  setForm((f) => ({
                    ...f,
                    phoneCode: dial,
                    phoneLocal: stripped,
                  }));
                }}
              />

              {bookingBlocked && (
                <Alert severity="warning">
                  Hey, you can’t book an event with this email because{" "}
                  {bookingEligibility.reason || "this account is restricted"}
                </Alert>
              )}

              {/* Preferred Method of Contact 👇 */}
              <TextField
                select
                fullWidth
                label="Preferred Method of Contact"
                value={form.preferredContact}
                onChange={update("preferredContact")}
              >
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="call">Call</MenuItem>
                <MenuItem value="text">Text</MenuItem>
              </TextField>
            </Stack>
          )}

          {/* Step 1: Location */}
          {step === 1 && (
            <LocationInput
              value={{
                address1: form.address1,
                address2: form.address2,
                city: form.city,
                county: form.county,
                state: form.state,
                zipcode: form.zipcode,
                country: form.country,
                latitude: form.latitude,
                longitude: form.longitude,
                placeId: form.placeId,
                formattedAddress: form.formattedAddress,
                instructions: form.instructions,
              }}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              onBlur={() => setTouched((t) => ({ ...t, contactEmail: true }))}
              errors={errors}
              touched={touched}
              setTouched={setTouched}
              restrictCountry={restrictCountry}
            />
          )}

          {/* Step 2: Timing */}
          {step === 2 && (
            <Stack spacing={2}>
              <Typography variant="body2">
                Please change the times accordingly
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  label="Arrival Date"
                  placeholder="MM/DD/YYYY"
                  value={dateInputs.startAt}
                  onChange={updateDateTextPart("startAt")}
                  error={!!errors.startAt}
                  helperText={errors.startAt || "Use MM/DD/YYYY."}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ inputMode: "numeric", maxLength: 10 }}
                />
                <TextField
                  fullWidth
                  type="text"
                  label="Arrival Time"
                  placeholder="5:30 PM"
                  value={timeInputs.startAt}
                  onChange={updateTimeTextPart("startAt")}
                  onBlur={normalizeTimePart("startAt")}
                  error={!!errors.startAt}
                  helperText={errors.startAt || "Snaps to 15 minutes."}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ inputMode: "text", maxLength: 8 }}
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  label="Leave Date"
                  placeholder="MM/DD/YYYY"
                  value={dateInputs.endAt}
                  onChange={updateDateTextPart("endAt")}
                  error={!!errors.endAt}
                  helperText={errors.endAt || "Use MM/DD/YYYY."}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ inputMode: "numeric", maxLength: 10 }}
                />
                <TextField
                  fullWidth
                  type="text"
                  label="Leave Time"
                  placeholder="9:30 PM"
                  value={timeInputs.endAt}
                  onChange={updateTimeTextPart("endAt")}
                  onBlur={normalizeTimePart("endAt")}
                  error={!!errors.endAt}
                  helperText={errors.endAt || "Snaps to 15 minutes."}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ inputMode: "text", maxLength: 8 }}
                />
              </Stack>
                <TextField
                select
                fullWidth
                label="Event Timezone"
                value={form.timezone}
                onChange={update("timezone")}
                helperText="Times are saved and displayed in the venue's timezone."
              >
                {COMMON_US_TIMEZONES.map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label} ({value})
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <Stack spacing={2}>
              <ReviewRow
                label="Type"
                value={
                  EVENT_TYPES.find((t) => t.value === form.eventType)?.label ||
                  "—"
                }
              />
              <ReviewRow
                label="When"
                value={formatWhen(form.startAt, form.endAt)}
              />
              <ReviewRow
                label="Where"
                value={[
                  form.address1,
                  form.address2,
                  [form.city, form.state].filter(Boolean).join(", "),
                  [form.zipcode, form.country].filter(Boolean).join(" "),
                ]
                  .filter(Boolean)
                  .join(" • ")}
              />
              <ReviewRow
                label="Instructions"
                value={form.instructions || "—"}
              />
              <ReviewRow label="Description" value={form.description || "—"} />
              <ReviewRow
                label="Contact"
                value={[
                  form.contactFullName || "—",
                  form.contactEmail || "—",
                  form.phoneCode && form.phoneLocal
                    ? `${form.phoneCode}${form.phoneLocal}`
                    : form.contactPhone || "—",
                  form.preferredContact
                    ? `Prefers: ${
                        form.preferredContact === "call"
                          ? "Call"
                          : form.preferredContact === "email"
                          ? "Email"
                          : "Text"
                      }`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              />
              <ReviewRow
                label="Policies"
                value={
                  form.acceptedTerms
                    ? `Accepted booking terms and policies • Media: ${
                        form.mediaPreference === "accepted"
                          ? "Accepted"
                          : form.mediaPreference === "declined"
                          ? "Declined"
                          : "—"
                      }`
                    : "Not accepted"
                }
              />
            </Stack>
          )}

          {/* Step 3: Policies */}
          {step === 3 && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Please review the full booking terms before submitting your request.
              </Typography>

              <Box
                sx={{
                  maxHeight: { xs: 380, sm: 460 },
                  overflowY: "auto",
                  pr: { xs: 0, sm: 1 },
                  borderTop: "1px solid",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  py: 2,
                }}
              >
                <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
                  Tipsyverse Booking Policies & Service Agreement
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  This agreement explains the responsibilities, expectations, and service terms that apply when you submit an event request with Tipsyverse. Please read it carefully before continuing. Submitting a request helps Tipsyverse begin reviewing your event, but it does not guarantee final staffing, final pricing, bartender assignment, procurement, or service confirmation until Tipsyverse reviews the details, confirms availability, and communicates any required payment or follow-up steps.
                </Typography>

                {POLICY_ITEMS.map((item) => (
                  <Box key={item.key} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={800}>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.script}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Box
                sx={{
                  border: "1px solid",
                  borderColor: errors.mediaPreference ? "error.main" : "divider",
                  borderRadius: 1,
                  p: 1.5,
                }}
              >
                <Typography variant="subtitle2" fontWeight={800}>
                  Photography
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Our staff may occasionally take photos or videos for marketing purposes. Please tell us your preference.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.mediaPreference === "accepted"}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            mediaPreference: event.target.checked ? "accepted" : "",
                          }))
                        }
                      />
                    }
                    label="Customer accepted."
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.mediaPreference === "declined"}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            mediaPreference: event.target.checked ? "declined" : "",
                          }))
                        }
                      />
                    }
                    label="Customer declined."
                  />
                </Stack>
              </Box>

              <Box
                sx={{
                  border: "1px solid",
                  borderColor: errors.acceptedTerms ? "error.main" : "divider",
                  borderRadius: 1,
                  p: 1.5,
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!form.acceptedTerms}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setForm((current) => ({
                          ...current,
                          acceptedTerms: checked,
                          policyChecks: POLICY_ITEMS.reduce(
                            (acc, item) => ({ ...acc, [item.key]: checked }),
                            {}
                          ),
                        }));
                      }}
                    />
                  }
                  label="I have read and agree to the Tipsyverse booking terms, service policies, and agreement."
                />
                {errors.acceptedTerms && (
                  <Typography variant="caption" color="error">
                    {errors.acceptedTerms}
                  </Typography>
                )}
              </Box>
            </Stack>
          )}

          {/* Footer */}
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
            <Button
              variant="outlined"
              onClick={step === 0 ? onCancel : back}
              sx={{
                color: "var(--primary-color)",
                borderColor: "var(--primary-color)",
              }}
            >
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            {step < steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={next}
                disabled={hasErrors}
                sx={{ backgroundColor: "var(--primary-color)" }}
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={submitting || hasErrors}
                sx={{ backgroundColor: "var(--primary-color)" }}
              >
                {submitting ? "Submitting…" : "Submit Request"}
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}

function ReviewRow({ label, value }) {
  return (
    <Stack sx={{ mb: 1 }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1">{value}</Typography>
    </Stack>
  );
}

const formatDate = (date) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

export const getRefreshCookieOptions = () => ({
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
});

export const clearRefreshCookie = (res) => {
  res.clearCookie("refreshToken", getRefreshCookieOptions());
};

export const getAccountAccessBlock = (user, now = new Date()) => {
  const status = user?.accountStatus || {};

  if (status.state === "Suspended") {
    const endsAt = status.suspensionDateEnds
      ? new Date(status.suspensionDateEnds)
      : null;
    const hasValidEnd = endsAt && !Number.isNaN(endsAt.getTime());
    const stillSuspended =
      status.suspensionIndefinite || !hasValidEnd || endsAt >= now;

    if (stillSuspended) {
      return {
        status: 403,
        code: "ACCOUNT_SUSPENDED",
        forceLogout: true,
        message: status.suspensionIndefinite || !hasValidEnd
          ? "Your account is suspended until further notice."
          : `Your account is suspended until ${formatDate(endsAt)}.`,
      };
    }
  }

  if (status.state === "Deactivated") {
    return {
      status: 403,
      code: "ACCOUNT_DEACTIVATED",
      forceLogout: true,
      message: "Your account is deactivated. Please sign back in to reactivate it.",
    };
  }

  if (status.state === "Terminated") {
    return {
      status: 403,
      code: "ACCOUNT_TERMINATED",
      forceLogout: true,
      message: "Your account is not active.",
    };
  }

  return null;
};

export const reactivateExpiredSuspension = async (user) => {
  const status = user?.accountStatus || {};
  if (status.state !== "Suspended" || status.suspensionIndefinite) return false;

  const endsAt = status.suspensionDateEnds
    ? new Date(status.suspensionDateEnds)
    : null;
  if (!endsAt || Number.isNaN(endsAt.getTime()) || endsAt >= new Date()) {
    return false;
  }

  user.accountStatus.state = "Active";
  user.accountStatus.reasonForSuspension = "";
  user.accountStatus.suspensionExplanation = "";
  user.accountStatus.suspensionIndefinite = false;
  user.accountStatus.suspensionDateEnds = null;
  await user.save();
  return true;
};

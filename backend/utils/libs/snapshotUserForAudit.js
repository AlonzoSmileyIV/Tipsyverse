export const snapshotEmployeeForAudit = (doc) => {
  const pos = doc?.employeeDetails?.position;
  return {
    fullName: doc.fullName ?? null,
    birthday: doc.profile?.birthday ?? null,
    bio: doc.profile?.bio ?? "",
    dateStarted: doc.employeeDetails?.dates?.dateStarted ?? null,
    isAbsent: doc.employeeDetails?.employmentStatus?.isAbsent ?? null,
    status: doc.employeeDetails?.employmentStatus?.state ?? null,
    positionId: pos?._id?.toString() || (typeof pos === "string" ? pos : null),
    positionName: pos?.name ?? null,
    reportToId: doc?.employeeDetails?.reportTo?._id?.toString()
      || doc?.employeeDetails?.reportTo?.toString()
      || null,
    directReports: Array.isArray(doc?.employeeDetails?.directReports)
      ? doc.employeeDetails.directReports.map(x => x.toString())
      : (doc?.employeeDetails?.directReports
          ? [doc.employeeDetails.directReports.toString()]
          : []),
  };
};

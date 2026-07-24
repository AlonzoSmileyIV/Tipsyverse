export const maskEventForBoard = (evt) => {
  const { location, ...rest } = evt;
  return {
    ...rest,
    location: location ? {
      city: location.city,
      state: location.state,
      zipcode: location.zipcode,
      county: location.county,
      country: location.country,
      point: location.point, // keep for distance calc on client if needed
    } : undefined,
  };
};
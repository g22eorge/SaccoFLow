type RequestLike = {
  headers: {
    get: (name: string) => string | null;
  };
  nextUrl?: {
    protocol?: string;
  };
};

export const shouldUseSecureCookies = (request: RequestLike) => {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = request.nextUrl?.protocol;
  const isHttps = forwardedProto === "https" || protocol === "https:";

  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  return isHttps;
};

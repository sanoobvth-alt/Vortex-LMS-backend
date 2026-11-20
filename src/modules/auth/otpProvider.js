
// Provider seam: configure a real SMS transport before enabling OTP delivery in production.
export const otpProvider = {
  async send({ phone, code }) {
    if (process.env.NODE_ENV === "production")
      throw new Error("SMS provider is not configured");
    // Development mock deliberately avoids logging OTPs. The local API returns the code only in development.
    return { phone, developmentCode: code };
  },
};

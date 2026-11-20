import * as authService from "./auth.service.js";

const cookieOptions = () => {
  const match = /^(\d+)([smhd])$/.exec(process.env.JWT_REFRESH_EXPIRES_IN || '7d');
  const milliseconds = Number(match[1]) * ({ s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 })[match[2]];
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    path: "/api/v1/auth",
    expires: new Date(Date.now() + milliseconds),
  };
};
const refreshToken = (req) => req.cookies?.refreshToken;
const metadata = (req) => ({
  userAgent: req.get("user-agent"),
  ipAddress: req.ip,
});
const ok = (res, data, status = 200) => res.status(status).json({ data });

export const register = async (req, res) =>
  ok(res, await authService.register(req.body), 202);
export const verifyOtp = async (req, res) =>
  ok(res, await authService.verifyRegistration(req.body));
export const login = async (req, res) => {
  const result = await authService.login(req.body, metadata(req));
  res.cookie("refreshToken", result.refreshToken, cookieOptions());
  const { refreshToken: _token, ...data } = result;
  return ok(res, data);
};
export const forgotPassword = async (req, res) =>
  ok(res, await authService.forgotPassword(req.body), 202);
export const resetPassword = async (req, res) =>
  ok(res, await authService.resetPassword(req.body));
export const refresh = async (req, res) => {
  const result = await authService.refresh(refreshToken(req), metadata(req));
  res.cookie("refreshToken", result.refreshToken, cookieOptions());
  const { refreshToken: _token, ...data } = result;
  return ok(res, data);
};
export const logout = async (req, res) => {
  await authService.logout(refreshToken(req));
  res.clearCookie("refreshToken", { ...cookieOptions(), expires: new Date(0) });
  return ok(res, { message: "Logged out" });
};
export const me = async (req, res) =>
  ok(res, { user: await authService.me(req.auth.userId) });

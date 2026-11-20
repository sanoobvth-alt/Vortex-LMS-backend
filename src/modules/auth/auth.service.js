import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { otpProvider } from './otpProvider.js';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const genericAuthError = () => new ApiError(401, 'Invalid phone number or password', 'INVALID_CREDENTIALS');
const addDuration = (duration) => {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) throw new Error('JWT expiry must use s, m, h, or d units');
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  return new Date(Date.now() + Number(match[1]) * unit);
};

function accessToken(user) {
  return jwt.sign({ typ: 'access', role: user.role }, process.env.JWT_ACCESS_SECRET, { subject: user.id, expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m', algorithm: 'HS256' });
}

async function issueSession(user, metadata = {}) {
  const refreshToken = randomBytes(48).toString('base64url');
  await prisma.refreshSession.create({ data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: addDuration(process.env.JWT_REFRESH_EXPIRES_IN || '7d'), userAgent: metadata.userAgent?.slice(0, 500), ipAddress: metadata.ipAddress?.slice(0, 64) } });
  return { accessToken: accessToken(user), refreshToken };
}

async function createOtp(phone, purpose) {
  const now = new Date();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const otpHash = await bcrypt.hash(code, Number(process.env.BCRYPT_SALT_ROUNDS || 12));
  await prisma.$transaction(async (tx) => {
    await tx.otpVerification.updateMany({ where: { phone, purpose, verifiedAt: null, expiresAt: { gt: now } }, data: { expiresAt: now } });
    await tx.otpVerification.create({ data: { phone, purpose, otpHash, expiresAt: new Date(now.getTime() + Number(process.env.OTP_TTL_MINUTES || 5) * 60_000) } });
  });
  await otpProvider.send({ phone, code, purpose });
  return (process.env.NODE_ENV || 'development') === 'development' ? { developmentOtp: code } : {};
}

async function consumeOtp(phone, purpose, code, tx = prisma) {
  const otp = await tx.otpVerification.findFirst({ where: { phone, purpose, verifiedAt: null, expiresAt: { gt: new Date() }, attemptCount: { lt: 5 } }, orderBy: { createdAt: 'desc' } });
  if (!otp) throw new ApiError(400, 'Invalid or expired verification code', 'INVALID_OTP');
  const matches = await bcrypt.compare(code, otp.otpHash);
  if (!matches) {
    // Commit the failed-attempt counter even though the surrounding operation rejects.
    await prisma.otpVerification.update({ where: { id: otp.id }, data: { attemptCount: { increment: 1 } } });
    throw new ApiError(400, 'Invalid or expired verification code', 'INVALID_OTP');
  }
  await tx.otpVerification.update({ where: { id: otp.id }, data: { verifiedAt: new Date() } });
  return otp;
}

function publicUser(user) {
  return { id: user.id, phone: user.phone, role: user.role, status: user.status, phoneVerifiedAt: user.phoneVerifiedAt, profile: user.profile ? { id: user.profile.id, fullName: user.profile.fullName, highestQualification: user.profile.highestQualification, otherQualification: user.profile.otherQualification, profilePhotoKey: user.profile.profilePhotoKey, studentCode: user.profile.studentCode } : null };
}

export async function register(input) {
  if (await prisma.user.findUnique({ where: { phone: input.phone } })) throw new ApiError(409, 'An account with this phone number may already exist', 'REGISTRATION_UNAVAILABLE');
  const passwordHash = await bcrypt.hash(input.password, Number(process.env.BCRYPT_SALT_ROUNDS || 12));
  const userId = randomUUID();
  const studentCode = `${process.env.STUDENT_CODE_PREFIX || 'VTX'}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  await prisma.$transaction(async (tx) => {
    await tx.user.create({ data: { id: userId, phone: input.phone, passwordHash, role: 'STUDENT', status: 'PENDING_VERIFICATION', profile: { create: { fullName: input.fullName, highestQualification: input.highestQualification, otherQualification: input.otherQualification, studentCode } } } });
  });
  const otp = await createOtp(input.phone, 'REGISTRATION');
  return { message: 'If the number can be registered, a verification code has been sent', ...otp };
}

export async function verifyRegistration({ phone, otp }) {
  const user = await prisma.$transaction(async (tx) => {
    await consumeOtp(phone, 'REGISTRATION', otp, tx);
    const found = await tx.user.findUnique({ where: { phone } });
    if (!found || found.status !== 'PENDING_VERIFICATION') throw new ApiError(400, 'Invalid or expired verification code', 'INVALID_OTP');
    return tx.user.update({ where: { id: found.id }, data: { status: 'ACTIVE', phoneVerifiedAt: new Date() }, include: { profile: true } });
  });
  return { user: publicUser(user) };
}

export async function login(input, metadata) {
  const user = await prisma.user.findUnique({ where: { phone: input.phone }, include: { profile: true } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash)) || user.status !== 'ACTIVE') throw genericAuthError();
  const tokens = await issueSession(user, metadata);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { user: publicUser(user), ...tokens };
}

export async function forgotPassword({ phone }) {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (user?.status === 'ACTIVE') {
    const otp = await createOtp(phone, 'FORGOT_PASSWORD');
    return { message: 'If an eligible account exists, a verification code has been sent', ...otp };
  }
  return { message: 'If an eligible account exists, a verification code has been sent' };
}

export async function resetPassword({ phone, otp, newPassword }) {
  const passwordHash = await bcrypt.hash(newPassword, Number(process.env.BCRYPT_SALT_ROUNDS || 12));
  await prisma.$transaction(async (tx) => {
    await consumeOtp(phone, 'FORGOT_PASSWORD', otp, tx);
    const user = await tx.user.findUnique({ where: { phone } });
    if (!user || user.status !== 'ACTIVE') throw new ApiError(400, 'Invalid or expired verification code', 'INVALID_OTP');
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.refreshSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  });
  return { message: 'Password updated' };
}

export async function refresh(refreshToken, metadata) {
  if (!refreshToken) throw new ApiError(401, 'Authentication required', 'UNAUTHENTICATED');
  const hash = hashToken(refreshToken);
  const session = await prisma.refreshSession.findUnique({ where: { tokenHash: hash }, include: { user: { include: { profile: true } } } });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') throw new ApiError(401, 'Authentication required', 'UNAUTHENTICATED');
  const next = randomBytes(48).toString('base64url');
  await prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshSession.updateMany({ where: { id: session.id, revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date() } });
    if (revoked.count !== 1) throw new ApiError(401, 'Authentication required', 'UNAUTHENTICATED');
    await tx.refreshSession.create({ data: { userId: session.userId, tokenHash: hashToken(next), expiresAt: addDuration(process.env.JWT_REFRESH_EXPIRES_IN || '7d'), userAgent: metadata.userAgent?.slice(0, 500), ipAddress: metadata.ipAddress?.slice(0, 64) } });
  });
  return { user: publicUser(session.user), accessToken: accessToken(session.user), refreshToken: next };
}

export async function logout(refreshToken) {
  if (refreshToken) await prisma.refreshSession.updateMany({ where: { tokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function me(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
  if (!user || user.status !== 'ACTIVE') throw new ApiError(401, 'Authentication required', 'UNAUTHENTICATED');
  return publicUser(user);
}

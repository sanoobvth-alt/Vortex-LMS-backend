import bcrypt from 'bcrypt';
import { emitKeypressEvents } from 'node:readline';
import { createInterface } from 'node:readline/promises';
import { prisma } from '../src/config/prisma.js';

const phonePattern = /^\+[1-9]\d{7,14}$/;

async function promptLine(question) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await readline.question(question);
  } finally {
    readline.close();
  }
}

function promptHidden(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return Promise.reject(
      new Error('Password entry requires an interactive terminal; refusing to echo it.'),
    );
  }

  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const wasRaw = input.isRaw;
    let value = '';
    let finished = false;

    emitKeypressEvents(input);

    const cleanup = () => {
      if (finished) return;
      finished = true;
      input.off('keypress', onKeypress);
      input.setRawMode(wasRaw);
      input.pause();
      process.stdout.write('\n');
    };

    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Cancelled.'));
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(value);
        return;
      }
      if (key.name === 'backspace' || key.name === 'delete') {
        value = value.slice(0, -1);
        return;
      }
      if (!key.ctrl && !key.meta && character) value += character;
    };

    process.stdout.write(question);
    input.setRawMode(true);
    input.resume();
    input.on('keypress', onKeypress);
  });
}

async function main() {
  const roles = await prisma.$queryRawUnsafe(
    'SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = $1',
    'UserRole',
  );
  if (!roles.some(({ enumlabel }) => enumlabel === 'ACADEMIC')) {
    throw new Error('The ACADEMIC database role is not available. Apply its migration first.');
  }

  const phone = (await promptLine('Academic staff phone (E.164, e.g. +14155552671): ')).trim();
  if (!phonePattern.test(phone)) {
    throw new Error('Enter a valid E.164 phone number.');
  }

  const password = await promptHidden('Password (12+ characters, hidden): ');
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Password must be at least 12 characters and at most 72 UTF-8 bytes.');
  }

  const confirmation = await promptHidden('Confirm password (hidden): ');
  if (password !== confirmation) {
    throw new Error('Passwords do not match.');
  }

  if (await prisma.user.findUnique({ where: { phone }, select: { id: true } })) {
    throw new Error('An account with that phone number already exists.');
  }

  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS || 12));
  await prisma.user.create({
    data: {
      phone,
      passwordHash,
      role: 'ACADEMIC',
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  console.info('Academic account created. No StudentProfile was created.');
}

main()
  .catch((error) => {
    if (error?.code === 'P2002') {
      console.error('An account with that phone number already exists.');
    } else {
      console.error(error instanceof Error ? error.message : 'Could not create Academic account.');
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

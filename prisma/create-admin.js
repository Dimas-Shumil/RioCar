import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const login = String(process.env.ADMIN_LOGIN || '').trim();
  const password = String(process.env.ADMIN_PASSWORD || '');

  if (login.length < 3) {
    throw new Error('ADMIN_LOGIN должен содержать минимум 3 символа.');
  }

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD должен содержать минимум 12 символов.');
  }

  const existingAdmin = await prisma.admin.findFirst({
    select: {
      id: true,
      login: true,
    },
  });

  if (existingAdmin && existingAdmin.login !== login) {
    throw new Error(
      `Администратор уже существует с логином "${existingAdmin.login}".`,
    );
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
  });

  const admin = await prisma.admin.upsert({
    where: {
      login,
    },
    update: {
      passwordHash,
    },
    create: {
      login,
      passwordHash,
    },
    select: {
      id: true,
      login: true,
    },
  });

  console.log(`Администратор готов: ${admin.login}`);
  console.log('Пароль сохранён в виде хеша Argon2id.');
}

main()
  .catch((error) => {
    console.error('Ошибка создания администратора:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

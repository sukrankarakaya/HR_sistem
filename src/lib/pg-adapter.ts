import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Oturum saat dilimi UTC'ye sabitlenir. adapter-pg zamanları saat dilimi
 * bilgisi olmadan gönderir; sunucu (ör. Postgres.app) Europe/Istanbul ile
 * açılırsa her kayıt 3 saat kaymış saklanır, Prisma okurken de aynı kaymayı
 * geri aldığı için hata uygulamadan görünmez.
 */
export function createPgAdapter(
  connectionString = process.env.DATABASE_URL,
): PrismaPg {
  return new PrismaPg({ connectionString, options: "-c TimeZone=UTC" });
}

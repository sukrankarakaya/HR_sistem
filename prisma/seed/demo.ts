// Kurgusal demo verisi (spec.md B4, B5).
// Tüm kişi ve şirket adları uydurmadır; IP adresleri RFC 5737 belgeleme aralıklarındandır.

import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import {
  fromEpochDay,
  toEpochDay,
  weekdayOf,
  wholeYearsBetween,
  type LocalDate,
  type Weekday,
} from "@/domain/calendar/local-date";
import { annualLeaveDays } from "@/domain/leave/entitlement";
import { countLeaveDays, type Holiday } from "@/domain/leave/working-days";
import { turkishHolidays } from "./holidays-tr";

export const DEMO_ORGANIZATION_NAME = "Demo Organizasyonu";

/** Demo verisinin "bugün"ü — veri her çalıştırmada aynı çıksın diye sabit */
const DEMO_TODAY: LocalDate = "2026-10-31";
const GO_LIVE: LocalDate = "2026-08-01";
const OWNER_ID = "demo-owner";

const OFFICE_IP = "203.0.113.10";
const MOBILE_IP = "198.51.100.23";
const HOME_IP = "192.0.2.44";

// ─── Şirketler ve takvimler ────────────────────────────────────────────

type CompanyKey = "lumen" | "nova";
type DaySchedule = { start: number; end: number; break: number };

const WEEKDAY: DaySchedule = { start: 8 * 60 + 30, end: 18 * 60, break: 60 };
const SATURDAY: DaySchedule = { start: 8 * 60 + 30, end: 16 * 60, break: 60 };

const COMPANIES: Record<CompanyKey, { name: string; schedule: Partial<Record<Weekday, DaySchedule>> }> = {
  lumen: {
    name: "Lumen Kozmetik",
    schedule: { 1: WEEKDAY, 2: WEEKDAY, 3: WEEKDAY, 4: WEEKDAY, 5: WEEKDAY },
  },
  nova: {
    name: "Nova E-Ticaret",
    schedule: { 1: WEEKDAY, 2: WEEKDAY, 3: WEEKDAY, 4: WEEKDAY, 5: WEEKDAY, 6: SATURDAY },
  },
};

function workdaysOf(key: CompanyKey): ReadonlySet<Weekday> {
  return new Set(Object.keys(COMPANIES[key].schedule).map(Number) as Weekday[]);
}

// ─── Personel ──────────────────────────────────────────────────────────

type DemoEmployee = {
  key: string;
  company: CompanyKey;
  firstName: string;
  lastName: string;
  hireDate: LocalDate;
  birthDate: LocalDate;
  isRemote?: boolean;
  /** Sisteme geçiş tarihindeki kalan izin (B2) */
  openingBalance: number;
};

const EMPLOYEES: DemoEmployee[] = [
  { key: "elif", company: "lumen", firstName: "Elif", lastName: "Yıldız", hireDate: "2019-10-07", birthDate: "1990-05-02", openingBalance: 8 },
  { key: "burak", company: "lumen", firstName: "Burak", lastName: "Şahin", hireDate: "2024-06-03", birthDate: "1996-09-14", openingBalance: 14 },
  { key: "ayse", company: "nova", firstName: "Ayşe", lastName: "Demir", hireDate: "2015-02-02", birthDate: "1984-04-20", openingBalance: 12 },
  // 50 yaş üstü: kıdemi 14 güne denk gelse de 20 gün alır (I3)
  { key: "hasan", company: "nova", firstName: "Hasan", lastName: "Koç", hireDate: "2023-09-04", birthDate: "1972-01-15", openingBalance: 6 },
  { key: "zeynep", company: "nova", firstName: "Zeynep", lastName: "Arslan", hireDate: "2022-01-10", birthDate: "1993-07-07", isRemote: true, openingBalance: 10 },
  // İlk yılını doldurmadı: hak edişi yok (I1)
  { key: "mert", company: "nova", firstName: "Mert", lastName: "Aydın", hireDate: "2025-12-01", birthDate: "2001-03-03", openingBalance: 0 },
  { key: "can", company: "nova", firstName: "Can", lastName: "Öztürk", hireDate: "2010-05-17", birthDate: "1985-11-11", openingBalance: 18 },
  { key: "selin", company: "nova", firstName: "Selin", lastName: "Kaya", hireDate: "2021-09-21", birthDate: "1998-02-28", openingBalance: 3 },
];

// ─── İzin talepleri ────────────────────────────────────────────────────

type DemoLeave = {
  employee: string;
  kind: "ANNUAL" | "SICK";
  start: LocalDate;
  end: LocalDate;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  note?: string;
  decisionNote?: string;
};

const LEAVES: DemoLeave[] = [
  { employee: "burak", kind: "ANNUAL", start: "2026-08-17", end: "2026-08-21", status: "APPROVED", note: "Yaz tatili" },
  // Pzt–Cmt: Cumartesi çalışan şirkette 6 gün düşer (I4)
  { employee: "selin", kind: "ANNUAL", start: "2026-09-07", end: "2026-09-12", status: "APPROVED" },
  // 28 Ekim yarım, 29 Ekim tam gün tatil: 3,5 gün düşer (I5)
  { employee: "can", kind: "ANNUAL", start: "2026-10-26", end: "2026-10-30", status: "APPROVED" },
  { employee: "ayse", kind: "ANNUAL", start: "2026-08-10", end: "2026-08-14", status: "CANCELLED", note: "Planlar değişti" },
  { employee: "zeynep", kind: "SICK", start: "2026-09-24", end: "2026-09-25", status: "APPROVED", note: "Raporlu" },
  { employee: "hasan", kind: "ANNUAL", start: "2026-10-12", end: "2026-10-13", status: "REJECTED", decisionNote: "Sayım haftası, başka bir tarih seçelim" },
  { employee: "elif", kind: "ANNUAL", start: "2026-11-16", end: "2026-11-20", status: "PENDING", note: "Aile ziyareti" },
];

// ─── Yardımcılar ───────────────────────────────────────────────────────

const date = (d: LocalDate) => new Date(`${d}T00:00:00Z`);

/** İstanbul saatiyle (UTC+3, 2016'dan beri yaz saati yok) gün içi dakikayı UTC'ye çevirir */
const istanbul = (d: LocalDate, minuteOfDay: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + (minuteOfDay - 180) * 60_000);

function daysBetween(start: LocalDate, end: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = toEpochDay(start); d <= toEpochDay(end); d++) out.push(fromEpochDay(d));
  return out;
}

/** Tekrarlanabilir rastgelelik (mulberry32) */
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

type EventRow = {
  id: string;
  organizationId: string;
  employeeId: string;
  type: "CLOCK_IN" | "CLOCK_OUT";
  occurredAt: Date;
  recordedAt: Date;
  method: "BUTTON" | "MANUAL" | "CORRECTION";
  networkCheck: "MATCHED" | "NOT_MATCHED" | "DISABLED";
  status: "ACTIVE" | "PENDING" | "SUPERSEDED";
  ipAddress: string;
  note?: string;
  supersedesId?: string;
  createdById: string;
};

// ─── Seed ──────────────────────────────────────────────────────────────

export async function seedDemo(db: PrismaClient): Promise<void> {
  const existing = await db.organization.findFirst({ where: { name: DEMO_ORGANIZATION_NAME } });
  if (existing) {
    console.log(`"${DEMO_ORGANIZATION_NAME}" zaten var, demo verisi atlandı (sıfırlamak için: npm run db:reset).`);
    return;
  }

  const holidays: Holiday[] = turkishHolidays().map(({ date, kind }) => ({ date, kind }));
  const holidayKind = new Map(holidays.map((h) => [h.date, h.kind]));
  const random = prng(20261031);

  await db.$transaction(
    async (tx) => {
      const org = await tx.organization.create({ data: { name: DEMO_ORGANIZATION_NAME } });
      const network = await tx.officeNetwork.create({
        data: { organizationId: org.id, name: "Demo Ofis (ortak modem)", cidr: `${OFFICE_IP}/32` },
      });

      // Şirketler, ayarlar, takvim, ağ ve aydınlatma metni
      const companyIds = {} as Record<CompanyKey, string>;
      const noticeIds = {} as Record<CompanyKey, string>;
      for (const key of Object.keys(COMPANIES) as CompanyKey[]) {
        const { name, schedule } = COMPANIES[key];
        const company = await tx.company.create({
          data: {
            organizationId: org.id,
            name,
            legalName: `${name} Ltd. Şti. (kurgusal)`,
            dataControllerContact: `kvkk@${key}.example`,
            goLiveDate: date(GO_LIVE),
            settings: { create: {} },
            networks: { create: { officeNetworkId: network.id } },
            workSchedules: {
              create: {
                validFrom: date(GO_LIVE),
                days: {
                  create: Object.entries(schedule).map(([weekday, s]) => ({
                    weekday: Number(weekday),
                    startMinute: s.start,
                    endMinute: s.end,
                    breakMinutes: s.break,
                  })),
                },
              },
            },
          },
        });
        const notice = await tx.privacyNotice.create({
          data: {
            companyId: company.id,
            version: 1,
            content: `${name} çalışan aydınlatma metni (demo). Giriş-çıkış saatleri ve IP adresi, iş sözleşmesinin ifası ve yasal yükümlülükler kapsamında işlenir.`,
            publishedAt: istanbul(GO_LIVE, 9 * 60),
          },
        });
        companyIds[key] = company.id;
        noticeIds[key] = notice.id;
      }

      // Personel, KVKK onayı, açılış bakiyesi ve yıldönümü hak edişleri
      const employeeIds: Record<string, string> = {};
      const ledger: Prisma.LeaveLedgerEntryCreateManyInput[] = [];
      for (const e of EMPLOYEES) {
        const employee = await tx.employee.create({
          data: {
            organizationId: org.id,
            companyId: companyIds[e.company],
            firstName: e.firstName,
            lastName: e.lastName,
            email: `${e.key}@${e.company}.example`,
            hireDate: date(e.hireDate),
            birthDate: date(e.birthDate),
            isRemote: e.isRemote ?? false,
            consents: {
              create: {
                privacyNoticeId: noticeIds[e.company],
                acceptedAt: istanbul(GO_LIVE, 9 * 60 + 15),
                ipAddress: e.isRemote ? HOME_IP : OFFICE_IP,
              },
            },
          },
        });
        employeeIds[e.key] = employee.id;

        ledger.push({
          organizationId: org.id,
          employeeId: employee.id,
          type: "OPENING_BALANCE",
          days: e.openingBalance,
          effectiveDate: date(GO_LIVE),
          note: "Demo açılış bakiyesi",
          createdById: OWNER_ID,
        });

        // B3: geçiş tarihinden sonraki yıldönümleri
        const mmdd = e.hireDate.slice(5);
        for (let year = Number(GO_LIVE.slice(0, 4)); year <= Number(DEMO_TODAY.slice(0, 4)); year++) {
          const anniversary = `${year}-${mmdd}`;
          if (anniversary <= GO_LIVE || anniversary > DEMO_TODAY) continue;
          const days = annualLeaveDays(
            wholeYearsBetween(e.hireDate, anniversary),
            wholeYearsBetween(e.birthDate, anniversary),
          );
          if (days > 0) {
            ledger.push({
              organizationId: org.id,
              employeeId: employee.id,
              type: "ENTITLEMENT",
              days,
              effectiveDate: date(anniversary),
              note: `${wholeYearsBetween(e.hireDate, anniversary)}. yıl hak edişi`,
            });
          }
        }
      }

      // İzin talepleri ve defter kayıtları
      const onLeave = new Set<string>(); // "çalışan|gün"
      const audit: { action: string; entityType: string; entityId: string; after?: object; createdAt: Date }[] = [];
      for (const l of LEAVES) {
        const e = EMPLOYEES.find((x) => x.key === l.employee)!;
        const days = countLeaveDays({ start: l.start, end: l.end }, workdaysOf(e.company), holidays);
        const decided = l.status !== "PENDING";
        const decidedAt = istanbul(fromEpochDay(toEpochDay(l.start) - 5), 10 * 60);
        const request = await tx.leaveRequest.create({
          data: {
            organizationId: org.id,
            employeeId: employeeIds[l.employee],
            kind: l.kind,
            startDate: date(l.start),
            endDate: date(l.end),
            days,
            status: l.status,
            note: l.note,
            decidedAt: decided ? decidedAt : null,
            decidedById: decided ? OWNER_ID : null,
            decisionNote: l.decisionNote,
            createdAt: istanbul(fromEpochDay(toEpochDay(l.start) - 10), 11 * 60),
          },
        });

        if (l.status !== "PENDING") {
          const action = { APPROVED: "leave.approve", REJECTED: "leave.reject", CANCELLED: "leave.cancel" }[l.status];
          audit.push({ action, entityType: "LeaveRequest", entityId: request.id, after: { status: l.status, days }, createdAt: decidedAt });
        }
        if (l.status === "APPROVED") {
          for (const d of daysBetween(l.start, l.end)) onLeave.add(`${l.employee}|${d}`);
        }
        // I7: yalnızca yıllık izin bakiyeden düşer; I9: iptalde iade
        if (l.kind === "ANNUAL" && (l.status === "APPROVED" || l.status === "CANCELLED")) {
          const base = { organizationId: org.id, employeeId: employeeIds[l.employee], leaveRequestId: request.id, effectiveDate: date(l.start) };
          ledger.push({ ...base, type: "USAGE", days: -days });
          if (l.status === "CANCELLED") ledger.push({ ...base, type: "USAGE_REVERSAL", days, note: "İptal edilen izin iadesi" });
        }
      }
      await tx.leaveLedgerEntry.createMany({ data: ledger });

      // Giriş-çıkış geçmişi
      const events: EventRow[] = [];
      for (const e of EMPLOYEES) {
        const employeeId = employeeIds[e.key];
        for (const day of daysBetween(GO_LIVE, DEMO_TODAY)) {
          const schedule = COMPANIES[e.company].schedule[weekdayOf(toEpochDay(day))];
          const holiday = holidayKind.get(day);
          if (!schedule || holiday === "FULL" || onLeave.has(`${e.key}|${day}`)) continue;

          // Yarım gün tatilde (arife) mesai 13:00'te biter
          const end = holiday === "HALF" ? 13 * 60 : schedule.end;
          const r = random();
          // %6 geç kalma (tolerans 15 dk'nın üstü), kalanı tolerans içinde
          const inMinute = schedule.start + (r < 0.06 ? 16 + Math.floor(random() * 30) : Math.floor(random() * 26) - 15);
          const outMinute = end + Math.floor(random() * 26);

          const base = { organizationId: org.id, employeeId, createdById: employeeId };
          const network = e.isRemote
            ? { networkCheck: "DISABLED" as const, ipAddress: HOME_IP }
            : r > 0.97
              ? { networkCheck: "NOT_MATCHED" as const, ipAddress: MOBILE_IP, note: "Wi-Fi yoktu, mobil veriden bastım" }
              : { networkCheck: "MATCHED" as const, ipAddress: OFFICE_IP };
          const manual = r > 0.93 && r <= 0.97;

          events.push({
            ...base,
            ...network,
            id: randomUUID(),
            type: "CLOCK_IN",
            occurredAt: istanbul(day, inMinute),
            // Manuel kayıt sonradan girilir (G2)
            recordedAt: istanbul(day, manual ? inMinute + 95 : inMinute),
            method: manual ? "MANUAL" : "BUTTON",
            status: "ACTIVE",
            ...(manual && { note: "Girişi unuttum" }),
          });
          events.push({
            ...base,
            ...(e.isRemote ? network : { networkCheck: "MATCHED" as const, ipAddress: OFFICE_IP }),
            id: randomUUID(),
            type: "CLOCK_OUT",
            occurredAt: istanbul(day, outMinute),
            recordedAt: istanbul(day, outMinute),
            method: "BUTTON",
            status: "ACTIVE",
          });
        }
      }

      applyScenarios(events, employeeIds, audit);
      await tx.attendanceEvent.createMany({ data: events });

      // Ağustos kapanışı (P1)
      for (const key of Object.keys(COMPANIES) as CompanyKey[]) {
        const close = await tx.periodClose.create({
          data: { companyId: companyIds[key], year: 2026, month: 8, closedAt: istanbul("2026-09-02", 10 * 60), closedById: OWNER_ID },
        });
        audit.push({ action: "period.close", entityType: "PeriodClose", entityId: close.id, after: { year: 2026, month: 8 }, createdAt: close.closedAt });
      }

      await tx.auditLog.createMany({
        data: audit.map((a) => ({ organizationId: org.id, actorId: OWNER_ID, ...a })),
      });

      console.log(
        `Demo: 2 şirket, ${EMPLOYEES.length} personel, ${LEAVES.length} izin talebi, ` +
          `${ledger.length} defter kaydı, ${events.length} giriş-çıkış olayı.`,
      );
    },
    { timeout: 60_000 },
  );
}

/** Spec'teki akışları gösteren elle kurgulanmış durumlar */
function applyScenarios(
  events: EventRow[],
  ids: Record<string, string>,
  audit: { action: string; entityType: string; entityId: string; after?: object; createdAt: Date }[],
) {
  const find = (who: string, type: EventRow["type"], day: LocalDate) => {
    const from = istanbul(day, 0).getTime();
    const found = events.find(
      (ev) => ev.employeeId === ids[who] && ev.type === type && ev.occurredAt.getTime() >= from && ev.occurredAt.getTime() < from + 86_400_000,
    );
    if (!found) throw new Error(`Senaryo için kayıt bulunamadı: ${who} ${type} ${day}`);
    return found;
  };
  const correction = (original: EventRow, minute: number, recordedAt: Date, note: string, status: "ACTIVE" | "PENDING"): EventRow => ({
    ...original,
    id: randomUUID(),
    method: "CORRECTION",
    occurredAt: istanbul(original.occurredAt.toISOString().slice(0, 10), minute),
    recordedAt,
    status,
    note,
    supersedesId: original.id,
  });

  // 1. Çıkış unutuldu, ertesi gün düzeltildi (G6, D1)
  const forgotten = find("burak", "CLOCK_OUT", "2026-09-15");
  events.splice(events.indexOf(forgotten), 1, {
    ...forgotten,
    method: "CORRECTION",
    occurredAt: istanbul("2026-09-15", 18 * 60 + 10),
    recordedAt: istanbul("2026-09-16", 9 * 60),
    note: "Çıkış yapmayı unuttum",
  });
  audit.push({ action: "attendance.correct", entityType: "AttendanceEvent", entityId: forgotten.id, createdAt: istanbul("2026-09-16", 9 * 60) });

  // 2. Çıkışa evden basıldı, aynı akşam düzeltildi (D2)
  const wrong = find("selin", "CLOCK_OUT", "2026-10-06");
  Object.assign(wrong, { occurredAt: istanbul("2026-10-06", 20 * 60 + 40), recordedAt: istanbul("2026-10-06", 20 * 60 + 40), networkCheck: "NOT_MATCHED", ipAddress: MOBILE_IP, status: "SUPERSEDED" });
  const fixed = correction(wrong, 18 * 60 + 5, istanbul("2026-10-06", 20 * 60 + 45), "Çıkışa evde bastım, doğru saat 18:05", "ACTIVE");
  events.push(fixed);
  audit.push({ action: "attendance.correct", entityType: "AttendanceEvent", entityId: fixed.id, createdAt: fixed.recordedAt });

  // 3. 7 günlük pencere dışında düzeltme → onay bekliyor (D4-a)
  const old = find("can", "CLOCK_IN", "2026-10-19");
  events.push(correction(old, 7 * 60 + 45, istanbul("2026-10-31", 10 * 60), "Envanter sayımı için 07:45'te geldim", "PENDING"));

  // 4. Düzeltilmemiş eksik çıkış (G6)
  const missing = find("mert", "CLOCK_OUT", "2026-10-30");
  events.splice(events.indexOf(missing), 1);
}

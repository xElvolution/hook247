import { PrismaClient } from "@prisma/client";

const TRANSIENT = new Set(["P1001", "P1002", "P1017", "P2024"]);

function neonUrl(raw: string) {
  if (!raw) return raw;
  let url = raw;
  const add = (key: string, value: string) => {
    if (url.includes(`${key}=`)) return;
    url += (url.includes("?") ? "&" : "?") + `${key}=${value}`;
  };
  // Neon’s pooler rejects Prisma’s prepared statements unless this is set.
  add("pgbouncer", "true");
  // Neon suspends idle computes; a cold start can take several seconds, so
  // give the handshake and the pool enough headroom to ride it out instead of
  // failing requests with P1001/P2024 while the compute wakes.
  add("connect_timeout", "15");
  add("pool_timeout", "20");
  add("connection_limit", "5");
  return url;
}

function isTransient(err: unknown) {
  const code = (err as { code?: string } | null)?.code;
  return !!code && TRANSIENT.has(code);
}

function createClient() {
  const prisma = new PrismaClient({
    datasourceUrl: neonUrl(process.env.DATABASE_URL ?? ""),
    log: ["error"],
  });

  return prisma.$extends({
    query: {
      async $allOperations({ args, query }) {
        let last: unknown;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            last = err;
            if (!isTransient(err) || attempt === 3) throw err;
            const delay = attempt === 1 ? 800 : 2000;
            console.warn(
              `Database ${String((err as { code?: string }).code)} — retry ${attempt}/3 in ${delay}ms`
            );
            await new Promise((r) => setTimeout(r, delay));
          }
        }
        throw last;
      },
    },
  });
}

type Db = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as { prisma?: Db };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Wake a suspended Neon compute as soon as the process boots so the first
// login does not sit on a cold connection.
db.$connect().catch(() => {});

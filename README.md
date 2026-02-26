# FLUXCY DEV V1 - Dashboard Web

Dashboard responsive con Next.js + Express BFF, login por roles y calculadora de produccion por IVO.

## Stack

- Frontend: Next.js App Router + React + TypeScript
- UI: TailwindCSS + componentes base estilo shadcn/ui + lucide-react
- Charts: Recharts + KPIs/Gauges custom
- Data layer: TanStack Query + Zustand
- Backend: Node.js + Express + TypeScript (BFF)
- Realtime: Socket.IO server/client

## Instalacion

```bash
npm install
```

## Ejecucion local

```bash
npm run dev
```

- Web: `http://localhost:3001`
- BFF: `http://localhost:4000`

## Build y produccion

```bash
npm run build
npm run start
```

## Deploy en Vercel (por Git)

El frontend (`apps/web`) queda listo para deploy automatico en Vercel. Solo necesitas dejar configurada la URL publica del BFF.

1. Importa el repo en Vercel.
2. En el proyecto de Vercel, usa **Root Directory**: `apps/web`.
3. Configura variable de entorno obligatoria:
   - `BFF_URL=https://tu-bff-publico.example.com`
4. Opcionales (si los necesitas):
   - `NEXT_PUBLIC_BFF_URL=https://tu-bff-publico.example.com`
   - `NEXT_PUBLIC_SOCKET_URL=https://tu-bff-publico.example.com`
   - `NEXT_PUBLIC_ENABLE_TASKS_BACKEND=false`

Referencia de variables: [apps/web/.env.example](./apps/web/.env.example)

El BFF debe estar desplegado y accesible por HTTPS en una URL publica.

Nota: el build en Vercel falla de forma intencional si `BFF_URL` no esta configurada, para evitar deploys rotos apuntando a `localhost`.

## Login y roles

Usuarios base en archivo [usuarios_base.txt](./usuarios_base.txt).

- `superadmin`: acceso completo (dashboard + tasks + calculadora IVO)
- `supervisor`: acceso dashboard + calculadora IVO

## Calculadora IVO

Modulo incluido en `/dashboard` para estimar produccion:

- Entradas: hora inicio, hora fin, diluente (Bls), agua (%)
- IVO Liq inicio/fin: se toma automaticamente desde la data del rango seleccionado
- Formula de proyeccion: `((ivo_fin - ivo_inicio) / horas) * 24`
- Neto: `proyeccion_24h - diluente - (proyeccion_24h * agua%)`

## Endpoints BFF

- `GET /api/snapshot`
- `GET /api/series/flow?from&to&smooth&alpha`
- `GET /api/series/vp?from&to`
- `GET /api/series/rho?from&to`
- `GET /api/series/ivo-liq?from&to`
- `GET /api/series/produccion?from&to&stepMin`
- `GET /api/table/pressures?from&to&limit`
- `GET /api/table/bsw-lab?from&to&limit`
- `GET /api/table/densidad-lab?from&to&limit`
- `GET /api/tasks` (deshabilitado por defecto en codigo)

## Calidad

```bash
npm run lint
npm run test
```

E2E smoke (opcional):

```bash
npm run test:e2e -w @fluxcy/web
```
